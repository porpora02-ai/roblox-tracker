const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

// 🔴 PUT YOUR REAL VALUES HERE
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019172737876240";

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
    console.log("✅ Bot online:", client.user.tag);
});

// 🚀 TEST ROUTE (NO ROBLOX YET)
app.get("/test", async (req, res) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        await channel.send("🟢 TEST MESSAGE: Discord connection works");

        res.send("sent");
    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.send("failed: " + err.message);
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Server running");
});

client.login(TOKEN);
