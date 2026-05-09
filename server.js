const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const FILE = path.join(__dirname, "games.json");

/* SAFE LOAD */
function loadGames() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE, "utf8"));
        }
    } catch (e) {
        console.log("Load error:", e);
    }
    return {};
}

function saveGames(data) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("Save error:", e);
    }
}

let games = loadGames();
let commands = [];

/* STATIC FILES */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});

/* GAMES */
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

/* UPDATE FROM ROBLOX */
app.post("/update", (req, res) => {
    const { placeId, name, players, icon, creator } = req.body;

    if (!placeId) return res.json({ ok: false });

    games[placeId] = {
        placeId,
        name,
        players: players || 0,
        icon: icon || "",
        creator: creator || "Unknown",
        updated: Date.now()
    };

    saveGames(games);

    res.json({ ok: true });
});

/* COMMANDS */
app.post("/command", (req, res) => {
    const { placeId, cmd, target } = req.body;

    if (!placeId || !cmd) return res.json({ ok: false });

    commands.push({ placeId, cmd, target });

    res.json({ ok: true });
});

app.get("/commands", (req, res) => {
    const { placeId } = req.query;

    const list = commands.filter(c => c.placeId == placeId);

    commands = commands.filter(c => c.placeId != placeId);

    res.json(list);
});

/* CLEANUP */
setInterval(() => {
    const now = Date.now();

    for (const id in games) {
        if (!games[id].players || games[id].players <= 0) {
            delete games[id];
        } else if (now - games[id].updated > 15000) {
            delete games[id];
        }
    }

    saveGames(games);
}, 5000);

/* IMPORTANT RENDER FIX */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("LunarX running on", PORT);
});
