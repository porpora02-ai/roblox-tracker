const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GULBam.8pRljKPamJ33FBT8kK0epT2cnutlgYGnSckj8E";
const CHANNEL_ID = "1498019171789705279";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// 🔴 STORE MESSAGE IDS (in memory)
let messages = {};

// 🔥 ROBLOX ICON
async function getIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );
        return res.data.data[0]?.imageUrl || null;
    } catch {
        return null;
    }
}

function gameLink(placeId) {
    return `https://www.roblox.com/games/${placeId}`;
}

client.once("ready", () => {
    console.log("Bot ready");
});

// 🔥 CORE FIX FUNCTION
async function updateDiscord(data) {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const icon = await getIcon(data.placeId);

    const embed = {
        title: data.name || "Unknown Game",
        color: 0x00ffcc,
        thumbnail: icon ? { url: icon } : undefined,
        description:
`👥 Players: ${data.players}
🔗 Join: ${gameLink(data.placeId)}
🆔 ${data.placeId}`
    };

    try {
        // IF MESSAGE EXISTS → EDIT
        if (messages[data.placeId]) {
            const msg = await channel.messages.fetch(messages[data.placeId]);
            await msg.edit({ embeds: [embed] });
            return;
        }
    } catch {
        // message might have been deleted → recreate
        delete messages[data.placeId];
    }

    // IF NOT FOUND → CREATE ONCE
    const newMsg = await channel.send({ embeds: [embed] });
    messages[data.placeId] = newMsg.id;
}

// 📡 ROBLOX → SERVER
app.post("/report", async (req, res) => {
    try {
        await updateDiscord(req.body);
        res.json({ ok: true });
    } catch (e) {
        console.log(e.message);
        res.json({ ok: false });
    }
});

app.listen(3000, () => {
    console.log("Tracker running");
});

client.login(TOKEN);
