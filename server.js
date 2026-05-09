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

/* REMOVE DEAD SERVERS */
setInterval(() => {
    const now = Date.now();

    for (const id in games) {
        if (now - games[id].updated > 20000) {
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

/* GAME DATA */
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

/* ROBLOX UPDATE */
app.post("/update", (req, res) => {
    const { placeId, name, players, icon, creator } = req.body;

    if (!placeId) return res.json({ ok: false });

    games[placeId] = {
        placeId,
        name: name || "Unknown",
        players: players || 0,
        icon: icon || "",
        creator: creator || "Unknown",
        updated: Date.now()
    };

    saveGames(games);

    console.log("UPDATED:", name, players);

    res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🌙 LunarX running");
});
