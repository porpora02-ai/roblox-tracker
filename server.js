const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 ENV VARS (Render)
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
    console.log("✅ Bot online:", client.user.tag);
});

client.login(TOKEN).catch(err => {
    console.log("❌ Login error:", err.message);
});

// 🌐 ROOT
app.get("/", (req, res) => {
    res.send("OPTION C TRACKER RUNNING");
});

// 📡 MAIN TRACKER
app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok: false, error: "bot not ready" });

        let { placeId, name, players } = req.body;

        if (!placeId) return res.json({ ok: false });

        players = Number(players) || 0;

        const channel = await client.channels.fetch(CHANNEL_ID);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // 🧠 CREATE ENTRY ON FIRST DETECTION ONLY
        if (!games[placeId]) {
            games[placeId] = {
                messageId: null,
                name: name || "Unknown Game",
                lastPlayers: -1
            };
        }

        // 🧠 LOCK GAME NAME (NEVER OVERWRITE AFTER FIRST GOOD VALUE)
        if (name && games[placeId].name === "Unknown Game") {
            games[placeId].name = name;
        }

        const gameName = games[placeId].name;

        let message;

        // 🆕 FIRST TIME → CREATE MESSAGE
        if (!games[placeId].messageId) {
            message = await channel.send(
`🎮 Roblox Server Update
📛 Game: ${gameName}
👥 Players: ${players}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
            );

            games[placeId].messageId = message.id;
            games[placeId].lastPlayers = players;

            save();

            console.log("🆕 Registered:", placeId);
        } else {
            // 🔄 ALWAYS EDIT SAME MESSAGE
            if (games[placeId].lastPlayers !== players) {
                const msg = await channel.messages.fetch(games[placeId].messageId);

                await msg.edit(
`🎮 Roblox Server Update
📛 Game: ${gameName}
👥 Players: ${players}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
                );

                games[placeId].lastPlayers = players;
                save();

                console.log("🔄 Updated:", placeId, "Players:", players);
            }
        }

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.json({ ok: false, error: err.message });
    }
});

// 🚀 START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Running on port", PORT);
});
