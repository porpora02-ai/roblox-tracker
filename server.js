const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

const FILE = "./games.json";

// LOAD
function loadGames() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE));
        }
    } catch {}

    return {};
}

// SAVE
function saveGames(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

let games = loadGames();

// WEBSITE FILES
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});

// GET GAMES
app.get("/games", (req, res) => {
    res.json(Object.values(games));
});

// UPDATE FROM ROBLOX
app.post("/update", async (req, res) => {

    try {

        const { placeId, players } = req.body;

        if (!placeId) {
            return res.json({ ok: false });
        }

        // FETCH GAME INFO
        const gameRes = await fetch(
            `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
        );

        const gameData = await gameRes.json();

        const info = gameData[0];

        // FETCH ICON
        const thumbRes = await fetch(
            `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
        );

        const thumbData = await thumbRes.json();

        const icon =
            thumbData?.data?.[0]?.imageUrl || "";

        games[placeId] = {

            placeId,

            players,

            name:
                info?.name || "Unknown Game",

            creator:
                info?.builder || "Unknown",

            icon,

            updated: Date.now()
        };

        saveGames(games);

        console.log("Updated:", info?.name);

        res.json({ ok: true });

    } catch (err) {

        console.log(err);

        res.json({ ok: false });
    }
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🌙 LunarX Running");
});
