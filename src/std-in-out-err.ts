import * as stream from "stream";
import * as rx from 'rxjs';
import { WriteStream } from 'fs';
import { Socket } from 'dgram';
import { Subject, Subscriber } from 'rxjs';

export interface StdInOutErrProps {
  readonly stdin: stream.Readable;
  readonly stdout: stream.Writable;
  readonly stderr: stream.Writable;
}

export class StdInOutErr {
  public readonly stdin: stream.Readable;
  public readonly stdout: stream.Writable;
  public readonly stderr: stream.Writable;

  private readonly stdinSub: rx.Subscription;

  public readonly emitIn = new Subject<Buffer>();
  public readonly recvOut = new Subject<Buffer>();
  public readonly recvErr = new Subject<Buffer>();

  private readonly subRecvOut: rx.Subscription;
  private readonly subRecvErr: rx.Subscription;

  private stdinListener = (buf: Buffer) => {
    // console.log(`XXXXX`, buf);
    this.emitIn.next(buf);
  }

  constructor(props: StdInOutErrProps) {
    this.stdin = props.stdin;
    this.stdout = props.stdout;
    this.stderr = props.stderr;
    // this.stdin.pipe(this.stdout);
    this.stdin.on('data', this.stdinListener);
    this.subRecvOut = this.recvOut.subscribe(msg => {
      // console.log('Write Out', msg);
      this.stdout.write(msg);
    });
    this.subRecvErr = this.recvErr.subscribe(msg => {
      // console.log('Write Err', msg);
      this.stderr.write(msg);
    })
  }

  public stop() {
    // console.log('STOP');
    this.subRecvOut.unsubscribe();
    this.subRecvErr.unsubscribe();
    this.stdout.end();
    this.stderr.end();
    this.stdin.removeListener('data', this.stdinListener).destroy();
  }

}
