const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019171789705279";

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
    console.log("✅ Bot online:", client.user.tag);
});

// 📡 ROBLOX REPORT
app.post("/report", async (req, res) => {
    try {
        const { placeId, name } = req.body;

        const channel = await client.channels.fetch(CHANNEL_ID);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        await channel.send({
            content: `🎮 ${name}\n${gameUrl}`
        });

        console.log("✅ Sent:", name);

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ Error:", err.message);
        res.json({ ok: false });
    }
});

// 🚀 START
app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Server running");
});

client.login(TOKEN);
