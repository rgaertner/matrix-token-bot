import * as dotenv from 'dotenv';
import {
  MatrixConnector,
  MatrixConnectorConfig,
  MatrixConnectorEmitgMsg,
  SentMsg,
  ReceiveMsg,
  MatrixMsg
} from './matrix-connector';
import { matrixConfig } from './util/env-helper';
interface MatrixEvent {
  getType(): string;
  getContent(): MatrixMsg;
  getAge(): { age: number };
  getRoomId(): string;
  getSender(): string;
}
class MatrixMockClient {
  private readonly events: ((event: MatrixEvent) => void)[] = [];
  public startClient = () => {
    return Promise.resolve();
  }
  public on = (type: string, x: any) => {
    console.log('mock on', x);
    if (type === 'event') {
      this.events.push(x);
    }
  }

  public stopClient = () => {};

  public sendEvent = (
    roomId: string,
    msgType: string,
    matrixMsg: any,
    unused: any,
    cb: (err: any, res: any) => void
  ) => {
    cb(undefined, { roomId, payload: matrixMsg });
    const config = mockMatrixConnectorProps();
    this.events.forEach(x => {
      x({
        getContent: () => matrixMsg,
        getType: () => 'm.room.message',
        getRoomId: () => config.roomId,
        getSender: () => config.userId,
        getAge: () => { return {age: 20}; },
      });
    });
  }
}

function genMatrixConnectors(): MatrixConnector[] {
  let matrixConnectors = [
    // new MatrixConnector(
    //   mockMatrixConnectorProps(),
    //   mockMatrix(),
    //   'mockedMatrixConnector'
    // )
  ];
  const testConf = dotenv.config({ path: '.env-test' });
  if (testConf.parsed) {
    matrixConnectors.push(new MatrixConnector(matrixConfig()));
  }
  return matrixConnectors;
}
function genMatrixMsg(body: string): MatrixMsg {
  return {
    body,
    senderid: 'mock' + body,
    msgtype: 'm.text'
  };
}

function mockMatrix() {
  return {
    createClient: () => {
      return new MatrixMockClient();
    }
  };
}

function mockMatrixConnectorProps(): MatrixConnectorConfig {
  return {
    baseUrl: 'mock matrix base url',
    accessToken: 'mock access token',
    userId: 'mock user id',
    roomId: 'mock chat room '
  };
}

test('test double start', done => {
  const matrixMock = mockMatrix();
  const config = mockMatrixConnectorProps();
  const matrix = new MatrixConnector(config, matrixMock);
  const sequence = [
    (msg: MatrixConnectorEmitgMsg) => {
      expect(msg.type).toBe('Matrix.Connector.Started');
      return true;
    },
    (msg: MatrixConnectorEmitgMsg) => {
      expect(msg.type).toBe('Matrix.Connector.Error');
      expect(msg.payload).toEqual(Error('client already instantiatied'));
      return true;
    },
    (msg: MatrixConnectorEmitgMsg) => {
      expect(msg.type).toBe('Matrix.Connector.Stopped');
      return true;
    }
  ];
  let sequenceId = 0;
  matrix.emit.subscribe((msg: MatrixConnectorEmitgMsg) => {
    try {
      sequence[sequenceId++](msg);
      if (sequenceId === sequence.length) {
        done();
        return;
      }
      if (sequenceId < sequence.length) {
        return;
      }
      fail('Should never be reached, no more tests to run');
    } catch (err) {
      done(err);
    }
  });

  const subscription = matrix.emit.subscribe((msg: MatrixConnectorEmitgMsg) => {
    if (msg.type === 'Matrix.Connector.Started') {
      subscription.unsubscribe();
      matrix.recv.next({
        type: 'Matrix.Connector.Start',
        payload: undefined
      });
      matrix.recv.next({
        type: 'Matrix.Connector.Stop',
        payload: undefined
      });
    }
  });

  matrix.recv.next({
    type: 'Matrix.Connector.Start',
    payload: undefined
  });
});

genMatrixConnectors().forEach((matrix: MatrixConnector) => {
  test(
    'send data ' + matrix.id,
    (done: jest.DoneCallback) => {
      const sequence = [
        (msg: SentMsg) => {
          expect(msg.type).toBe('Matrix.Connector.Sent');
          expect(msg.payload.body).toEqual('0');
          return true;
        },
        (msg: SentMsg) => {
          expect(msg.type).toBe('Matrix.Connector.Sent');
          expect(msg.payload.body).toEqual('1');
          return true;
        },
        (msg: SentMsg) => {
          expect(msg.type).toBe('Matrix.Connector.Sent');
          expect(msg.payload.body).toEqual('2');
          return true;
        }
      ];
      const sequenceReceive: ((msg: ReceiveMsg) => void)[] = [
        (msg: ReceiveMsg) => {
          expect(msg.type).toBe('Matrix.Connector.Receive');
          expect(msg.payload.body).toEqual('0');
        },
        (msg: ReceiveMsg) => {
          expect(msg.type).toBe('Matrix.Connector.Receive');
          expect(msg.payload.body).toEqual('1');
        },
        (msg: ReceiveMsg) => {
          expect(msg.type).toBe('Matrix.Connector.Receive');
          expect(msg.payload.body).toEqual('2');
        }
      ];
      let sequenceId = 0;
      let rSequenceId = 0;
      const subscription = matrix.emit.subscribe(
        (startMsg: MatrixConnectorEmitgMsg) => {
          if (startMsg.type === 'Matrix.Connector.Started') {
            subscription.unsubscribe();
            const subSend = matrix.emit.subscribe(
              (msg: MatrixConnectorEmitgMsg) => {
                if (msg.type === 'Matrix.Connector.Sent') {
                  try {
                    sequence[sequenceId++](msg as SentMsg);
                    if (sequenceId <= sequence.length) {
                      return;
                    }
                    fail('Should never be reached, no more tests to run');
                  } catch (err) {
                    done(err);
                  }
                }
                if (msg.type === 'Matrix.Connector.Receive') {
                  console.log('receive', msg);
                  try {
                    sequenceReceive[rSequenceId++](msg);
                    if (rSequenceId === sequenceReceive.length) {
                      subSend.unsubscribe();
                      const stopSub = matrix.emit.subscribe(m => {
                        if (m.type === 'Matrix.Connector.Stopped') {
                          done();
                          stopSub.unsubscribe();
                          return;
                        }
                        done(Error('Never come along here!'));
                      });
                      matrix.recv.next({
                        type: 'Matrix.Connector.Stop',
                        payload: undefined
                      });
                      return;
                    }
                    if (rSequenceId < sequenceReceive.length) {
                      return;
                    }
                    fail('Should never be reached, no more tests to run');
                  } catch (err) {
                    done(err);
                  }
                }
              }
            );
            matrix.recv.next({
              type: 'Matrix.Connector.Send',
              payload: genMatrixMsg('0')
            });
            matrix.recv.next({
              type: 'Matrix.Connector.Send',
              payload: genMatrixMsg('1')
            });
            matrix.recv.next({
              type: 'Matrix.Connector.Send',
              payload: genMatrixMsg('2')
            });
          }
        }
      );
      matrix.recv.next({
        type: 'Matrix.Connector.Start',
        payload: undefined
      });
    },
    matrix.id.startsWith('mock') ? 5000 : 30000
  );
});
