const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GXzTbk.xNHNOXeV5tjIXjT4C_uty4u3Tug4P4oKCU-DQU;
const CHANNEL_ID = process.env.1498019171789705279;

const FILE = "./games.json";

// ===== SAFE LOAD =====
function loadGames() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE));
        }
    } catch {}
    return {};
}

function saveGames(data) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch {}
}

// ===== MEMORY =====
const creating = {};
const nameCache = {};
let lastCommand = null;

// ===== DISCORD =====
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot ready");
});

if (TOKEN) {
    client.login(TOKEN).catch(() => {
        console.log("❌ Invalid token");
    });
} else {
    console.log("⚠️ TOKEN missing");
}

// ===== NAME =====
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

// ===== ICON =====
async function getGameIcon(placeId) {
    try {
        const res = await axios.get(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );
        return res.data?.data?.[0]?.imageUrl || null;
    } catch {
        return null;
    }
}

// ===== SAFE MESSAGE =====
async function getMessage(channel, id) {
    try {
        return await channel.messages.fetch(id);
    } catch {
        return null;
    }
}

// ===== TRACKER =====
app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok: false });

        const { placeId, players } = req.body;
        if (!placeId) return res.json({ ok: false });

        let games = loadGames();

        const channel = await client.channels.fetch(CHANNEL_ID);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;
        const gameName = await getGameName(placeId);
        const icon = await getGameIcon(placeId);

        let msg = null;

        if (games[placeId]?.messageId) {
            msg = await getMessage(channel, games[placeId].messageId);
        }

        // CREATE
        if (!msg) {
            if (creating[placeId]) return res.json({ ok: true });

            creating[placeId] = true;

            const newMsg = await channel.send({
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

            games[placeId] = { messageId: newMsg.id };
            saveGames(games);

            creating[placeId] = false;

            return res.json({ ok: true });
        }

        // UPDATE
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

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ REPORT ERROR:", err.message);
        res.json({ ok: false });
    }
});

// ===== EXECUTE =====
app.post("/execute", (req, res) => {
    try {
        const { action, player } = req.body;

        if (!action || !player) {
            return res.json({ ok: false });
        }

        lastCommand = {
            action,
            player,
            time: Date.now()
        };

        res.json({ ok: true });

    } catch {
        res.json({ ok: false });
    }
});

// ===== GET COMMAND =====
app.get("/getCommand", (req, res) => {
    if (!lastCommand) return res.json({});
    const cmd = lastCommand;
    lastCommand = null;
    res.json(cmd);
});

// ===== ROOT =====
app.get("/", (req, res) => {
    res.send("RUNNING");
});

// ===== START =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running");
});
