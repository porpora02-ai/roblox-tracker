const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GDrSXm.inJS80ZyXz1ldSxxqCBbqU74wuw_ovECnUouPo";
const CHANNEL_ID = "1498019172737876240";

const FILE = "./messages.json";

// load saved messages
let messages = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE))
    : {};

function save() {
    fs.writeFileSync(FILE, JSON.stringify(messages, null, 2));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// 🧠 COOLDOWN PER GAME (THIS IS THE KEY FIX)
let lastUpdate = {};

function gameLink(id) {
    return `https://www.roblox.com/games/${id}`;
}

client.once("ready", () => {
    console.log("Bot ready");
});

async function updateGame(data) {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = {
        title: data.name || "Unknown Game",
        description:
`👥 Players: ${data.players}
🔗 ${gameLink(data.placeId)}`,
        color: 0x00ffcc
    };

    // 🔒 IF MESSAGE EXISTS → EDIT ONLY
    if (messages[data.placeId]) {
        try {
            const msg = await channel.messages.fetch(messages[data.placeId]);
            await msg.edit({ embeds: [embed] });
            return;
        } catch {
            delete messages[data.placeId];
            save();
        }
    }

    // 🆕 CREATE ONLY ONCE EVER
    const msg = await channel.send({ embeds: [embed] });
    messages[data.placeId] = msg.id;
    save();
}

// 📡 ROBLOX → SERVER
app.post("/report", async (req, res) => {
    const data = req.body;

    // 🧠 HARD COOLDOWN (prevents spam completely)
    if (lastUpdate[data.placeId] && Date.now() - lastUpdate[data.placeId] < 5000) {
        return res.json({ ok: true, skipped: true });
    }

    lastUpdate[data.placeId] = Date.now();

    try {
        await updateGame(data);
        res.json({ ok: true });
    } catch (e) {
        console.log(e.message);
        res.json({ ok: false });
    }
});

app.listen(3000, () => {
    console.log("Tracker running");
});

client.login(TOKEN);
