const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔴 PUT YOUR DISCORD WEBHOOK HERE
const WEBHOOK = "https://discord.com/api/webhooks/1498019226781487214/rdMl22CBYIZvEmVbnLb7hja3Qb2FVVBpms8kokNYS-tFGdnScSG38Z_5uH77xBbl-TJk";

app.get("/", (req, res) => {
    res.send("Roblox Tracker Online");
});

// Roblox sends data here
app.post("/report", async (req, res) => {
    const { placeId, name, players } = req.body;

    console.log("Received:", req.body);

    try {
        await axios.post(WEBHOOK, {
            content:
`🎮 Roblox Server Update
📛 Game: ${name}
🆔 PlaceId: ${placeId}
👥 Players: ${players}`
        });

        res.json({ ok: true });
    } catch (err) {
        console.log(err.message);
        res.json({ ok: false });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});