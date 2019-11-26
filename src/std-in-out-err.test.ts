import { StdInOutErr } from "./std-in-out-err";

import { stdin as Stdin } from 'mock-stdin';

import { ObjectReadableMock, ObjectWritableMock } from 'stream-mock'
import { Subject } from 'rxjs';

test("connect constructor and close", () => {
  const stdin = new ObjectReadableMock([]);
  const stdout = new ObjectWritableMock();
  const stderr = new ObjectWritableMock();
  const stdioe = new StdInOutErr({
    stdin,
    stdout,
    stderr
  });
  expect(stdioe).toBeTruthy();
  expect(stdioe.stdin.destroyed).toBeFalsy();
  stdioe.stop();
  expect(stdioe.stdin.destroyed).toBeTruthy();
});

test("test stdin", done => {
  const stdin = new ObjectReadableMock([]);
  const stdout = new ObjectWritableMock();
  const stderr = new ObjectWritableMock();
  const stdioe = new StdInOutErr({
    stdin,
    stdout,
    stderr,
  });
  const tst = ['hallo\n', 'data\n'];
  let seq = 0;
  stdioe.emitIn.subscribe(msg => {
    try {
      expect(msg.toString()).toBe(tst[seq++]);
      if (seq >= tst.length) {
        done();
      }
    } catch (e) {
      done(e);
    }
  });
  tst.forEach(i => stdin.emit('data', Buffer.from(i)));
});

interface PreFactory {
  readonly stdin: ObjectReadableMock;
  readonly stdout: ObjectWritableMock;
  readonly stderr: ObjectWritableMock;
  readonly stdioe: StdInOutErr;
}

interface PostFactory extends PreFactory {
  readonly sout: ObjectWritableMock;
  readonly subOut: Subject<Buffer>;
}

test("test stdout/stderr", async () => {
  const factory = (cb: (p: PreFactory) => PostFactory) => {
    const stdin = new ObjectReadableMock([]);
    const stdout = new ObjectWritableMock();
    const stderr = new ObjectWritableMock();
    const stdioe = new StdInOutErr({
      stdin,
      stdout,
      stderr,
    });
    return cb({
      stdin, stdout, stderr, stdioe
    });
  };
  return Promise.all([factory(o => ({
    ...o,
    subOut: o.stdioe.recvOut,
    sout: o.stdout
  })),
  factory(o => ({
    ...o,
    subOut: o.stdioe.recvErr,
    sout: o.stderr
  }))].map(async (o) => {
    let finischedRs;
    const finisched = new Promise(rs => finischedRs = rs);
    o.sout.on('finish', finischedRs);
    const tst = ['hallo\n', 'data\n'].map(i => Buffer.from(i));
    tst.forEach(i => o.subOut.next(i));
    expect(o.sout.data).toEqual(tst);
    o.stdioe.stop();
    tst.forEach(i => o.subOut.next(Buffer.from(i)));
    expect(o.sout.data).toEqual(tst);
    await finisched;
  }));
});
