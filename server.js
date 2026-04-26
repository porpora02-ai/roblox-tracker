const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 CONFIG
const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GDrSXm.inJS80ZyXz1ldSxxqCBbqU74wuw_ovECnUouPo";
const CHANNEL_ID = "1498019172737876240";

const FILE = "./registeredGames.json";

// 📦 load saved registered games
let registered = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE))
    : {};

function save() {
    fs.writeFileSync(FILE, JSON.stringify(registered, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once("ready", () => {
    console.log("Bot online");
});

// 🔥 GET ROBLOX ICON
async function getIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );
        return res.data.data[0]?.imageUrl;
    } catch {
        return null;
    }
}

// 📡 MAIN ENDPOINT
app.post("/report", async (req, res) => {
    const { placeId, name } = req.body;

    // ❌ already registered → ignore forever
    if (registered[placeId]) {
        return res.json({ ok: true, skipped: true });
    }

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        const icon = await getIcon(placeId);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // 🎮 SEND ONE MESSAGE ONLY
        await channel.send({
            embeds: [
                {
                    title: name || "Unknown Game",
                    url: gameUrl,
                    color: 0x00ffcc,
                    description: `🔗 [Join Game](${gameUrl})`,
                    thumbnail: icon ? { url: icon } : undefined,
                    image: icon ? { url: icon } : undefined
                }
            ]
        });

        // 💾 mark as registered
        registered[placeId] = true;
        save();

        console.log("Registered game:", placeId);

        res.json({ ok: true });
    } catch (e) {
        console.log("Error:", e.message);
        res.json({ ok: false });
    }
});

// 🚀 START SERVER
app.listen(3000, () => {
    console.log("Tracker running on port 3000");
});

client.login(TOKEN);
