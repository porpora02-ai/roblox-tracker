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

// SEND GAMES
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

// UPDATE FROM ROBLOX
app.post("/update", async (req, res) => {
    try {
        const { placeId, players, name, creator } = req.body;

        if (!placeId) return res.json({ ok: false });

        let icon = "";
        try {
            const thumbRes = await fetch(
                `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
            );
            const thumbData = await thumbRes.json();
            icon = thumbData?.data?.[0]?.imageUrl || "";
        } catch {}

        games[placeId] = {
            placeId,
            players: Number(players) || 0,
            name: name || "Unknown Game",
            creator: creator || "Unknown Creator",
            icon,
            updated: Date.now()
        };

        saveGames(games);
        console.log("Updated:", games[placeId]);
        res.json({ ok: true });

    } catch (err) {
        console.log(err);
        res.json({ ok: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🌙 LunarX Running on port", PORT);
});
