import axios from "axios";

export default async function (sock, msg) {
  const from = msg.key.remoteJid;

  try {
    const res = await axios.get("https://meme-api.com/gimme");
    await sock.sendMessage(from, {
      image: { url: res.data.url },
      caption: res.data.title,
    });
  } catch (err) {
    await sock.sendMessage(from, { text: "Couldn't fetch meme." });
  }
}
