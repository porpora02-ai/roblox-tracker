const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

const FILE = "./games.json";

// LOAD DATABASE
function loadGames() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE));
        }
    } catch {}

    return {};
}

// SAVE DATABASE
function saveGames(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

let games = loadGames();

// WEBSITE
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});

// SEND GAMES TO WEBSITE
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

// ROBLOX SENDS DATA HERE
app.post("/update", (req, res) => {

    const {
        placeId,
        name,
        players,
        icon,
        creator
    } = req.body;

    if (!placeId) {
        return res.json({ ok: false });
    }

    games[placeId] = {
        placeId,
        name,
        players,
        icon,
        creator,
        updated: Date.now()
    };

    saveGames(games);

    console.log("Updated:", name);

    res.json({ ok: true });
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🌙 LunarX Tracker Running");
});
