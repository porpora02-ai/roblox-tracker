const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GvAONq.oY-JLhgWy0Szk5YY0AGGOZwbfdVSGgdVd6mBRE";
const CHANNEL_ID = "1498019172737876240";

const FILE = "./registeredGames.json";

// 📦 LOAD STORAGE
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

// 🚨 GLOBAL ERROR CATCHING
process.on("uncaughtException", (err) => {
    console.log("🔥 UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
    console.log("🔥 PROMISE ERROR:", err);
});

// ✅ BOT READY
client.once("ready", () => {
    console.log("✅ Bot online as:", client.user.tag);
});

// 🎮 GET ICON
async function getIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );

        return res.data?.data?.[0]?.imageUrl || null;
    } catch (e) {
        console.log("❌ Icon fetch failed:", e.message);
        return null;
    }
}

// 📡 ROBLOX ENDPOINT
app.post("/report", async (req, res) => {
    console.log("📩 Roblox request received:", req.body);

    try {
        const { placeId, name } = req.body;

        if (!placeId) {
            console.log("❌ Missing placeId");
            return res.json({ ok: false, error: "missing placeId" });
        }

        // ❌ already registered
        if (registered[placeId]) {
            console.log("⏭ Already exists:", placeId);
            return res.json({ ok: true, skipped: true });
        }

        console.log("📡 Fetching Discord channel...");

        const channel = await client.channels.fetch(CHANNEL_ID).catch(err => {
            console.log("❌ Channel fetch failed:", err.message);
            return null;
        });

        if (!channel) {
            return res.json({ ok: false, error: "channel not found" });
        }

        console.log("📡 Getting Roblox icon...");

        const icon = await getIcon(placeId);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        console.log("📤 Sending to Discord...");

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

        console.log("✅ Sent to Discord successfully");

        registered[placeId] = true;
        save();

        res.json({ ok: true });

    } catch (e) {
        console.log("🔥 MAIN ERROR:", e);
        res.json({ ok: false, error: e.message });
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});

client.login(TOKEN);
