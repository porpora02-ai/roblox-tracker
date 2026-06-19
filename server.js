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

// Command queue: { placeId -> [ { id, code, status, output, timestamp } ] }
const commandQueues = {};

function getQueue(placeId) {
    if (!commandQueues[placeId]) commandQueues[placeId] = [];
    return commandQueues[placeId];
}

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

// ─── DEVELOPER PANEL ENDPOINTS ────────────────────────────────────────────────

// Web sends a command to run on a specific game server
// POST /execute  { placeId, code }
app.post("/execute", (req, res) => {
    const { placeId, code } = req.body;

    if (!placeId || !code) {
        return res.json({ ok: false, error: "Missing placeId or code" });
    }

    // Basic safety: block obvious destructive patterns
    const blocked = [
        /game\s*:\s*Shutdown/i,
        /players\s*:\s*KickAllPlayers/i,
        /os\.execute/i,
        /io\./i,
    ];

    for (const pattern of blocked) {
        if (pattern.test(code)) {
            return res.json({ ok: false, error: "Command blocked by safety filter" });
        }
    }

    const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = { id, code, status: "pending", output: null, timestamp: Date.now() };

    getQueue(placeId).push(entry);

    // Keep queue tidy — max 50 commands per game
    const q = getQueue(placeId);
    if (q.length > 50) q.splice(0, q.length - 50);

    console.log(`[DevPanel] Queued command for ${placeId}: ${code}`);
    res.json({ ok: true, id });
});

// Roblox server script polls this for pending commands
// GET /poll?placeId=xxx
app.get("/poll", (req, res) => {
    const { placeId } = req.query;
    if (!placeId) return res.json({ commands: [] });

    const q = getQueue(placeId);
    const pending = q.filter(c => c.status === "pending");

    // Mark them as sent so they aren't returned again
    pending.forEach(c => c.status = "sent");

    res.json({ commands: pending.map(c => ({ id: c.id, code: c.code })) });
});

// Roblox server script reports result back
// POST /result  { placeId, id, output }
app.post("/result", (req, res) => {
    const { placeId, id, output } = req.body;
    if (!placeId || !id) return res.json({ ok: false });

    const q = getQueue(placeId);
    const cmd = q.find(c => c.id === id);

    if (cmd) {
        cmd.status = "done";
        cmd.output = output ?? "(no output)";
        console.log(`[DevPanel] Result for ${id}:`, cmd.output);
    }

    res.json({ ok: true });
});

// Web panel polls for result
// GET /result?placeId=xxx&id=xxx
app.get("/result", (req, res) => {
    const { placeId, id } = req.query;
    if (!placeId || !id) return res.json({ status: "unknown" });

    const q = getQueue(placeId);
    const cmd = q.find(c => c.id === id);

    if (!cmd) return res.json({ status: "unknown" });
    res.json({ status: cmd.status, output: cmd.output });
});

// ─── START ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🌙 LunarX Running on port", PORT);
});
