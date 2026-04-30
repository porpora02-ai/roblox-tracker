const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔴 ENV VARS (Render)
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 📦 DATABASE
const FILE = "./games.json";

let games = {};
if (fs.existsSync(FILE)) {
    games = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(games, null, 2));
}

// 🔒 LOCKS (FIX DUPLICATE MESSAGES)
const creating = {};

// 🧠 NAME CACHE (FIX UNKNOWN GAME ISSUE)
const nameCache = {};

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot ready:", client.user.tag);
});

if (TOKEN) {
    client.login(TOKEN).catch(err => {
        console.log("❌ Login failed:", err.message);
    });
}

// 🔥 GET GAME NAME (ROBLOX UNIVERSAL FIX)
async function getGameName(placeId) {
    try {
        if (nameCache[placeId]) return nameCache[placeId];

        const uni = await axios.get(
            `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
        );

        const universeId = uni.data?.universeId;
        if (!universeId) return "Unknown Game";

        const game = await axios.get(
            `https://games.roblox.com/v1/games?universeIds=${universeId}`
        );

        const name = game.data?.data?.[0]?.name || "Unknown Game";

        nameCache[placeId] = name;
        return name;

    } catch {
        return nameCache[placeId] || "Unknown Game";
    }
}

// 🖼️ GET GAME ICON
async function getGameIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png&isCircular=false`
        );

        return res.data?.data?.[0]?.imageUrl || null;

    } catch {
        return null;
    }
}

// 🌐 ROOT
app.get("/", (req, res) => {
    res.send("TRACKER RUNNING");
});

// 📡 MAIN TRACKER
app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok: false });

        const { placeId, players } = req.body;
        if (!placeId) return res.json({ ok: false });

        const channel = await client.channels.fetch(CHANNEL_ID);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;
        const gameName = await getGameName(placeId);
        const icon = await getGameIcon(placeId);

        // 🧠 FIRST TIME REGISTER (LOCKED TO PREVENT DUPES)
        if (!games[placeId]) {

            if (creating[placeId]) {
                return res.json({ ok: true, skipped: "creating" });
            }

            creating[placeId] = true;

            const msg = await channel.send({
                embeds: [{
                    title: gameName,
                    color: 0x00ffcc,
                    thumbnail: icon ? { url: icon } : null,
                    image: icon ? { url: icon } : null,
                    fields: [
                        { name: "👥 Players", value: String(players), inline: true },
                        { name: "🆔 Place ID", value: String(placeId), inline: true },
                        { name: "🔗 Join", value: gameUrl }
                    ]
                }]
            });

            games[placeId] = {
                messageId: msg.id,
                lastPlayers: -1
            };

            save();
            creating[placeId] = false;

            console.log("🆕 Registered:", placeId);
        }

        // 🔄 UPDATE EXISTING MESSAGE
        const msg = await channel.messages.fetch(games[placeId].messageId);

        await msg.edit({
            embeds: [{
                title: gameName,
                color: 0x00ffcc,
                thumbnail: icon ? { url: icon } : null,
                image: icon ? { url: icon } : null,
                fields: [
                    { name: "👥 Players", value: String(players), inline: true },
                    { name: "🆔 Place ID", value: String(placeId), inline: true },
                    { name: "🔗 Join", value: gameUrl }
                ]
            }]
        });

        games[placeId].lastPlayers = players;
        save();

        console.log("🔄 Updated:", placeId, players);

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ ERROR:", err.message);
        res.json({ ok: false });
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Running on port", PORT);
});
