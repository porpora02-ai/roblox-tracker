const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = "MTQ5ODA0NjY5MDE3Mzc3OTk2OA.GvAONq.oY-JLhgWy0Szk5YY0AGGOZwbfdVSGgdVd6mBRE";
const CHANNEL_ID = "1498019171789705279";

const FILE = "./registeredGames.json";

// load saved games
let registered = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE))
    : {};

function save() {
    fs.writeFileSync(FILE, JSON.stringify(registered, null, 2));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once("ready", () => {
    console.log("Bot ready");
});

// 🔥 GET GAME ICON
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

app.post("/report", async (req, res) => {
    const { placeId, name } = req.body;

    // ❌ already registered → do nothing
    if (registered[placeId]) {
        return res.json({ ok: true, skipped: true });
    }

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        const icon = await getIcon(placeId);

        const gameUrl = `https://www.roblox.com/games/${placeId}`;

        // ✅ SEND LINK (THIS CREATES DISCORD PREVIEW)
        await channel.send({
            content: gameUrl
        });

        // ✅ SEND EMBED (OPTIONAL BUT CLEAN)
        await channel.send({
            embeds: [
                {
                    title: name || "Unknown Game",
                    color: 0x00ffcc,
                    thumbnail: icon ? { url: icon } : undefined
                }
            ]
        });

        // save so it never sends again
        registered[placeId] = true;
        save();

        console.log("Registered:", placeId);

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
