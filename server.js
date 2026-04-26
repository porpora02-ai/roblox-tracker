const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 CONFIG (PUT NEW TOKEN HERE)
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GG6SeC.OQYEecbcHfqO-aEyZUL6fdUoVplXPq2-wxZK_c";
const CHANNEL_ID = "1498019171789705279";

const FILE = "./registeredGames.json";

// 📦 LOAD DATABASE
let registered = {};
if (fs.existsSync(FILE)) {
    registered = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(registered, null, 2));
}

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
    console.log("✅ Bot online as:", client.user.tag);
});

// 🎮 GET ROBLOX ICON
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

// 📡 MAIN ENDPOINT
app.post("/report", async (req, res) => {
    try {
        const { placeId, name } = req.body;

        console.log("📩 Request:", req.body);

        if (!placeId) {
            return res.json({ ok: false, error: "missing placeId" });
        }

        // ❌ already exists
        if (registered[placeId]) {
            return res.json({ ok: true, skipped: true });
        }

        const channel = await client.channels.fetch(CHANNEL_ID);

        const icon = await getIcon(placeId);
        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // 🔥 SINGLE CLEAN MESSAGE
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

        registered[placeId] = true;
        save();

        console.log("✅ Sent:", placeId);

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.json({ ok: false, error: err.message });
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});

client.login(TOKEN);
