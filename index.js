import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import express from "express";
import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";

// Load commands
const commands = {};
const cmdPath = path.join(process.cwd(), "commands");
for (const file of fs.readdirSync(cmdPath)) {
    const name = file.replace(".js", "");
    commands[name] = (await import(`./commands/${file}`)).default;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!text || !text.startsWith("/")) return;

        const [cmd, ...args] = text.slice(1).split(" ");
        const command = commands[cmd.toLowerCase()];

        if (command) {
            await command(sock, msg, args);
        }
    });

    sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        console.log("Scan this QR to log in:");
        qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            console.log("Reconnecting...");
            startBot();
        } else {
            console.log("Logged out.");
        }
    }

    if (connection === "open") {
        console.log("Bot connected successfully!");
    }
});

    console.log("Bot is ready.");

    // Render keep-alive
    const app = express();
    app.get("/", (req, res) => res.send("Bot is running"));
    app.listen(process.env.PORT || 8080);
}



startBot();
