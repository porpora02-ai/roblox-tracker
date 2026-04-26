const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GDrSXm.inJS80ZyXz1ldSxxqCBbqU74wuw_ovECnUouPo";
const CHANNEL_ID = "1498019172737876240";

const FILE = "./registeredGames.json";

// 📦 LOAD SAVED DATA
let registered = {};
if (fs.existsSync(FILE)) {
    registered = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(registered, null, 2));
}

// 🤖 DISCORD CLIENT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// 🧠 SAFETY (prevents silent crashes)
process.on("uncaughtException", (err) => {
    console.log("🔥 CRASH:", err);
});

process.on("unhandledRejection", (err) => {
    console.log("🔥 PROMISE ERROR:", err);
});

// 🚀 BOT READY
client.once("ready", () => {
    console.log("✅ Bot online");
});

// 🎮 GET ROBLOX ICON
async function getIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );

        return res.data?.data?.[0]?.imageUrl || null;
    } catch (e) {
        console.log("❌ Icon error:", e.message);
        return null;
    }
}

// 📡 REPORT ENDPOINT
app.post("/report", async (req, res) => {
    try {
        const { placeId, name } = req.body;

        console.log("📩 Received:", req.body);

        if (!placeId) {
            return res.json({ ok: false, error: "missing placeId" });
        }

        // ❌ already registered → ignore
        if (registered[placeId]) {
            return res.json({ ok: true, skipped: true });
        }

        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) {
            return res.json({ ok: false, error: "channel not found" });
        }

        const icon = await getIcon(placeId);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // 📤 SEND MESSAGE (ONLY ONCE)
        await channel.send({
            embeds: [
                {
                    title: name || "Unknown Game",
                    url: gameUrl,
                    color: 0x00ffcc,
                    description: `🔗 [Join Game](${gameUrl})`,
                    thumbnail: icon ? { url: icon } : undefined,
                    image: icon ? { url: icon } : undefined
                }
            ]
        });

        // 💾 SAVE REGISTERED GAME
        registered[placeId] = true;
        save();

        console.log("✅ Registered:", placeId);

        res.json({ ok: true });

    } catch (e) {
        console.log("🔥 ERROR:", e.message);
        res.json({ ok: false, error: e.message });
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});

client.login(TOKEN);
