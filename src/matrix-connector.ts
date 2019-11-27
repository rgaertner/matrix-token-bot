import { Subject } from 'rxjs';
import uuid = require('uuid');

const matrix = require('matrix-js-sdk');

export interface MatrixConnectorConfig {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly userId: string;
  readonly roomId: string;
}
export interface MatrixMsg {
  body: string;
  senderid: string;
  msgtype: string;
}

export type MatrixConnectorRecvMsg =
  | Msg<unknown, 'Matrix.Connector.Start'>
  | Msg<unknown, 'Matrix.Connector.Stop'>
  | Msg<MatrixMsg, 'Matrix.Connector.Send'>;

export type SentMsg = Msg<MatrixMsg, 'Matrix.Connector.Sent'>;
export type ReceiveMsg = Msg<MatrixMsg, 'Matrix.Connector.Receive'>;
export type MatrixConnectorEmitgMsg =
  | Msg<undefined, 'Matrix.Connector.Started'>
  | Msg<unknown, 'Matrix.Connector.Stopped'>
  | Msg<Error, 'Matrix.Connector.Error'>
  | ReceiveMsg
  | SentMsg;

export class MatrixConnector {
  public readonly id: string;
  private readonly config: MatrixConnectorConfig;
  private client?: any;
  private readonly matrix: any;
  public readonly recv: Subject<MatrixConnectorRecvMsg> = new Subject<
    MatrixConnectorRecvMsg
  >();
  public readonly emit: Subject<MatrixConnectorEmitgMsg> = new Subject<
    MatrixConnectorEmitgMsg
  >();

  private start = () => {
    if (this.client) {
      this.emit.next({
        type: 'Matrix.Connector.Error',
        payload: Error('client already instantiatied')
      });
      return;
    }
    this.client = this.matrix.createClient({
      baseUrl: this.config.baseUrl,
      accessToken: this.config.accessToken,
      userId: this.config.userId
    });
    this.client.on('Room.timeline', (event: any, room: string) => {
      if (event.getType() !== 'm.room.message') {
        return; // only print messages
      }
      const msg = event.getContent();
      const age = event.getAge();
      if (
        event.getRoomId() === this.config.roomId &&
        event.getSender() === this.config.userId &&
        age < 2000
      ) {
        this.emit.next({
          type: 'Matrix.Connector.Receive',
          payload: msg,
        });
      }
    });
    this.client
      .startClient({ initialSyncLimit: 1 })
      .then((_: any) => {
        this.emit.next({
          type: 'Matrix.Connector.Started',
          payload: undefined
        });
      })
      .catch((err: Error) => {
        this.emit.next({
          type: 'Matrix.Connector.Error',
          payload: err
        });
      });
  }

  private msgHandler = (msg: MatrixConnectorRecvMsg) => {
    switch (msg.type) {
      case 'Matrix.Connector.Start': {
        this.start();
        break;
      }
      case 'Matrix.Connector.Send': {
        if (!this.client) {
          this.emit.next({
            type: 'Matrix.Connector.Error',
            payload: Error(
              'tried to send Message, before connection was establishe!'
            )
          });
          return;
        }
        const message: MatrixMsg = {
          body: msg.payload.body,
          senderid: this.id,
          msgtype: 'm.text'
        };
        this.client.sendEvent(
          this.config.roomId,
          'm.room.message',
          message,
          '',
          (err: Error, _: any) => {
            if (err) {
              this.emit.next({
                type: 'Matrix.Connector.Error',
                payload: err
              });
              return;
            }
            this.emit.next({
              type: 'Matrix.Connector.Sent',
              payload: msg.payload
            });
          }
        );
        break;
      }
      case 'Matrix.Connector.Stop': {
        this.client.stopClient();
        this.client = undefined;
        this.emit.next({
          type: 'Matrix.Connector.Stopped',
          payload: undefined
        });
        this.recv.unsubscribe();
      }
    }
  }

  constructor(config: MatrixConnectorConfig, client = matrix, id = uuid.v4()) {
    this.matrix = client;
    this.config = config;
    this.id = id;
    this.recv.subscribe(this.msgHandler);
  }
}
