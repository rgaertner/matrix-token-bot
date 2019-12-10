interface Msg<P, T extends string> {
  readonly type: T;
  readonly payload: P;
}

export interface Payload {
  readonly body: string;
  readonly msgtype: string;
  readonly msgid: string;
}

export type SendMsg = Msg<Payload, 'Matrix.Connector.Send'>;

export type MatrixConnectorRecvMsg =
  | Msg<unknown, 'Matrix.Connector.Start'>
  | Msg<unknown, 'Matrix.Connector.Stop'>
  | SendMsg;

export type SentMsg = Msg<Payload, 'Matrix.Connector.Sent'>;

export type ReceiveMsg = Msg<Payload, 'Matrix.Connector.Receive'>;

export type MatrixConnectorEmitgMsg =
  | Msg<undefined, 'Matrix.Connector.Started'>
  | Msg<unknown, 'Matrix.Connector.Stopped'>
  | Msg<Error, 'Matrix.Connector.Error'>
  | ReceiveMsg
  | SentMsg;
