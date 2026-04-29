const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = process.env.MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GjSRiw.-QbvdPJ2A4eCxFW17hAAYmUu7RWqXIjHXy-fC0;
const CHANNEL_ID = "1498019172737876240";

const FILE = "./games.json";

// load saved
let games = {};
if (fs.existsSync(FILE)) {
    games = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(games, null, 2));
}

// 🤖 BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ BOT READY:", client.user.tag);
});

client.login(TOKEN).catch(err => {
    console.log("❌ LOGIN ERROR:", err.message);
});

// 🚀 ROOT
app.get("/", (req, res) => {
    res.send("RUNNING");
});

// 🧪 FORCE TEST ROUTE
app.get("/force", async (req, res) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send("🟢 FORCE TEST WORKED");
        res.send("sent");
    } catch (e) {
        console.log("❌ FORCE ERROR:", e.message);
        res.send("error: " + e.message);
    }
});

// 📡 REPORT
app.post("/report", async (req, res) => {
    console.log("📩 REQUEST:", req.body);

    if (!ready) {
        console.log("❌ BOT NOT READY");
        return res.json({ ok: false, error: "bot not ready" });
    }

    try {
        const { placeId, name, players } = req.body;

        if (!placeId) {
            console.log("❌ NO PLACEID");
            return res.json({ ok: false });
        }

        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            console.log("❌ CHANNEL NOT FOUND");
            return res.json({ ok: false });
        }

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // NEW GAME
        if (!games[placeId]) {
            const msg = await channel.send(
`🎮 Roblox Server Update
📛 Game: ${name || "Unknown"}
👥 Players: ${players || 0}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
            );

            games[placeId] = { messageId: msg.id };
            save();

            console.log("✅ REGISTERED:", placeId);
        } 
        // UPDATE
        else {
            const msg = await channel.messages.fetch(games[placeId].messageId);

            await msg.edit(
`🎮 Roblox Server Update
📛 Game: ${name || "Unknown"}
👥 Players: ${players || 0}
🔗 Join Game: ${gameUrl}
🆔 PlaceId: ${placeId}`
            );

            console.log("🔄 UPDATED:", placeId);
        }

        res.json({ ok: true });

    } catch (e) {
        console.log("❌ ERROR:", e.message);
        res.json({ ok: false, error: e.message });
    }
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🚀 SERVER RUNNING");
});
