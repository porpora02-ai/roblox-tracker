const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const FILE = path.join(__dirname, "games.json");

function loadGames() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE, "utf8"));
        }
    } catch (e) {
        console.log("load error:", e);
    }
    return {};
}

function saveGames(data) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("save error:", e);
    }
}

let games = loadGames();
let commands = [];

/* =========================
   STATIC FILES
========================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});

/* =========================
   GAMES
========================= */

app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

/* =========================
   UPDATE FROM ROBLOX
========================= */

app.post("/update", (req, res) => {

    const data = req.body;

    if (!data.placeId) {
        return res.json({ ok: false });
    }

    games[data.placeId] = {

        placeId: data.placeId,
        name: data.name || "Unknown",
        players: data.players || 0,
        creator: data.creator || "Unknown",

        // 🔥 FIXED: always safe array
        playerList: Array.isArray(data.playerList)
            ? data.playerList
            : [],

        updated: Date.now()
    };

    saveGames(games);

    res.json({ ok: true });
});

/* =========================
   COMMAND SYSTEM
========================= */

app.post("/command", (req, res) => {

    const { placeId, cmd, target } = req.body;

    if (!placeId || !cmd) return res.json({ ok: false });

    commands.push({
        placeId,
        cmd,
        target,
        id: Date.now()
    });

    res.json({ ok: true });
});

app.get("/commands", (req, res) => {

    const { placeId } = req.query;

    const list = commands.filter(c => c.placeId == placeId);

    commands = commands.filter(c => c.placeId != placeId);

    res.json(list);
});

/* =========================
   IMPORTANT (NO GAME DELETION)
========================= */

// 🔥 intentionally disabled so games NEVER disappear
setInterval(() => {
    // nothing here
}, 60000);

/* ========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("LunarX running on", PORT);
});
