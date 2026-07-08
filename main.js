const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "vantix-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const GAMES_FILE  = "./data/games.json";
const USERS_FILE  = "./data/users.json";
const TOKENS_FILE = "./data/tokens.json";
const CMDS_FILE   = "./data/commands.json";

if (!fs.existsSync("./data")) fs.mkdirSync("./data");

function readJSON(file, def = {}) {
    try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file)); } catch {}
    return def;
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let games    = readJSON(GAMES_FILE, {});
let users    = readJSON(USERS_FILE, {});
let tokens   = readJSON(TOKENS_FILE, {});
let commands = readJSON(CMDS_FILE, {});

const TIERS = {
    none:         { label: "None",           maxPlayers: 0        },
    bronze:       { label: "🥉 Bronze",       maxPlayers: 10       },
    silver:       { label: "🥈 Silver",       maxPlayers: 80       },
    gold:         { label: "🥇 Gold",         maxPlayers: 100      },
    diamond:      { label: "💠 Diamond",      maxPlayers: 150      },
    platinum:     { label: "👑 Platinum",     maxPlayers: 500      },
    early_access: { label: "🚀 Early Access", maxPlayers: 0, earlyOnly: true },
    elite:        { label: "🔥 Elite",        maxPlayers: 1000     },
    absolute:     { label: "🌌 Absolute",     maxPlayers: Infinity }
};

const OWNER = "dr.muffinn";

function getUser(req) {
    return req.session.username ? users[req.session.username] : null;
}

function gamesForTier(tierKey) {
    const tier = TIERS[tierKey];
    if (!tier) return [];
    const all = Object.values(games);
    if (tierKey === "absolute") return all;
    if (tierKey === "early_access") return all.filter(g => g.earlyAccess);
    return all.filter(g => !g.earlyAccess && g.players < tier.maxPlayers);
}

function requireLogin(req, res, next) {
    if (!req.session.username) return res.status(401).json({ ok: false, error: "Not logged in" });
    next();
}
function requireOwner(req, res, next) {
    if (req.session.username !== OWNER) return res.status(403).json({ ok: false, error: "Forbidden" });
    next();
}

// STATIC FILES — serve from root
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/app.js", (req, res) => res.sendFile(path.join(__dirname, "app.js")));

// AUTH
app.post("/api/signup", async (req, res) => {
    const { email, username, password, dob } = req.body;
    if (!email || !username || !password || !dob)
        return res.json({ ok: false, error: "All fields required" });
    if (users[username])
        return res.json({ ok: false, error: "Username already taken" });
    if (Object.values(users).find(u => u.email === email))
        return res.json({ ok: false, error: "Email already in use" });
    const hash = await bcrypt.hash(password, 10);
    users[username] = { email, username, password: hash, dob, tier: "none", joinedAt: Date.now() };
    writeJSON(USERS_FILE, users);
    req.session.username = username;
    res.json({ ok: true, username, tier: "none" });
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user) return res.json({ ok: false, error: "Invalid username or password" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ ok: false, error: "Invalid username or password" });
    req.session.username = username;
    res.json({ ok: true, username, tier: user.tier, isOwner: username === OWNER });
});

app.post("/api/logout", (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get("/api/me", (req, res) => {
    const user = getUser(req);
    if (!user) return res.json({ ok: false });
    res.json({ ok: true, username: user.username, tier: user.tier, isOwner: user.username === OWNER });
});

// GAMES
app.get("/api/games", requireLogin, (req, res) => {
    const user = getUser(req);
    res.json(gamesForTier(user.tier));
});

// JOIN TOKEN
app.post("/api/join", requireLogin, (req, res) => {
    const { placeId } = req.body;
    if (!placeId) return res.json({ ok: false });
    const user = getUser(req);
    const allowed = gamesForTier(user.tier);
    if (!allowed.find(g => g.placeId === placeId))
        return res.json({ ok: false, error: "Your tier does not include this game" });
    const token = uuidv4();
    tokens[token] = { username: user.username, placeId, createdAt: Date.now(), used: false };
    const now = Date.now();
    Object.keys(tokens).forEach(k => { if (now - tokens[k].createdAt > 600000) delete tokens[k]; });
    writeJSON(TOKENS_FILE, tokens);
    res.json({ ok: true, token, placeId });
});

// ROBLOX UPDATE
app.post("/api/update", async (req, res) => {
    try {
        const { placeId, players, name, creator, earlyAccess } = req.body;
        if (!placeId) return res.json({ ok: false });
        let icon = "";
        try {
            const r = await fetch(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`);
            const d = await r.json();
            icon = d?.data?.[0]?.imageUrl || "";
        } catch {}
        games[placeId] = { placeId, players: Number(players) || 0, name: name || "Unknown", creator: creator || "Unknown", icon, earlyAccess: earlyAccess === true || earlyAccess === "true", updated: Date.now() };
        writeJSON(GAMES_FILE, games);
        res.json({ ok: true });
    } catch { res.json({ ok: false }); }
});

// VALIDATE TOKEN
app.post("/api/validate-token", (req, res) => {
    const { token, placeId } = req.body;
    if (!token || !placeId) return res.json({ ok: false });
    const t = tokens[token];
    if (!t || t.used || t.placeId !== placeId || Date.now() - t.createdAt > 600000) return res.json({ ok: false });
    t.used = true;
    writeJSON(TOKENS_FILE, tokens);
    res.json({ ok: true, username: t.username });
});

// SCRIPT EXECUTION
app.post("/api/execute", requireLogin, (req, res) => {
    const { placeId, code } = req.body;
    if (!placeId || !code) return res.json({ ok: false });
    const user = getUser(req);
    const id = uuidv4();
    if (!commands[placeId]) commands[placeId] = [];
    commands[placeId].push({ id, code, status: "pending", output: null, requestedBy: user.username, ts: Date.now() });
    if (commands[placeId].length > 50) commands[placeId] = commands[placeId].slice(-50);
    writeJSON(CMDS_FILE, commands);
    res.json({ ok: true, id });
});

app.get("/api/poll", (req, res) => {
    const { placeId } = req.query;
    if (!placeId) return res.json({ commands: [] });
    const q = (commands[placeId] || []).filter(c => c.status === "pending");
    q.forEach(c => c.status = "sent");
    writeJSON(CMDS_FILE, commands);
    res.json({ commands: q.map(c => ({ id: c.id, code: c.code })) });
});

app.post("/api/result", (req, res) => {
    const { placeId, id, output } = req.body;
    if (!placeId || !id) return res.json({ ok: false });
    const cmd = (commands[placeId] || []).find(c => c.id === id);
    if (cmd) { cmd.status = "done"; cmd.output = output || "(no output)"; }
    writeJSON(CMDS_FILE, commands);
    res.json({ ok: true });
});

app.get("/api/result", requireLogin, (req, res) => {
    const { placeId, id } = req.query;
    if (!placeId || !id) return res.json({ status: "unknown" });
    const cmd = (commands[placeId] || []).find(c => c.id === id);
    if (!cmd) return res.json({ status: "unknown" });
    res.json({ status: cmd.status, output: cmd.output });
});

// OWNER PANEL
app.get("/api/owner/users", requireOwner, (req, res) => {
    res.json(Object.values(users).map(u => ({ username: u.username, email: u.email, tier: u.tier, joinedAt: u.joinedAt })));
});

app.post("/api/owner/set-tier", requireOwner, (req, res) => {
    const { username, tier } = req.body;
    if (!users[username]) return res.json({ ok: false, error: "User not found" });
    if (!TIERS[tier]) return res.json({ ok: false, error: "Invalid tier" });
    users[username].tier = tier;
    writeJSON(USERS_FILE, users);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🟢 Vantix running on port", PORT));
