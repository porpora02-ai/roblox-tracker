const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019171789705279";

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Safe login (prevents deploy crash)
client.login(TOKEN)
    .then(() => console.log("✅ Discord bot online"))
    .catch(err => console.log("❌ Bot login failed:", err.message));

// 🧠 Roblox icon fetch (safe, optional)
async function getIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );
        return res.data?.data?.[0]?.imageUrl || null;
    } catch {
        return null;
    }
}

// 📡 ROOT CHECK
app.get("/", (req, res) => {
    res.send("Server running");
});

// 📡 ROBLOX REPORT ENDPOINT
app.post("/report", async (req, res) => {
    try {
        const { placeId, name } = req.body;

        console.log("📩 Roblox request:", req.body);

        if (!placeId) {
            return res.json({ ok: false, error: "missing placeId" });
        }

        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            return res.json({ ok: false, error: "channel not found" });
        }

        const gameUrl = `https://www.roblox.com/games/${placeId}`;
        const icon = await getIcon(placeId);

        await channel.send({
            embeds: [
                {
                    title: name || "Unknown Game",
                    url: gameUrl,
                    color: 0x00ffcc,
                    description: `🔗 [Join Game](${gameUrl})`,
                    thumbnail: icon ? { url: icon } : undefined
                }
            ]
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
