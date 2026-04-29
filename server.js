const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// 🔴 USE ENV VARS (Render)
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

console.log("TOKEN EXISTS:", !!TOKEN);
console.log("CHANNEL EXISTS:", !!CHANNEL_ID);

// 🤖 BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.on("ready", () => {
    console.log("✅ BOT ONLINE:", client.user.tag);
});

client.on("error", err => {
    console.log("❌ CLIENT ERROR:", err.message);
});

// LOGIN
client.login(TOKEN)
    .then(() => console.log("✅ LOGIN SUCCESS"))
    .catch(err => console.log("❌ LOGIN FAILED:", err.message));

// 🌐 TEST ROUTE
app.get("/test", async (req, res) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        console.log("CHANNEL FETCHED");

        await channel.send("🟢 DEBUG TEST MESSAGE");

        console.log("MESSAGE SENT");

        res.send("ok");
    } catch (err) {
        console.log("❌ SEND ERROR:", err);
        res.send("error: " + err.message);
    }
});

// 🚀 SERVER
app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 SERVER RUNNING");
});
