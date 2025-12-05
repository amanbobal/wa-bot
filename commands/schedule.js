import scheduler from "../utils/scheduler.js";

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid;

  const time = args.shift(); // e.g. "10:30"
  const content = args.join(" ");

  const [h, m] = time.split(":");

  scheduler(from, content, h, m, sock);

  await sock.sendMessage(from, { text: `Scheduled daily message at ${time}` });
}
