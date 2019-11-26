var sdk = require("matrix-js-sdk");
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as uuid from "uuid";
import { Subject } from "rxjs";
import { textSpanIsEmpty, textSpanContainsPosition } from "typescript";

dotenv.config({ path: ".env" });

const fromEnv = (envVar: string) => {
  const val = process.env[envVar];
  if (!val) {
    throw new Error(`Please provide env var ${envVar}`);
  }
  return val;
};

const userId = fromEnv("USER_ID");
const myAccessToken = fromEnv("ACCESS_TOKEN");
const roomName = fromEnv("ROOM_NAME");
const roomId = fromEnv("ROOM_ID");
const senderId = uuid.v4();

const stdInEmitter = new Subject<KeyMessage>();

type KeyMessage = {
  buffer: Buffer;
  bytes: number;
};

const stdinreader = (fd: number) => {
  const buffer = Buffer.alloc(4096);
  fs.read(fd, buffer, 0, 4096, null, (err, bread, buf) => {
    if (err || bread <= 0) {
      console.log("loop end ", err, bread);
      return;
    }
    console.log("read from stdin");
    buffer;
    stdInEmitter.next({ buffer: buf, bytes: bread });
    stdinreader(fd);
  });
};
function sendEncodedEvent(client: any, roomId: string, payload: Buffer) {
  client.sendEvent(
    roomId,
    "m.room.message",
    {
      body: payload.toString("base64"),
      senderid: senderId,
      msgtype: "m.text"
    },
    ""
  );
}
(async () => {
  const fd = ~~process.argv[process.argv.length - 1];
  console.log(JSON.stringify(fd));
  var client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: myAccessToken,
    userId: userId
  });
  client.on("event", function(event: any) {
    if (event.getType() !== "m.room.message") {
      return; // only print messages
    }
    const msg = event.getContent().body;
    const age = event.getUnsigned().age;
    if (
      event.getContent().senderid !== senderId &&
      event.getRoomId() === roomId &&
      event.getSender() === userId &&
      age < 2000
    ) {
      const buffer = Buffer.from(msg, "base64");
      console.log("received: ", buffer);
      fs.write(fd, buffer, 0, buffer.length, null, (err, bwritten, buffer) => {
        console.log(err);
      });
      sendEncodedEvent(client, roomId, msg);
    }
  });
  client.startClient({ initialSyncLimit: 10 });
  stdInEmitter.subscribe((msg: { buffer: Buffer; bytes: number }) => {
    console.log("got message via subscription ", msg);
    sendEncodedEvent(client, roomId, msg.buffer);
  });
  stdinreader(fd);
})();
