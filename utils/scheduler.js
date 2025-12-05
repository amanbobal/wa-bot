import cron from "node-cron";

export default function (group, message, hour, minute, sock) {
  cron.schedule(`${minute} ${hour} * * *`, async () => {
    await sock.sendMessage(group, { text: message });
  });
}
