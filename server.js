const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 ENV VARS
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 📦 DATABASE
const FILE = "./games.json";

let games = {};
if (fs.existsSync(FILE)) {
    games = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(games, null, 2));
}

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot ready:", client.user.tag);
});

// ⚠️ SAFE LOGIN (PREVENT DEPLOY CRASH)
if (TOKEN) {
    client.login(TOKEN).catch(err => {
        console.log("❌ Login failed:", err.message);
    });
} else {
    console.log("⚠️ TOKEN missing (bot disabled)");
}

// 🔥 GET GAME NAME (SAFE)
async function getGameName(placeId) {
    try {
        const res = await axios.get(
            `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
        );

        return res.data?.[0]?.name || "Unknown Game";
    } catch {
        return "Unknown Game";
    }
}

// 🌐 ROOT
app.get("/", (req, res) => {
    res.send("TRACKER RUNNING");
});

// 📡 REPORT
app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok: false });

        const { placeId, players } = req.body;

        if (!placeId) return res.json({ ok: false });

        const channel = await client.channels.fetch(CHANNEL_ID);

        const gameName = await getGameName(placeId);
        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        if (!games[placeId]) {
            const msg = await channel.send(
`🎮 Roblox Server Update
📛 Game: ${gameName}
👥 Players: ${players}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
            );

            games[placeId] = { messageId: msg.id };
            save();
        } else {
            const msg = await channel.messages.fetch(games[placeId].messageId);

            await msg.edit(
`🎮 Roblox Server Update
📛 Game: ${gameName}
👥 Players: ${players}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
            );
        }

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.json({ ok: false });
    }
});

// 🚀 START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Running on port", PORT);
});
