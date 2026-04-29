const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// 🔴 ENV VARS (Render)
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot online:", client.user.tag);
});

// login (safe)
client.login(TOKEN).catch(err => {
    console.log("❌ Login error:", err.message);
});

// 🌐 HOME ROUTE
app.get("/", (req, res) => {
    res.send("SERVER RUNNING");
});

// 🧪 DISCORD TEST ROUTE
app.get("/test", async (req, res) => {
    try {
        if (!ready) {
            return res.send("Bot not ready yet");
        }

        const channel = await client.channels.fetch(CHANNEL_ID);

        await channel.send("🟢 WORKING - Roblox Tracker is online");

        console.log("✅ Message sent");

        res.send("sent to discord");
    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.send("error: " + err.message);
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on", PORT);
});
