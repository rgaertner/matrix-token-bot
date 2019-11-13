const sdk = require("matrix-js-sdk");
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const fromEnv = envVar => {
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

const main = async () => {
  var client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: myAccessToken,
    userId: userId
  });
  await client.on("Room.timeline", function(event, room, toStartOfTimeline) {
    if (toStartOfTimeline) {
      return; // don't print paginated results
    }
    if (event.getType() !== "m.room.message") {
      return; // only print messages
    }
    const msg = event.getContent().body;
    const age = event.getUnsigned().age;
    if (
      room.name === roomName &&
      event.getSender() === userId &&
      msg.startsWith("Token: ") &&
      age < 20000
    ) {
      const token = msg.split(" ")[1];
      client.sendTextMessage(roomId, "received token: " + token);
    }
  });
  await client.startClient({ initialSyncLimit: 10 });

  await client.sendTextMessage(
    "!qUHHLGOcxMCRKbpoGI:matrix.org",
    "Please provide a token!"
  );
};

main();
