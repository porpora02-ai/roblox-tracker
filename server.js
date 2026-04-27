const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// 🔴 CONFIG (REPLACE THESE)
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019172737876240";

// 🤖 DISCORD CLIENT (SAFE)
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// 🚀 LOGIN (DO NOT CRASH SERVER IF FAILS)
client.login(TOKEN)
    .then(() => console.log("✅ Discord bot online"))
    .catch(err => console.log("❌ Bot login failed:", err.message));

// 📡 ROOT TEST
app.get("/", (req, res) => {
    res.send("Server running + bot active");
});

// 📡 ROBLOX REPORT ENDPOINT
app.post("/report", async (req, res) => {
    try {
        console.log("📩 Roblox hit:", req.body);

        const { placeId, name } = req.body;

        if (!placeId) {
            return res.json({ ok: false, error: "missing placeId" });
        }

        // 🔥 SAFE CHANNEL ACCESS
        const channel = client.channels.cache.get(CHANNEL_ID);

        if (!channel) {
            console.log("❌ Channel not found");
            return res.json({ ok: false, error: "channel not found" });
        }

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        await channel.send({
            content: `🎮 **${name || "Unknown Game"}**\n🔗 ${gameUrl}`
        });

        console.log("✅ Sent to Discord");

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.json({ ok: false, error: err.message });
    }
});

// 🚀 START SERVER (RENDER SAFE)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
