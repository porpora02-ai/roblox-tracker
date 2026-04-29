const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const FILE = "./games.json";

let games = {};
if (fs.existsSync(FILE)) {
    games = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(games, null, 2));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot ready:", client.user.tag);
});

client.login(TOKEN);

// 🔥 GET REAL GAME NAME FROM ROBLOX API
async function getGameName(placeId) {
    try {
        const res = await axios.get(
            `https://games.roblox.com/v1/games?universeIds=${placeId}`
        );

        return res.data?.data?.[0]?.name || "Unknown Game";
    } catch {
        return "Unknown Game";
    }
}

app.get("/", (req, res) => {
    res.send("TRACKER RUNNING");
});

app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok: false });

        const { placeId, players } = req.body;

        const channel = await client.channels.fetch(CHANNEL_ID);

        // 🔥 REAL NAME FROM API (FIXES YOUR ISSUE)
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

            games[placeId] = {
                messageId: msg.id
            };

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
        console.log(err.message);
        res.json({ ok: false });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Running");
});
