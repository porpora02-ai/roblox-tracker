const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

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

/* COMMAND SYSTEM */
let commands = [];

/* CLEANUP SYSTEM (FIX FOR 0 PLAYERS STUCK GAMES) */
setInterval(() => {
    const now = Date.now();

    for (const id in games) {
        const g = games[id];

        if (!g.players || g.players <= 0) {
            delete games[id];
        } else if (now - g.updated > 15000) {
            delete games[id];
        }
    }

    saveGames(games);
}, 5000);

/* WEBSITE FILES */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});

/* GAME LIST */
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

/* ROBLOX UPDATE */
app.post("/update", (req, res) => {
    const { placeId, name, players, icon, creator } = req.body;

    if (!placeId) return res.json({ ok: false });

    games[placeId] = {
        placeId,
        name,
        players,
        icon,
        creator,
        updated: Date.now()
    };

    saveGames(games);

    res.json({ ok: true });
});

/* SEND COMMAND */
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

/* ROBLOX FETCH COMMANDS */
app.get("/commands", (req, res) => {
    const { placeId } = req.query;

    const filtered = commands.filter(c => c.placeId == placeId);

    commands = commands.filter(c => c.placeId != placeId);

    res.json(filtered);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌙 LunarX running"));
