import { Subject } from 'rxjs';
import uuid = require('uuid');
import { SyncState } from './matrix';
import { MatrixConnectorRecvMsg, MatrixConnectorEmitgMsg } from './msg';

const matrix = require('matrix-js-sdk');

export interface MatrixConnectorConfig {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly userId: string;
  readonly roomId: string;
}

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
    this.client.on(
      'Room.timeline',
      (
        event: any,
        room: any,
        toStartOfTimeLine: boolean,
        removed: boolean,
        data: any
      ) => {
        if (event.getType() !== 'm.room.message') {
          return; // only print messages
        }
        const msg = event.getContent();
        if (
          event.getRoomId() === this.config.roomId &&
          event.getSender() === this.config.userId
        ) {
          if (
            event.getStatus &&
            event.getStatus() === matrix.EventStatus.SENDING
          ) {
            this.emit.next({
              type: 'Matrix.Connector.Sent',
              payload: msg
            });
          }
          this.emit.next({
            type: 'Matrix.Connector.Receive',
            payload: msg
          });
        }
      }
    );
    this.client.startClient({ initialSyncLimit: 10 }).catch((err: Error) => {
      this.emit.next({
        type: 'Matrix.Connector.Error',
        payload: err
      });
    });
    this.client.on('sync', (state: SyncState, prevState: any, res: any) => {
      switch (state) {
        case 'PREPARED': {
          this.emit.next({
            type: 'Matrix.Connector.Started',
            payload: undefined
          });
          break;
        }
        case 'STOPPED': {
          this.recv.unsubscribe();
          this.emit.next({
            type: 'Matrix.Connector.Stopped',
            payload: undefined
          });
          break;
        }
        case 'ERROR': {
          this.emit.next({
            type: 'Matrix.Connector.Error',
            payload: res.error
          });
          break;
        }
      }
    });
    this.client.on('Room.localEchoUpdated', (event: any) => {
      if (event.status === matrix.EventStatus.SENT) {
        // this.sendEvents.push(event.getContent().msgid);
        this.emit.next({
          type: 'Matrix.Connector.Receive',
          payload: event.getContent()
        });
      }
    });
  };
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

        console.log(' { ...msg.payload, senderId: this.id }, ', {
          ...msg.payload,
          senderId: this.id
        });
        this.client.sendEvent(
          this.config.roomId,
          'm.room.message',
          { ...msg.payload, senderId: this.id },
          '',
          (err: Error, _: any) => {
            if (err) {
              this.emit.next({
                type: 'Matrix.Connector.Error',
                payload: err
              });
              return;
            }
          }
        );
        break;
      }
      case 'Matrix.Connector.Stop': {
        this.client.stopClient();
        this.client = undefined;
      }
    }
  };

  constructor(config: MatrixConnectorConfig, client = matrix, id = uuid.v4()) {
    this.matrix = client;
    this.config = config;
    this.id = id;
    this.recv.subscribe(this.msgHandler);
  }
}
