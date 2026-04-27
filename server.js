const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019171789705279";

// 🤖 BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let botReady = false;

client.once("ready", () => {
    botReady = true;
    console.log("✅ Bot ready as:", client.user.tag);
});

// 🚀 LOGIN
client.login(TOKEN).catch(err => {
    console.log("❌ Login error:", err.message);
});

// 📡 TEST ROUTE (IMPORTANT)
app.get("/test", async (req, res) => {
    if (!botReady) {
        return res.send("Bot not ready yet");
    }

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            return res.send("Channel not found");
        }

        await channel.send("🟢 TEST MESSAGE WORKS");

        res.send("Sent!");
    } catch (err) {
        console.log("❌ Send error:", err.message);
        res.send("Error: " + err.message);
    }
});

// 🚀 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running");
});
