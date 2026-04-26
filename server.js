const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const WEBHOOK = "https://discord.com/api/webhooks/1498019226781487214/rdMl22CBYIZvEmVbnLb7hja3Qb2FVVBpms8kokNYS-tFGdnScSG38Z_5uH77xBbl-TJk";

let lastData = {};

function sendToDiscord(data) {
    const gameLink = `https://www.roblox.com/games/${data.placeId}`;

    axios.post(WEBHOOK, {
        content:
`🎮 Roblox Server Update
📛 Game: **${data.name || "Unknown"}**
👥 Players: **${data.players}**
🔗 Join Game: ${gameLink}
🆔 PlaceId: ${data.placeId}`
    }).catch(console.log);
}

app.post("/report", (req, res) => {
    const { placeId, name, players } = req.body;

    // 🧠 FIX: prevent duplicate spam
    const key = placeId;
    const newData = `${players}`;

    if (lastData[key] === newData) {
        return res.json({ ok: false, skipped: true });
    }

    lastData[key] = newData;

    console.log("Tracked:", req.body);

    sendToDiscord(req.body);

    res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Tracker running");
});
