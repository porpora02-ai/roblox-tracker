const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔴 DISCORD WEBHOOK
const WEBHOOK = "YOUR_DISCORD_WEBHOOK";

// 🔴 YOUR RENDER URL (CHANGE IF DIFFERENT)
const BASE_URL = "https://roblox-tracker-v5aq.onrender.com";

let lastSent = {};

app.get("/", (req, res) => {
    res.send("Roblox Tracker Online");
});

app.post("/report", async (req, res) => {
    const { placeId, name, players } = req.body;

    // 🧠 FIX 1: prevent duplicate spam (only send if changed)
    const key = `${placeId}`;

    if (lastSent[key] === players) {
        return res.json({ ok: false, skip: true });
    }

    lastSent[key] = players;

    console.log("Tracked:", req.body);

    try {
        await axios.post(WEBHOOK, {
            content:
`🎮 **Roblox Server Update**
📛 Game: **${name || "Unknown Game"}**
👥 Players: **${players}**
🔗 Link: ${BASE_URL}

🆔 PlaceId: ${placeId}`
        });

        res.json({ ok: true });
    } catch (err) {
        console.log("Discord error:", err.message);
        res.json({ ok: false });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Tracker running");
});
