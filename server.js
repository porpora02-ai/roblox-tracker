const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 ENV VARS (Render)
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 📦 DATABASE (game registry)
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
    console.log("✅ Bot online:", client.user.tag);
});

client.login(TOKEN).catch(err => {
    console.log("❌ Login error:", err.message);
});

// 🌐 ROOT
app.get("/", (req, res) => {
    res.send("OPTION C TRACKER RUNNING");
});

// 📡 MAIN TRACKING ENDPOINT
app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok: false, error: "bot not ready" });

        const { placeId, name, players } = req.body;

        if (!placeId) return res.json({ ok: false });

        const channel = await client.channels.fetch(CHANNEL_ID);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // 🧠 IF GAME NOT REGISTERED → CREATE MESSAGE ONCE
        if (!games[placeId]) {
            const msg = await channel.send(
`🎮 Roblox Server Update
📛 Game: ${name || "Unknown"}
👥 Players: ${players || 0}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
            );

            games[placeId] = {
                messageId: msg.id,
                lastPlayers: players || 0
            };

            save();

            console.log("🆕 Registered game:", placeId);
        }

        // 🔄 ALWAYS UPDATE SAME MESSAGE (NO DUPLICATES EVER)
        const msg = await channel.messages.fetch(games[placeId].messageId);

        await msg.edit(
`🎮 Roblox Server Update
📛 Game: ${name || "Unknown"}
👥 Players: ${players || 0}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
        );

        games[placeId].lastPlayers = players || 0;
        save();

        console.log("🔄 Updated:", placeId, "Players:", players);

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.json({ ok: false, error: err.message });
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Running on port", PORT);
});
