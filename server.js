const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= ENV =================
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ================= TRACKER FILE =================
const FILE = "./games.json";

// ================= LOAD/SAVE =================
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

// ================= DISCORD CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot ready:", client.user.tag);
});

// ================= SLASH COMMAND =================
const commands = [
    new SlashCommandBuilder()
        .setName("execute")
        .setDescription("Execute a command on a player")
        .addStringOption(opt =>
            opt.setName("command")
                .setDescription("organator")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("player")
                .setDescription("Player name")
                .setRequired(true)
        )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// register slash commands
async function registerCommands() {
    try {
        console.log("🔄 Registering commands...");

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log("✅ Commands registered");
    } catch (err) {
        console.log("❌ Command error:", err);
    }
}

// ================= HANDLE SLASH COMMAND =================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "execute") {

        const command = interaction.options.getString("command");
        const player = interaction.options.getString("player");

        // ONLY allow organator (your requested command)
        if (command.toLowerCase() !== "organator") {
            return interaction.reply({
                content: "❌ Unknown command. Only 'organator' is allowed.",
                ephemeral: true
            });
        }

        lastCommand = {
            action: "organator",
            player,
            time: Date.now()
        };

        return interaction.reply(
            `✅ Organator executed on **${player}**`
        );
    }
});

// ================= GAME NAME =================
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

// ================= GAME ICON =================
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

        let msg = null;
        let existing = games[placeId];

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

// ================= ROBLOX FETCH =================
app.get("/getCommand", (req, res) => {
    if (!lastCommand) return res.json(null);

    const cmd = lastCommand;
    lastCommand = null;

    res.json(cmd);
});

// ================= ROOT =================
app.get("/", (req, res) => {
    res.send("Roblox Tracker Running");
});

// ================= START =================
app.listen(process.env.PORT || 3000, async () => {
    console.log("🚀 Server running");

    if (TOKEN && CLIENT_ID && GUILD_ID) {
        await registerCommands();
        client.login(TOKEN);
    }
});
