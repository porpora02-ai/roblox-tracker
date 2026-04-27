const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019171789705279";

// 🔥 Express ALWAYS runs no matter what
app.get("/", (req, res) => {
    res.send("Server alive");
});

// 🤖 Discord client (safe mode)
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// 🚨 NEVER CRASH SERVER ON LOGIN FAILURE
client.login(TOKEN)
    .then(() => {
        console.log("✅ Discord logged in");
    })
    .catch(err => {
        console.log("❌ Discord login failed:", err.message);
    });

// 📡 TEST ROUTE
app.post("/test", async (req, res) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            return res.json({ ok: false, error: "channel not found" });
        }

        await channel.send("🟢 Bot working");

        res.json({ ok: true });
    } catch (err) {
        console.log("❌ Send error:", err.message);
        res.json({ ok: false, error: err.message });
    }
});

// 🚀 START SERVER (MUST NEVER FAIL)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on", PORT);
});
