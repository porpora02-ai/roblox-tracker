const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GDrSXm.inJS80ZyXz1ldSxxqCBbqU74wuw_ovECnUouPo";
const CHANNEL_ID = "1498019172737876240";

const FILE = "./messages.json";

// load saved messages
let messages = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE))
    : {};

function save() {
    fs.writeFileSync(FILE, JSON.stringify(messages, null, 2));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

function gameLink(placeId) {
    return `https://www.roblox.com/games/${placeId}`;
}

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

client.once("ready", () => {
    console.log("Bot ready");
});

// 🔥 CORE SYSTEM
async function handleGame(data) {
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

    // 🔍 CLEAN DUPLICATES FIRST
    const recent = await channel.messages.fetch({ limit: 50 });

    const duplicates = recent.filter(msg =>
        msg.author.id === client.user.id &&
        msg.embeds[0] &&
        msg.embeds[0].description &&
        msg.embeds[0].description.includes(data.placeId.toString())
    );

    // keep only one
    let mainMessage = null;

    if (duplicates.size > 0) {
        mainMessage = duplicates.first();

        // delete extras
        let i = 0;
        duplicates.forEach(msg => {
            if (i === 0) {
                messages[data.placeId] = msg.id;
                i++;
            } else {
                msg.delete().catch(() => {});
            }
        });

        save();
    }

    // 🔁 EDIT EXISTING
    if (messages[data.placeId]) {
        try {
            const msg = await channel.messages.fetch(messages[data.placeId]);
            await msg.edit({ embeds: [embed] });
            return;
        } catch {
            delete messages[data.placeId];
            save();
        }
    }

    // 🆕 CREATE ONLY IF NONE EXISTS
    const msg = await channel.send({ embeds: [embed] });
    messages[data.placeId] = msg.id;
    save();
}

// 📡 ROBLOX → SERVER
app.post("/report", async (req, res) => {
    try {
        await handleGame(req.body);
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
