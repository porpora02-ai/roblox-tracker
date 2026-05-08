const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

// ===== LOAD GAMES =====
const FILE = "./games.json";

function loadGames() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE));
        }
    } catch {}

    return {};
}

function saveGames(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

let games = loadGames();

// ===== WEBSITE FILES =====
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});

// ===== GET GAMES =====
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

// ===== UPDATE GAMES =====
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

// ===== START =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🌙 LunarX running on port", PORT);
});
