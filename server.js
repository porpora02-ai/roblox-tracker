const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GDrSXm.inJS80ZyXz1ldSxxqCBbqU74wuw_ovECnUouPo";
const CHANNEL_ID = "1498019172737876240";

const FILE = "./messages.json";

let messages = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE))
    : {};

// 🔒 LOCK SYSTEM
let locks = {};

function save() {
    fs.writeFileSync(FILE, JSON.stringify(messages, null, 2));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

function gameLink(placeId) {
    return `https://www.roblox.com/games/${placeId}`;
}

async function getIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );
        return res.data.data[0]?.imageUrl;
    } catch {
        return null;
    }
}

client.once("ready", () => {
    console.log("Bot ready");
});

async function updateGame(data) {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const icon = await getIcon(data.placeId);

    const embed = {
        title: data.name || "Unknown Game",
        color: 0x00ffcc,
        thumbnail: icon ? { url: icon } : undefined,
        description:
`👥 Players: ${data.players}
🔗 Join: ${gameLink(data.placeId)}
🆔 ${data.placeId}`
    };

    // 🔁 EDIT IF EXISTS
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

    // 🆕 CREATE ONCE
    const msg = await channel.send({ embeds: [embed] });
    messages[data.placeId] = msg.id;
    save();
}

// 📡 ROBLOX → SERVER
app.post("/report", async (req, res) => {
    const data = req.body;

    // 🔒 LOCK PER GAME
    if (locks[data.placeId]) {
        return res.json({ ok: true, skipped: true });
    }

    locks[data.placeId] = true;

    try {
        await updateGame(data);
        res.json({ ok: true });
    } catch (e) {
        console.log(e.message);
        res.json({ ok: false });
    }

    // 🔓 RELEASE LOCK AFTER SHORT TIME
    setTimeout(() => {
        delete locks[data.placeId];
    }, 2000);
});

app.listen(3000, () => {
    console.log("Tracker running");
});

client.login(TOKEN);
