const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019171789705279";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once("ready", () => {
    console.log("✅ Discord bot online:", client.user.tag);
});

app.get("/", (req, res) => {
    res.send("Server is alive + Discord running");
});

app.post("/test", async (req, res) => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        await channel.send("🟢 Bot is working!");

        res.json({ ok: true });
    } catch (err) {
        console.log("❌ Discord error:", err.message);
        res.json({ ok: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on", PORT);
});

client.login(TOKEN);
