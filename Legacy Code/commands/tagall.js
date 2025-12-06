export default async function (sock, msg) {
  const group = msg.key.remoteJid;
  const metadata = await sock.groupMetadata(group);

  const mentions = metadata.participants.map((p) => p.id);
  const tagText = mentions.map((m) => `@${m.split("@")[0]}`).join(" ");

  await sock.sendMessage(group, {
    text: tagText,
    mentions,
  });
}
