import * as dotenv from 'dotenv';
import { MatrixConnector, MatrixConnectorConfig } from './matrix-connector';
import { MatrixEvent } from './matrix';
import { matrixConfig } from './util/env-helper';
import uuid = require('uuid');
import {
  SendMsg,
  MatrixConnectorEmitgMsg,
  Payload,
  SentMsg,
  ReceiveMsg
} from './msg';

type EventHandler = (
  event: MatrixEvent,
  room: any,
  toStartOfTimeLine: boolean,
  removed: boolean,
  data: any
) => void;
class MatrixMockClient {
  private readonly events: EventHandler[] = [];
  public startClient = () => {
    return Promise.resolve();
  };
  public on = (type: string, x: any) => {
    if (type === 'Room.timeline') {
      this.events.push(x);
    }
  };

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
      x(
        {
          getContent: () => matrixMsg,
          getType: () => 'm.room.message',
          getRoomId: () => config.roomId,
          getSender: () => config.userId,
          getAge: () => {
            return { age: 20 };
          }
        },
        roomId,
        false,
        false,
        { liveEvent: true }
      );
    });
  };
}

function genMatrixConnectors(): MatrixConnector[] {
  const matrixConnectors = [
    // new MatrixConnector(mockMatrixConnectorProps(), mockMatrix())
  ];
  const testConf = dotenv.config({ path: '.env-test' });
  if (testConf.parsed) {
    matrixConnectors.push(new MatrixConnector(matrixConfig()));
  }
  return matrixConnectors;
}
function genSendMsg(body: string, msgid: string = uuid.v4()): SendMsg {
  return {
    type: 'Matrix.Connector.Send',
    payload: {
      body,
      msgtype: 'm.text',
      msgid
    }
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
      console.log('emit msg', msg);
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

function testSendMsg(matrixMsg: Payload, msg: SentMsg) {
  expect(msg.type).toBe('Matrix.Connector.Sent');
  expect(msg.payload.body).toEqual(matrixMsg.body);
  expect(msg.payload.msgid).toEqual(matrixMsg.msgid);
}

function testReceiveMsg(matrixMsg: Payload, msg: ReceiveMsg) {
  expect(msg.type).toBe('Matrix.Connector.Receive');
  expect(msg.payload.body).toEqual(matrixMsg.body);
  expect(msg.payload.msgid).toEqual(matrixMsg.msgid);
}

genMatrixConnectors().forEach((matrix: MatrixConnector) => {
  test.only(
    'send data ' + matrix.id,
    (done: jest.DoneCallback) => {
      const msgs: SendMsg[] = [
        genSendMsg('0', 'id0'),
        genSendMsg('1'),
        genSendMsg('2', 'id2')
      ];
      let sequenceId = 0;
      let rsequenceId = 0;
      const subscription = matrix.emit.subscribe(
        (startMsg: MatrixConnectorEmitgMsg) => {
          if (startMsg.type === 'Matrix.Connector.Started') {
            subscription.unsubscribe();
            const subSend = matrix.emit.subscribe(
              (msg: MatrixConnectorEmitgMsg) => {
                console.log('emmitted by client ', { msg });
                if (msg.type === 'Matrix.Connector.Sent') {
                  try {
                    testSendMsg(msgs[sequenceId++].payload, msg);
                    if (sequenceId <= msgs.length) {
                      return;
                    }
                    fail('Should never be reached, no more tests to run');
                  } catch (err) {
                    done(err);
                  }
                }
                if (msg.type === 'Matrix.Connector.Receive') {
                  try {
                    testReceiveMsg(msgs[rsequenceId++].payload, msg);
                    if (rsequenceId === msgs.length) {
                      console.log('end receive ', rsequenceId, msgs);
                      subSend.unsubscribe();
                      const stopSub = matrix.emit.subscribe(m => {
                        if (m.type === 'Matrix.Connector.Stopped') {
                          console.log('call done!!!!');
                          stopSub.unsubscribe();
                          console.log('call done1!!!!');
                          done();
                          console.log('call done2!!!!');
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
                    if (rsequenceId < msgs.length) {
                      return;
                    }
                    fail('Should never be reached, no more tests to run');
                  } catch (err) {
                    done(err);
                  }
                }
              }
            );

            msgs.forEach(m => matrix.recv.next(m));
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
