/* ════════════════════════════════════════════════════════════════════════════
   VANTIX console — client
   Server contract is unchanged; every /api/* call matches the original app.
   ════════════════════════════════════════════════════════════════════════════ */

const $  = id => document.getElementById(id);
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ── state ─────────────────────────────────────────────────────────────── */
let currentUser   = null;
let allGames      = [];
let ownerUsers    = [];
let accountData   = null;
let trackingData  = null;
let favorites     = [];
let settings      = {};
let history       = {};          // placeId -> [player counts]
let activeTab     = "overview";
let viewMode      = "grid";
let gamesLoaded   = false;
let csrfToken     = "";

let gamesTimer = null, trackingTimer = null, ringTimer = null, nextRefreshAt = 0;
let execPlaceId = null, execGameName = "", execHistory = [], execHistoryIx = -1;

let pendingVerifyUsername = "";
let pendingResetUsername  = "";

const TIER_LABELS = {
    none: "No Tier", bronze: "Bronze", silver: "Silver", gold: "Gold",
    diamond: "Diamond", platinum: "Platinum", early_access: "Early Access",
    elite: "Elite", absolute: "Absolute"
};

const TIER_PLANS = [
    { key: "bronze",       mark: "BR", name: "Bronze",       price: "100",   cap: "Under 10 players",   feats: ["Live population", "Favorites & filters"] },
    { key: "silver",       mark: "SI", name: "Silver",       price: "200",   cap: "Under 80 players",   feats: ["Everything in Bronze", "Wider server pool"] },
    { key: "gold",         mark: "GO", name: "Gold",         price: "250",   cap: "Under 100 players",  feats: ["Everything in Silver", "Full stats breakdown"] },
    { key: "diamond",      mark: "DI", name: "Diamond",      price: "350",   cap: "Under 150 players",  feats: ["Everything in Gold", "Busier lobbies"] },
    { key: "platinum",     mark: "PL", name: "Platinum",     price: "800",   cap: "Under 500 players",  feats: ["Everything in Diamond", "High-traffic games"] },
    { key: "early_access", mark: "EA", name: "Early Access", price: "1,200", cap: "Early Access only",  feats: ["Flagged titles first", "Separate from the ladder"] },
    { key: "elite",        mark: "EL", name: "Elite",        price: "1,800", cap: "Under 1,000 players",feats: ["Everything in Platinum", "Near-complete coverage"] },
    { key: "absolute",     mark: "AB", name: "Absolute",     price: "2,500", cap: "No limit",           feats: ["Every tracked game", "Early Access included", "No restrictions"], best: true }
];

const TAB_META = {
    overview:  ["Overview",     "Your account and tracked game tools"],
    games:     ["Tracked games","Live server population, refreshed automatically"],
    favorites: ["Favorites",    "Games you pinned with the star"],
    stats:     ["Stats",        "A live breakdown of every visible server"],
    tracking:  ["Tracking",     "Bind the Roblox username Vantix watches for"],
    profile:   ["Profile",      "Your Vantix account details"],
    security:  ["Security",     "Account details, verification and password"],
    settings:  ["Settings",     "Saved in this browser only"],
    upgrade:   ["Upgrade",      "Unlock more of the tracked pool"],
    help:      ["Help",         "Tiers, tracking and verification"],
    owner:     ["Owner panel",  "Manage user tiers"]
};

/* ── tiny helpers ──────────────────────────────────────────────────────── */
function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

function fmt(n) {
    const v = Number(n) || 0;
    return v >= 1000 ? v.toLocaleString() : String(v);
}

function relativeDate(value) {
    if (!value) return "Unknown";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function icon(name) {
    const P = {
        check:  '<polyline points="20 6 9 17 4 12"/>',
        star:   '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        play:   '<polygon points="5 3 19 12 5 21 5 3"/>',
        copy:   '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        alert:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        info:   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        x:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        grid:   '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        gamepad:'<rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/>',
        chart:  '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
        target: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>',
        user:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        lock:   '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        gear:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        up:     '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
        help:   '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        out:    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
        bolt:   '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        palette:'<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.8-10-8.8z"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.info}</svg>`;
}

/* ── network ───────────────────────────────────────────────────────────── */
async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const res = await fetch("/api/csrf");
    const data = await res.json();
    csrfToken = data.token || "";
    return csrfToken;
}

async function postJson(url, body) {
    const send = async token => fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body || {})
    });
    let res = await send(await getCsrfToken());
    if (res.status === 403) {
        csrfToken = "";
        res = await send(await getCsrfToken());
    }
    return res;
}

/* ── settings ──────────────────────────────────────────────────────────── */
const SETTINGS_KEY  = "vantix.settings";
const FAVORITES_KEY = "vantix.favorites";
const VIEW_KEY      = "vantix.view";

const DEFAULT_SETTINGS = {
    cursorGlow: true, bgEffects: true, animations: true,
    accent: "green", surface: "void", density: "comfortable",
    autoRefresh: true, refreshInterval: 5000,
    sort: "players-asc", hideEmpty: false, favoritesFirst: true,
    sparklines: true
};

function loadSettings() {
    try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch { settings = { ...DEFAULT_SETTINGS }; }
    try {
        favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        if (!Array.isArray(favorites)) favorites = [];
    } catch { favorites = []; }
    try { viewMode = localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"; } catch {}
}

const persistSettings  = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };
const persistFavorites = () => { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch {} };

function applySettings() {
    const root = document.documentElement;
    root.setAttribute("data-accent", settings.accent || "green");
    root.setAttribute("data-surface", settings.surface || "void");
    root.setAttribute("data-density", settings.density || "comfortable");
    root.classList.toggle("no-animations", !settings.animations);
    root.classList.toggle("no-bg-effects", !settings.bgEffects);
    const glow = $("cursorGlow");
    if (glow) glow.style.display = settings.cursorGlow ? "block" : "none";
}

function syncSettingsControls() {
    const set = (id, prop, value) => { const el = $(id); if (el) el[prop] = value; };
    set("setCursorGlow", "checked", settings.cursorGlow);
    set("setBgEffects", "checked", settings.bgEffects);
    set("setAnimations", "checked", settings.animations);
    set("setAutoRefresh", "checked", settings.autoRefresh);
    set("setHideEmpty", "checked", settings.hideEmpty);
    set("setFavoritesFirst", "checked", settings.favoritesFirst);
    set("setSparklines", "checked", settings.sparklines);
    set("setRefreshInterval", "value", String(settings.refreshInterval));
    set("setSort", "value", settings.sort);
    set("setDensity", "value", settings.density);
    set("setSurface", "value", settings.surface);
    qsa(".accent-swatch").forEach(el => el.classList.toggle("active", el.dataset.accent === settings.accent));
    syncFilterChips();
}

const SORT_LABELS = {
    "players-asc": "Fewest players", "players-desc": "Most players",
    "name-asc": "Name A–Z", "name-desc": "Name Z–A"
};

function syncFilterChips() {
    const sl = $("sortChipLabel");
    if (sl) sl.textContent = SORT_LABELS[settings.sort] || SORT_LABELS["players-asc"];
    $("emptyChip")?.classList.toggle("on", !!settings.hideEmpty);
    $("favFirstChip")?.classList.toggle("on", !!settings.favoritesFirst);
    $("viewGrid")?.classList.toggle("on", viewMode === "grid");
    $("viewList")?.classList.toggle("on", viewMode === "list");
    const rs = $("statusRefresh");
    if (rs) rs.textContent = settings.autoRefresh ? `Every ${Math.round(settings.refreshInterval / 1000)}s` : "Paused";
}

function updateSetting(key, value) {
    settings[key] = value;
    persistSettings();
    applySettings();
    if (key === "autoRefresh" || key === "refreshInterval") restartGamesTimer();
    if (["sort", "hideEmpty", "favoritesFirst", "density", "sparklines"].includes(key)) {
        renderGames(); renderFavorites();
    }
    syncFilterChips();
}

function resetSettings() {
    settings = { ...DEFAULT_SETTINGS };
    persistSettings(); applySettings(); syncSettingsControls(); restartGamesTimer();
    renderGames(); renderFavorites();
    setFormStatus("settingsStatus", "Settings restored to defaults.", "ok");
    toast("ok", "Settings reset", "Everything is back to the defaults.");
}

function clearFavorites() {
    favorites = [];
    persistFavorites(); renderGames(); renderFavorites();
    setFormStatus("settingsStatus", "Favorites cleared.", "ok");
    toast("ok", "Favorites cleared", "Your pinned games have been removed from this device.");
}

/* ── status text ───────────────────────────────────────────────────────── */
function setFormStatus(id, message, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("ok", "error", "hidden");
    if (!message) { el.classList.add("hidden"); return; }
    if (kind) el.classList.add(kind);
}

function showError(id, message) {
    const el = $(id);
    if (!el) return;
    if (!message) { el.classList.add("hidden"); el.textContent = ""; return; }
    el.textContent = message;
    el.classList.remove("hidden");
}

/* ── toasts ────────────────────────────────────────────────────────────── */
function toast(kind, title, message, duration = 4200) {
    const host = $("toastHost");
    if (!host) return;
    const ico = { ok: "check", error: "alert", warn: "alert", info: "info" }[kind] || "info";
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.style.setProperty("--dur", duration + "ms");
    el.innerHTML =
        `<span class="toast-ico">${icon(ico)}</span>` +
        `<div class="toast-body"><strong>${escapeHtml(title)}</strong>` +
        (message ? `<p>${escapeHtml(message)}</p>` : "") + `</div>` +
        `<button class="toast-x" aria-label="Dismiss">${icon("x")}</button>`;
    const close = () => {
        el.classList.add("out");
        setTimeout(() => el.remove(), 280);
    };
    qs(".toast-x", el).addEventListener("click", close);
    host.appendChild(el);
    setTimeout(close, duration);
    while (host.children.length > 4) host.firstElementChild.remove();
}

/* ── confirm dialog ────────────────────────────────────────────────────── */
function confirmDialog({ title, message, confirm = "Confirm", cancel = "Cancel", ico = "alert" }) {
    return new Promise(resolve => {
        const host = $("dialogHost");
        const scrim = document.createElement("div");
        scrim.className = "dialog-scrim";
        scrim.innerHTML =
            `<div class="dialog" role="dialog" aria-modal="true">
                <div class="dialog-ico">${icon(ico)}</div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-r="0">${escapeHtml(cancel)}</button>
                    <button class="btn btn-primary" data-r="1">${escapeHtml(confirm)}</button>
                </div>
            </div>`;
        const done = v => { scrim.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
        const onKey = e => { if (e.key === "Escape") done(false); };
        scrim.addEventListener("click", e => {
            if (e.target === scrim) return done(false);
            const b = e.target.closest("[data-r]");
            if (b) done(b.dataset.r === "1");
        });
        document.addEventListener("keydown", onKey);
        host.appendChild(scrim);
        qs('[data-r="1"]', scrim).focus();
    });
}

/* ── routing ───────────────────────────────────────────────────────────── */
function showPage(id) {
    qsa(".page").forEach(p => p.classList.add("hidden"));
    $(id)?.classList.remove("hidden");
    window.scrollTo(0, 0);
}

function isOwnerAccount() {
    return !!currentUser && currentUser.username === "dr.muffinn_09" && currentUser.isOwner === true;
}

function switchTab(tab) {
    if (tab === "owner" && !isOwnerAccount()) return switchTab("overview");
    if (!$("tab-" + tab)) return;
    activeTab = tab;

    qsa(".tab-content").forEach(t => t.classList.add("hidden"));
    $("tab-" + tab).classList.remove("hidden");
    qsa(".side-nav .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    qsa("#mobilebar button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

    const meta = TAB_META[tab];
    if (meta) { $("topTitle").textContent = meta[0]; $("topSub").textContent = meta[1]; }

    closeSidebar();

    if (tab === "owner")    loadOwnerUsers();
    if (tab === "tracking") loadTracking();
    if (tab === "security") loadAccount();
    if (tab === "favorites") renderFavorites();
    if (tab === "stats")    renderStats();
    if (tab === "settings") syncSettingsControls();
    if (tab === "upgrade")  renderUpgrade();
    if (tab === "games")    setTimeout(() => $("gameSearch")?.focus(), 60);
}

function openSidebar()  { $("sidebar")?.classList.add("open");  $("sidebarScrim")?.classList.add("on"); }
function closeSidebar() { $("sidebar")?.classList.remove("open"); $("sidebarScrim")?.classList.remove("on"); }

/* ── auth ──────────────────────────────────────────────────────────────── */
async function doSignup() {
    const btn = $("signupBtn");
    const body = {
        email: $("su-email").value.trim(),
        username: $("su-username").value.trim(),
        password: $("su-password").value,
        dob: $("su-dob").value,
        robloxUsername: $("su-roblox").value.trim().replace(/^@/, "")
    };
    btn.disabled = true; btn.textContent = "Checking Roblox…";
    try {
        const data = await (await postJson("/api/signup", body)).json();
        if (data.ok) {
            showError("signupError", "");
            pendingVerifyUsername = data.username;
            openVerifyPage(data);
            toast("ok", "Account created", "One more step — verify your Roblox profile.");
        } else {
            showError("signupError", data.error);
        }
    } catch {
        showError("signupError", "Could not reach the server. Try again.");
    }
    btn.disabled = false; btn.textContent = "Create account";
}

async function doLogin() {
    const username = $("li-username").value.trim();
    const password = $("li-password").value;
    if (!username || !password) return showError("loginError", "Enter your username and password");
    try {
        const data = await (await postJson("/api/login", { username, password })).json();
        if (data.ok) {
            currentUser = pickUser(data);
            showError("loginError", "");
            enterApp();
            toast("ok", `Welcome back, ${data.username}`, "Your tracked servers are live.");
            return;
        }
        if (data.needsVerification) {
            showError("loginError", "");
            pendingVerifyUsername = data.username;
            openVerifyPage(data);
            return;
        }
        showError("loginError", data.error);
    } catch {
        showError("loginError", "Could not reach the server. Try again.");
    }
}

const pickUser = d => ({
    username: d.username, tier: d.tier, isOwner: d.isOwner, robloxUsername: d.robloxUsername || ""
});

async function doLogout() {
    const ok = await confirmDialog({
        title: "Log out?", message: "You'll need your password to sign back in.",
        confirm: "Log out", ico: "out"
    });
    if (!ok) return;
    await postJson("/api/logout", {});
    currentUser = null; allGames = []; accountData = null; trackingData = null; history = {}; gamesLoaded = false;
    clearInterval(gamesTimer); clearInterval(trackingTimer); clearInterval(ringTimer);
    gamesTimer = trackingTimer = ringTimer = null;
    $("ownerTabBtn")?.classList.add("hidden");
    showPage("landingPage");
}

async function checkSession() {
    try {
        const data = await (await fetch("/api/me")).json();
        if (data.ok) { currentUser = pickUser(data); enterApp(); }
    } catch {}
}

/* ── roblox verification ───────────────────────────────────────────────── */
function fillProfileCard(prefix, data) {
    const code = $(prefix + "Code");     if (code) code.textContent = data.code || "";
    const name = $(prefix + "Roblox");   if (name) name.textContent = data.robloxUsername || "your Roblox account";
    const av   = $(prefix + "Avatar");
    if (av) {
        if (data.avatar) { av.src = data.avatar; av.classList.remove("hidden"); }
        else av.classList.add("hidden");
    }
}

function openVerifyPage(data) {
    pendingVerifyUsername = data.username || pendingVerifyUsername;
    fillProfileCard("verify", data);
    showError("verifyError", "");
    setFormStatus("verifyStatus", "");
    showPage("verifyPage");
}

async function doVerifyRoblox() {
    if (!pendingVerifyUsername) return showError("verifyError", "Start from the login page.");
    const btn = $("verifyBtn");
    btn.disabled = true; btn.textContent = "Checking your profile…";
    showError("verifyError", "");
    try {
        const data = await (await postJson("/api/verify-roblox", { username: pendingVerifyUsername })).json();
        if (!data.ok) {
            showError("verifyError", data.error || "Could not verify your profile");
        } else {
            pendingVerifyUsername = "";
            currentUser = pickUser(data);
            enterApp();
            toast("ok", "Profile verified", "Your Roblox account is linked.");
        }
    } catch {
        showError("verifyError", "Could not reach the server. Try again.");
    }
    btn.disabled = false; btn.textContent = "I've added it — Verify";
}

async function newCode(kind) {
    const username = kind === "verify" ? pendingVerifyUsername : pendingResetUsername;
    const statusId = kind === "verify" ? "verifyStatus" : "resetStatus";
    if (!username) return;
    const data = await (await postJson("/api/new-code", { username, kind })).json();
    if (!data.ok) return setFormStatus(statusId, data.error || "Could not generate a new code", "error");
    $(kind === "verify" ? "verifyCode" : "resetCode").textContent = data.code;
    setFormStatus(statusId, "New code generated. Paste this one instead.", "ok");
}

/* ── password reset ────────────────────────────────────────────────────── */
function openForgotPage() {
    $("fp-username").value = "";
    showError("forgotError", "");
    setFormStatus("forgotStatus", "");
    showPage("forgotPage");
}

async function doForgotPassword() {
    const username = $("fp-username").value.trim();
    if (!username) return showError("forgotError", "Enter your Vantix username");
    setFormStatus("forgotStatus", "Looking up your account…");
    const data = await (await postJson("/api/forgot-password", { username })).json();
    if (!data.ok) {
        setFormStatus("forgotStatus", "");
        return showError("forgotError", data.error || "Could not start a password reset");
    }
    showError("forgotError", ""); showError("resetError", ""); setFormStatus("resetStatus", "");
    pendingResetUsername = data.username;
    $("rp-password").value = "";
    scorePassword("rp-password", "rpStrength", "rpStrengthNote");
    fillProfileCard("reset", data);
    showPage("resetPage");
}

async function doResetPassword() {
    const password = $("rp-password").value;
    if (!pendingResetUsername) return showError("resetError", "Start the reset from the login page.");
    if (!password) return showError("resetError", "Choose a new password");
    const btn = $("resetBtn");
    btn.disabled = true; btn.textContent = "Checking your profile…";
    const data = await (await postJson("/api/reset-password", { username: pendingResetUsername, password })).json();
    btn.disabled = false; btn.textContent = "Verify & set password";
    if (!data.ok) return showError("resetError", data.error || "Could not reset your password");

    showError("resetError", "");
    $("li-username").value = pendingResetUsername;
    $("li-password").value = "";
    pendingResetUsername = "";
    showError("loginError", "");
    setFormStatus("loginNotice", "Password updated. Log in with your new password.", "ok");
    showPage("loginPage");
    toast("ok", "Password updated", "Log in with your new password.");
}

async function doChangePassword() {
    const currentPassword = $("cp-current").value;
    const newPassword     = $("cp-new").value;
    const confirmPassword = $("cp-confirm").value;
    if (!currentPassword || !newPassword) return setFormStatus("changePwStatus", "Fill in every field.", "error");
    if (newPassword !== confirmPassword)  return setFormStatus("changePwStatus", "New passwords do not match.", "error");

    setFormStatus("changePwStatus", "Saving…");
    const data = await (await postJson("/api/change-password", { currentPassword, newPassword })).json();
    if (!data.ok) return setFormStatus("changePwStatus", data.error || "Could not change your password", "error");

    ["cp-current", "cp-new", "cp-confirm"].forEach(id => { $(id).value = ""; });
    scorePassword("cp-new", "cpStrength", "cpStrengthNote");
    setFormStatus("changePwStatus", "Password updated.", "ok");
    toast("ok", "Password updated", "Your new password is active.");
    loadAccount();
}

/* ── password strength ─────────────────────────────────────────────────── */
function scorePassword(inputId, meterId, noteId) {
    const v = $(inputId)?.value || "";
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) score++;
    if (v.length >= 12) score++;
    if (/[^A-Za-z0-9]/.test(v) && v.length >= 10) score++;
    if (!v) score = 0;
    const meter = $(meterId);
    if (meter) meter.dataset.score = String(score);
    const note = $(noteId);
    if (note) {
        note.textContent = !v ? "Use letters and numbers, 8 characters or more."
            : ["Too short", "Weak — add numbers or letters", "Okay", "Strong", "Very strong"][score] || "";
    }
}

/* ── app entry ─────────────────────────────────────────────────────────── */
function enterApp() {
    showPage("appPage");
    const initial = (currentUser.username || "V").slice(0, 1).toUpperCase();
    $("userLabel").textContent = currentUser.username;
    $("accountAvatar").textContent = initial;
    $("profileAvatar").textContent = initial;
    const label = TIER_LABELS[currentUser.tier] || "No Tier";
    $("tierBadge").textContent = label;
    $("profileUsername").textContent = currentUser.username;
    $("profileTier").textContent = label;
    $("overviewTier").textContent = label;

    $("ownerTabBtn").classList.toggle("hidden", !isOwnerAccount());

    syncSettingsControls();
    renderUpgrade();
    renderOnboarding();
    showSkeletons();
    loadGames();
    loadTracking();
    loadAccount();
    switchTab("overview");
    restartGamesTimer();
    clearInterval(trackingTimer);
    trackingTimer = setInterval(loadTracking, 5000);
}

function restartGamesTimer() {
    clearInterval(gamesTimer); clearInterval(ringTimer);
    const ring = $("refreshRing");
    const interval = Number(settings.refreshInterval) || 5000;
    if (!settings.autoRefresh) {
        ring?.classList.add("paused");
        $("refreshCount").textContent = "—";
        setRingProgress(1);
        return;
    }
    ring?.classList.remove("paused");
    nextRefreshAt = Date.now() + interval;
    gamesTimer = setInterval(() => { nextRefreshAt = Date.now() + interval; loadGames(); }, interval);
    ringTimer = setInterval(() => {
        const left = Math.max(0, nextRefreshAt - Date.now());
        $("refreshCount").textContent = String(Math.ceil(left / 1000));
        setRingProgress(left / interval);
    }, 250);
    syncFilterChips();
}

function setRingProgress(frac) {
    const fg = $("refreshRingFg");
    if (!fg) return;
    const C = 2 * Math.PI * 16;
    fg.style.strokeDasharray = C.toFixed(2);
    fg.style.strokeDashoffset = (C * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2);
}

/* ── account ───────────────────────────────────────────────────────────── */
async function loadAccount() {
    if (!currentUser) return;
    try {
        const res = await fetch("/api/account");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok) return;
        accountData = data;
        renderAccount(data);
        renderOnboarding();
    } catch {}
}

function renderAccount(data) {
    const rows = [
        ["Username", data.username],
        ["Email", data.email || "—"],
        ["Tier", TIER_LABELS[data.tier] || data.tier || "No Tier"],
        ["Roblox account", data.robloxUsername || "Not linked"],
        ["Roblox user ID", data.robloxUserId ? String(data.robloxUserId) : "—"],
        ["Member since", relativeDate(data.joinedAt)],
        ["Password last changed", data.passwordChangedAt ? relativeDate(data.passwordChangedAt) : "Never"]
    ];
    const table = $("accountRows");
    if (table) {
        table.innerHTML = rows
            .map(([k, v]) => `<div class="kv-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`)
            .join("");
    }
    const badge = $("verifyBadge");
    if (badge) {
        badge.className = "verify-badge " + (data.robloxVerified ? "verified" : "unverified");
        badge.textContent = data.robloxVerified ? "Roblox profile verified" : "Roblox profile not verified";
    }
    const avatar = $("accountAvatarImg");
    if (avatar) {
        if (data.avatar) { avatar.src = data.avatar; avatar.classList.remove("hidden"); }
        else avatar.classList.add("hidden");
    }
}

/* ── onboarding checklist ──────────────────────────────────────────────── */
function renderOnboarding() {
    const host = $("onboardList");
    if (!host) return;
    const items = [
        { done: !!accountData?.robloxVerified, text: "Verify your Roblox profile", tab: "security" },
        { done: !!trackingData?.robloxUsername, text: "Bind your Roblox username", tab: "tracking" },
        { done: !!currentUser && currentUser.tier !== "none", text: "Unlock a tier", tab: "upgrade" }
    ];
    host.innerHTML = items.map(i => `
        <button class="check-item${i.done ? " done" : ""}" data-tab="${i.tab}">
            <span class="check-box">${icon("check")}</span>
            <span class="ci-text">${escapeHtml(i.text)}</span>
            <span class="ci-go">${i.done ? "Done" : "Go →"}</span>
        </button>`).join("");
    const pct = Math.round(items.filter(i => i.done).length / items.length * 100);
    const bar = $("onboardProgress");
    if (bar) bar.style.width = pct + "%";
}

/* ── games ─────────────────────────────────────────────────────────────── */
function showSkeletons() {
    const grid = $("gamesGrid");
    if (!grid || gamesLoaded) return;
    grid.innerHTML = Array.from({ length: 6 }).map(() => `
        <div class="sk-card">
            <div class="sk sk-thumb"></div>
            <div class="sk-lines"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>
        </div>`).join("");
}

async function loadGames() {
    if (!currentUser) return;
    try {
        const res = await fetch("/api/games");
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list)) return;
        allGames = list;
        gamesLoaded = true;
        recordHistory(list);
    } catch { return; }

    const total = allGames.length;
    const players = allGames.reduce((s, g) => s + (Number(g.players) || 0), 0);
    setText("overviewGames", fmt(total));
    setText("overviewPlayers", fmt(players));
    setText("navGamesCount", String(total));
    renderGames(); renderFavorites(); renderStats();
}

function setText(id, v) { const el = $(id); if (el && el.textContent !== v) el.textContent = v; }

function recordHistory(list) {
    list.forEach(g => {
        const id = String(g.placeId);
        (history[id] = history[id] || []).push(Number(g.players) || 0);
        if (history[id].length > 24) history[id].shift();
    });
}

const isFavorite = placeId => favorites.includes(String(placeId));

function toggleFavorite(placeId) {
    const id = String(placeId);
    const i = favorites.indexOf(id);
    if (i === -1) favorites.push(id); else favorites.splice(i, 1);
    persistFavorites();
    renderGames(); renderFavorites();
}

function sortGames(list) {
    const arr = [...list];
    const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
    switch (settings.sort) {
        case "players-desc": arr.sort((a, b) => (Number(b.players) || 0) - (Number(a.players) || 0)); break;
        case "name-asc":     arr.sort(byName); break;
        case "name-desc":    arr.sort((a, b) => byName(b, a)); break;
        default:             arr.sort((a, b) => (Number(a.players) || 0) - (Number(b.players) || 0));
    }
    if (settings.favoritesFirst) {
        arr.sort((a, b) => (isFavorite(b.placeId) ? 1 : 0) - (isFavorite(a.placeId) ? 1 : 0));
    }
    return arr;
}

function highlight(text, query) {
    const raw = String(text ?? "");
    if (!query) return escapeHtml(raw);
    const i = raw.toLowerCase().indexOf(query.toLowerCase());
    if (i === -1) return escapeHtml(raw);
    return escapeHtml(raw.slice(0, i))
        + "<mark>" + escapeHtml(raw.slice(i, i + query.length)) + "</mark>"
        + escapeHtml(raw.slice(i + query.length));
}

function sparkSvg(placeId) {
    if (!settings.sparklines) return "";
    const vals = history[String(placeId)] || [];
    if (vals.length < 3) return "";
    const w = 100, h = 26;
    const max = Math.max(...vals), min = Math.min(...vals);
    const span = Math.max(1, max - min);
    const pts = vals.map((v, i) => [
        (i / (vals.length - 1)) * w,
        h - 2 - ((v - min) / span) * (h - 6)
    ]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    return `<div class="game-spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <path class="area" d="${line} L ${w} ${h} L 0 ${h} Z"/><path class="line" d="${line}"/></svg></div>`;
}

function heatOf(players) {
    return players === 0 ? "empty" : players < 10 ? "low" : players < 100 ? "mid" : "high";
}

function gameCardHtml(g, query) {
    const rawName = g.name || "Unknown";
    const name = highlight(rawName, query);
    const placeId = escapeHtml(g.placeId || "");
    const players = Number(g.players) || 0;
    const heat = heatOf(players);
    const fav = isFavorite(g.placeId);
    return `
    <div class="game-card">
        <div class="game-thumb" data-initial="${escapeHtml(rawName.slice(0, 1).toUpperCase())}">
            ${g.icon ? `<img src="${escapeHtml(g.icon)}" alt="" loading="lazy" data-fallback>` : ""}
            <div class="thumb-scrim"></div>
            <div class="thumb-pills">
                <span class="live-pill heat-${heat}"><i></i><b>${fmt(players)}</b> online</span>
                ${g.earlyAccess ? '<span class="ea-pill">EARLY ACCESS</span>' : ""}
            </div>
            <button class="fav-btn${fav ? " on" : ""}" data-act="fav" data-place="${placeId}"
                    title="${fav ? "Remove from favorites" : "Add to favorites"}" aria-label="Toggle favorite">
                <svg viewBox="0 0 24 24" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
        </div>
        <div class="game-info">
            <h3 title="${escapeHtml(rawName)}">${name}</h3>
            <div class="game-meta">
                <span class="meta-row"><em>Creator</em><b>${escapeHtml(g.creator || "Unknown")}</b></span>
                <span class="meta-row"><em>Place ID</em>
                    <button class="copy-id" data-act="copy-text" data-text="${placeId}" title="Copy place ID">
                        ${placeId}${icon("copy")}
                    </button>
                </span>
            </div>
            ${sparkSvg(g.placeId)}
            <div class="game-actions">
                <button class="btn-join" data-act="join" data-place="${placeId}" data-name="${escapeHtml(rawName)}">
                    ${icon("play")}<span>Join game</span>
                </button>
            </div>
        </div>
    </div>`;
}

function paintGrid(grid, list, query, emptyHtml) {
    grid.classList.toggle("list-view", viewMode === "list");
    if (!list.length) { grid.innerHTML = emptyHtml; return; }
    grid.innerHTML = list.map(g => gameCardHtml(g, query)).join("");
    qsa(".game-card", grid).forEach((c, i) => c.style.setProperty("--d", Math.min(i * 28, 400) + "ms"));
    qsa("img[data-fallback]", grid).forEach(img => {
        img.addEventListener("error", () => img.classList.add("img-fail"), { once: true });
    });
}

function emptyState(title, body, action) {
    return `<div class="empty">
        <div class="empty-mark">${icon("gamepad")}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        ${action || ""}
    </div>`;
}

function renderGames() {
    const grid = $("gamesGrid");
    if (!grid || !currentUser) return;
    if (!gamesLoaded) return;
    const query = ($("gameSearch")?.value || "").trim();
    const q = query.toLowerCase();

    let filtered = allGames.filter(g =>
        !q || String(g.name || "").toLowerCase().includes(q) || String(g.placeId || "").includes(q));
    if (settings.hideEmpty) filtered = filtered.filter(g => (Number(g.players) || 0) > 0);
    filtered = sortGames(filtered);

    setText("gamesCount", `${filtered.length} of ${allGames.length}`);

    const noTier = currentUser.tier === "none";
    paintGrid(grid, filtered, query, emptyState(
        noTier ? "No tier yet" : query ? "Nothing matches that search" : "No games found",
        noTier ? "Head to the Upgrade tab to unlock tracked servers."
               : query ? "Try a different name or place ID." : "No tracked games match your tier or filters right now.",
        noTier ? '<button class="btn btn-primary btn-sm" data-tab="upgrade">See tiers</button>' : ""
    ));
}

function renderFavorites() {
    const grid = $("favoritesGrid");
    if (!grid) return;
    const list = sortGames(allGames.filter(g => isFavorite(g.placeId)));
    setText("favoritesCount", String(list.length));
    setText("navFavCount", String(favorites.length));
    paintGrid(grid, list, "", emptyState(
        "No favorites yet",
        "Tap the star on any game card to pin it here. Favorites are saved on this device.",
        '<button class="btn btn-primary btn-sm" data-tab="games">Browse games</button>'
    ));
}

/* ── stats ─────────────────────────────────────────────────────────────── */
function renderStats() {
    const wrap = $("statsGrid");
    if (!wrap) return;

    const total   = allGames.length;
    const players = allGames.reduce((s, g) => s + (Number(g.players) || 0), 0);
    const active  = allGames.filter(g => (Number(g.players) || 0) > 0).length;
    const early   = allGames.filter(g => g.earlyAccess).length;
    const avg     = total ? Math.round((players / total) * 10) / 10 : 0;
    const sorted  = [...allGames].sort((a, b) => (Number(b.players) || 0) - (Number(a.players) || 0));
    const busiest = sorted[0];
    const quietest = sorted[sorted.length - 1];

    wrap.innerHTML = [
        ["Tracked games", fmt(total), "Servers visible to your tier"],
        ["Players online", fmt(players), "Across every tracked server"],
        ["Active servers", fmt(active), "With at least one player"],
        ["Average population", String(avg), "Players per tracked server"],
        ["Early access", fmt(early), "Flagged early access games"],
        ["Favorites", fmt(favorites.length), "Pinned on this device"]
    ].map(([label, value, note]) => `
        <div class="stat-card">
            <span>${escapeHtml(value)}</span>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(note)}</p>
        </div>`).join("");

    const highlight = $("statsHighlight");
    if (!highlight) return;
    if (!total) {
        highlight.innerHTML = `<p class="tab-sub">No tracked games yet. Once servers report in, their breakdown appears here.</p>`;
        return;
    }

    const max = Math.max(1, Number(busiest?.players) || 1);
    const bars = sorted.slice(0, 8).map((g, i) => {
        const p = Number(g.players) || 0;
        return `<div class="bar-row">
            <span class="bar-label" title="${escapeHtml(g.name || "Unknown")}">${escapeHtml(g.name || "Unknown")}</span>
            <span class="bar-track"><i style="width:${Math.round(p / max * 100)}%;--d:${i * 60}ms"></i></span>
            <span class="bar-value">${fmt(p)}</span>
        </div>`;
    }).join("");

    const bands = [
        ["Empty",     allGames.filter(g => (Number(g.players) || 0) === 0).length, "var(--idle)"],
        ["1–9",       allGames.filter(g => { const p = Number(g.players) || 0; return p > 0 && p < 10; }).length, "var(--a-400)"],
        ["10–99",     allGames.filter(g => { const p = Number(g.players) || 0; return p >= 10 && p < 100; }).length, "var(--warn)"],
        ["100+",      allGames.filter(g => (Number(g.players) || 0) >= 100).length, "var(--bad)"]
    ];
    const C = 2 * Math.PI * 52;
    let offset = 0;
    const segs = bands.map(([, count, colour]) => {
        const frac = total ? count / total : 0;
        const seg = `<circle class="d-seg" cx="60" cy="60" r="52" stroke="${colour}"
            stroke-dasharray="${(C * frac).toFixed(2)} ${(C * (1 - frac)).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
        offset += C * frac;
        return frac > 0 ? seg : "";
    }).join("");

    highlight.innerHTML = `
        <div class="panel">
            <h3>Busiest right now</h3>
            <div class="stat-line"><em>Busiest</em><b>${escapeHtml(busiest?.name || "—")} · ${fmt(busiest?.players)} players</b></div>
            <div class="stat-line"><em>Quietest</em><b>${escapeHtml(quietest?.name || "—")} · ${fmt(quietest?.players)} players</b></div>
            <div class="bar-chart">${bars}</div>
        </div>
        <div class="panel">
            <h3>Population spread</h3>
            <p class="tab-sub">How your visible servers are distributed.</p>
            <div class="donut-wrap">
                <div class="donut">
                    <svg viewBox="0 0 120 120"><circle class="d-track" cx="60" cy="60" r="52"/>${segs}</svg>
                    <div class="donut-center"><span><b>${fmt(total)}</b><span>servers</span></span></div>
                </div>
                <div class="legend">
                    ${bands.map(([label, count, colour]) => `
                        <div class="legend-row"><i style="background:${colour}"></i>${escapeHtml(label)}<b>${fmt(count)}</b></div>
                    `).join("")}
                </div>
            </div>
        </div>`;
}

/* ── upgrade tab ───────────────────────────────────────────────────────── */
function renderUpgrade() {
    const host = $("upgradeGrid");
    if (!host) return;
    host.innerHTML = TIER_PLANS.map(p => {
        const owned = currentUser && currentUser.tier === p.key;
        return `<div class="plan${p.best ? " featured" : ""}">
            ${p.best ? '<span class="plan-flag">BEST VALUE</span>' : ""}
            ${owned && !p.best ? '<span class="plan-flag">YOUR TIER</span>' : ""}
            <div class="plan-mark">${p.mark}</div>
            <h3>${escapeHtml(p.name)}</h3>
            <div class="plan-price">${p.price} <span>R$</span></div>
            <p class="plan-cap">${escapeHtml(p.cap)}</p>
            <ul class="plan-feat">${p.feats.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
        </div>`;
    }).join("");
}

/* ── tracking ──────────────────────────────────────────────────────────── */
async function loadTracking() {
    if (!currentUser) return;
    const input = $("trackUsername");
    if (!input) return;
    try {
        const data = await (await fetch("/api/tracking")).json();
        if (!data.ok) return;
        trackingData = data;
        if (document.activeElement !== input) input.value = data.robloxUsername || "";
        currentUser.robloxUsername = data.robloxUsername || "";
        renderTrackingStatus(data);
        updateOverviewTracking(data);
        renderOnboarding();
    } catch {
        const status = $("trackStatus");
        if (status) { status.textContent = "Could not load tracking settings."; status.className = "track-status error"; }
    }
}

async function saveTracking() {
    const input = $("trackUsername");
    const status = $("trackStatus");
    const robloxUsername = input.value.trim().replace(/^@/, "");
    status.textContent = "Saving…";
    status.className = "track-status";
    const data = await (await postJson("/api/tracking", { robloxUsername })).json();
    if (data.ok) {
        trackingData = data;
        input.value = data.robloxUsername || "";
        currentUser.robloxUsername = data.robloxUsername || "";
        renderTrackingStatus(data);
        updateOverviewTracking(data);
        renderOnboarding();
        loadAccount();
        toast("ok", "Tracking saved", robloxUsername ? `Watching for ${robloxUsername}.` : "Tracking cleared.");
    } else {
        status.textContent = data.error || "Could not save tracking settings.";
        status.className = "track-status error";
        toast("error", "Could not save", data.error || "Check the username and try again.");
    }
}

function renderTrackingStatus(data) {
    const status = $("trackStatus");
    if (!status) return;
    if (!data.robloxUsername) {
        status.className = "track-status";
        status.textContent = "No Roblox username set.";
        return;
    }
    if (data.online) {
        status.className = "track-status online";
        status.textContent = `Online now in ${data.gameName || "a connected game"}${data.placeId ? ` (${data.placeId})` : ""}.`;
        return;
    }
    status.className = "track-status";
    status.textContent = data.lastSeen
        ? `Offline. Last seen ${new Date(data.lastSeen).toLocaleString()}.`
        : `Watching for ${data.robloxUsername}. Offline right now.`;
}

function updateOverviewTracking(data) {
    setText("overviewTracking", !data?.robloxUsername ? "Not set" : data.online ? "Online" : "Offline");
}

/* ── join ──────────────────────────────────────────────────────────────── */
async function joinGame(placeId, name) {
    const data = await (await postJson("/api/join", { placeId })).json();
    if (!data.ok) return toast("error", "Could not join", data.error || "Try again in a moment.");

    const ok = await confirmDialog({
        title: `Open Roblox?`,
        message: `Vantix will hand "${name}" to the Roblox app and load your panel on join.`,
        confirm: "Open Roblox", ico: "play"
    });
    if (!ok) return;
    window.location.href = `roblox://placeId=${placeId}&launchData=${encodeURIComponent(data.token)}`;
}

/* ── exec console ──────────────────────────────────────────────────────── */
function openExec(placeId, name) {
    execPlaceId = placeId; execGameName = name;
    $("execModalTitle").textContent = `Execute — ${name}`;
    $("execOutput").innerHTML = "";
    $("execCode").value = "";
    appendExecLog(`// Connected to: ${name} (${placeId})`, "info");
    appendExecLog(`// Type Lua code and press Run or Ctrl+Enter.`, "info");
    $("execModal").classList.remove("hidden");
    $("execCode").focus();
}

function closeExecModal() {
    $("execModal").classList.add("hidden");
    execPlaceId = null; execGameName = "";
}

function appendExecLog(text, type = "output") {
    const el = $("execOutput");
    const line = document.createElement("div");
    line.className = "log-line log-" + type;
    line.textContent = (type === "input" ? "> " : "") + text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

async function runExec() {
    const code = $("execCode").value.trim();
    if (!code || !execPlaceId) return;
    const placeId = execPlaceId;
    const btn = $("execRunBtn");
    btn.disabled = true; btn.textContent = "Sending…";
    appendExecLog(code, "input");
    execHistory.push(code); execHistoryIx = execHistory.length;

    const data = await (await postJson("/api/execute", { placeId, code })).json();
    btn.disabled = false; btn.textContent = "Run";

    if (!data.ok) return appendExecLog("Error: " + (data.error || "Failed to send"), "error");
    appendExecLog("Sent to the tracked server. Watch the Roblox Developer Console for [Vantix exec] output.", "info");
    $("execCode").value = "";
    pollExecResult(placeId, data.id);
}

async function pollExecResult(placeId, cmdId, attempts = 0) {
    if (attempts > 120) return appendExecLog("No result after 60s. Check the Roblox Developer Console for [Vantix] errors.", "warn");
    await new Promise(r => setTimeout(r, 500));
    try {
        const data = await (await fetch(`/api/result?placeId=${encodeURIComponent(placeId)}&id=${encodeURIComponent(cmdId)}`)).json();
        if (data.status === "done") return appendExecLog(String(data.output), "output");
        if (attempts > 0 && attempts % 20 === 0) appendExecLog("Still waiting for Roblox to post the result…", "info");
    } catch {}
    pollExecResult(placeId, cmdId, attempts + 1);
}

function popoutExec() {
    if (!execPlaceId) return;
    const currentCode = $("execCode").value;
    const title = `Execute - ${execGameName || execPlaceId}`.replace(/[<>&"]/g, "");
    const popup = window.open("", "vantixExecutor", "popup=yes,width=880,height=660");
    if (!popup) return appendExecLog("Pop-out blocked. Allow pop-ups for this site and try again.", "warn");

    popup.document.open();
    popup.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#05070A;color:#E9F3ED;font:14px/1.6 system-ui,sans-serif;height:100vh;display:flex;flex-direction:column}
header{padding:14px 18px;border-bottom:1px solid rgba(0,255,136,.18);color:#3AFFA2;font:700 13px ui-monospace,Consolas,monospace;background:rgba(0,255,136,.04)}
#out{flex:1;overflow:auto;padding:14px 18px;font:12.5px/1.75 ui-monospace,Consolas,monospace}
.line-info{color:rgba(233,243,237,.34)}.line-input{color:#7BFFC2}.line-output{color:#E9F3ED}.line-error{color:#ff9c9c}.line-warn{color:#FFC15E}
.input{border-top:1px solid rgba(255,255,255,.075);padding:12px 16px;background:rgba(0,0,0,.28)}
textarea{width:100%;min-height:130px;resize:vertical;background:rgba(0,0,0,.34);border:1px solid rgba(255,255,255,.075);border-radius:11px;color:#E9F3ED;padding:11px 13px;font:12.5px/1.7 ui-monospace,Consolas,monospace;outline:none}
textarea:focus{border-color:rgba(0,255,136,.46)}
footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:rgba(233,243,237,.34);font-size:12px}
button{background:linear-gradient(180deg,#3AFFA2,#00DB76);color:#03150C;border:0;border-radius:10px;padding:9px 22px;font-weight:700;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}</style></head><body>
<header>${title}</header><div id="out"></div><div class="input">
<textarea id="code" spellcheck="false" placeholder="-- Enter Lua code&#10;print('Hello from server!')"></textarea>
<footer><span>Ctrl+Enter to run</span><button id="run">Run</button></footer></div><script>
const placeId=${JSON.stringify(String(execPlaceId))};
const out=document.getElementById("out"),code=document.getElementById("code"),run=document.getElementById("run");
code.value=${JSON.stringify(currentCode)};let tok="";
function log(t,k){const d=document.createElement("div");d.className="line-"+(k||"output");d.textContent=t;out.appendChild(d);out.scrollTop=out.scrollHeight}
async function csrf(){if(tok)return tok;const r=await fetch("/api/csrf");tok=(await r.json()).token||"";return tok}
async function poll(id,n){n=n||0;if(n>120){log("No result after 60s.","warn");return}
await new Promise(r=>setTimeout(r,500));
try{const d=await(await fetch("/api/result?placeId="+encodeURIComponent(placeId)+"&id="+encodeURIComponent(id))).json();
if(d.status==="done"){log(String(d.output),"output");return}if(n&&n%20===0)log("Still waiting...","info")}catch(e){}
poll(id,n+1)}
async function go(){const t=code.value.trim();if(!t)return;run.disabled=true;run.textContent="Sending...";log("> "+t,"input");
try{const r=await fetch("/api/execute",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":await csrf()},body:JSON.stringify({placeId:placeId,code:t})});
const d=await r.json();if(!d.ok){log("Error: "+(d.error||"Failed to send"),"error")}else{log("Sent to the tracked server.","info");poll(d.id);code.value=""}}catch(e){log("Error: "+e.message,"error")}
run.disabled=false;run.textContent="Run"}
run.addEventListener("click",go);
document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.key==="Enter")go()});
log("// Pop-out executor ready.","info");
<\/script></body></html>`);
    popup.document.close();
    popup.focus();
}

/* ── owner ─────────────────────────────────────────────────────────────── */
async function loadOwnerUsers() {
    try {
        const res = await fetch("/api/owner/users");
        if (!res.ok) return;
        ownerUsers = await res.json();
        setText("ownerCount", String(ownerUsers.length));
        filterOwnerUsers();
    } catch {}
}

function filterOwnerUsers() {
    const q = ($("ownerSearch")?.value || "").toLowerCase();
    renderOwnerUsers(ownerUsers.filter(u =>
        String(u.username || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q)));
}

function renderOwnerUsers(list) {
    const tiers = Object.keys(TIER_LABELS);
    const el = $("ownerUsersTable");
    if (!el) return;
    if (!list.length) {
        el.innerHTML = emptyState("No users match", "Try a different name or email.");
        return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="owner-table">
        <thead><tr><th>Username</th><th>Email</th><th>Verified</th><th>Roblox</th><th>Current tier</th><th>Set tier</th><th></th></tr></thead>
        <tbody>${list.map((u, i) => `
            <tr data-row="${i}">
                <td><b>${escapeHtml(u.username)}</b></td>
                <td>${escapeHtml(u.email)}</td>
                <td>${u.emailVerified ? '<span class="pill-yes">Yes</span>' : '<span class="pill-no">No</span>'}</td>
                <td>${escapeHtml(u.robloxUsername || "—")}</td>
                <td>${escapeHtml(TIER_LABELS[u.tier] || u.tier || "none")}</td>
                <td><select class="tier-select" data-tier-for="${i}">
                    ${tiers.map(t => `<option value="${t}"${u.tier === t ? " selected" : ""}>${TIER_LABELS[t]}</option>`).join("")}
                </select></td>
                <td><button class="btn-save" data-act="set-tier" data-row="${i}" data-username="${escapeHtml(u.username)}">Save</button></td>
            </tr>`).join("")}
        </tbody></table></div>`;
    el._list = list;
}

async function setTier(rowIx, username) {
    const el = $("ownerUsersTable");
    const sel = qs(`[data-tier-for="${rowIx}"]`, el);
    if (!sel) return;
    const tier = sel.value;
    const data = await (await postJson("/api/owner/set-tier", { username, tier })).json();
    if (!data.ok) return toast("error", "Could not set tier", data.error || "Try again.");
    const u = ownerUsers.find(x => x.username === username);
    if (u) u.tier = tier;
    filterOwnerUsers();
    toast("ok", "Tier updated", `${username} is now ${TIER_LABELS[tier]}.`);
}

/* ── command palette ───────────────────────────────────────────────────── */
let cmdkItems = [], cmdkIx = 0;

function buildCommands() {
    const cmds = [];
    Object.entries(TAB_META).forEach(([key, [label, sub]]) => {
        if (key === "owner" && !isOwnerAccount()) return;
        cmds.push({ group: "Navigate", label, sub, ico: {
            overview: "grid", games: "gamepad", favorites: "star", stats: "chart", tracking: "target",
            profile: "user", security: "lock", settings: "gear", upgrade: "up", help: "help", owner: "shield"
        }[key] || "grid", run: () => switchTab(key) });
    });
    cmds.push({ group: "Actions", label: settings.autoRefresh ? "Pause auto refresh" : "Resume auto refresh", ico: "bolt",
        run: () => { updateSetting("autoRefresh", !settings.autoRefresh); syncSettingsControls(); } });
    cmds.push({ group: "Actions", label: viewMode === "grid" ? "Switch to list view" : "Switch to grid view", ico: "grid",
        run: () => setView(viewMode === "grid" ? "list" : "grid") });
    cmds.push({ group: "Actions", label: "Keyboard shortcuts", sub: "?", ico: "help", run: openKeysSheet });
    cmds.push({ group: "Actions", label: "Copy Discord tag", sub: "#dr.muffinn", ico: "copy",
        run: () => copyText("#dr.muffinn") });
    cmds.push({ group: "Actions", label: "Log out", ico: "out", run: doLogout });
    ["green", "cyan", "violet", "amber", "rose", "blue"].forEach(a => {
        cmds.push({ group: "Theme", label: "Accent: " + a[0].toUpperCase() + a.slice(1), ico: "palette",
            run: () => { updateSetting("accent", a); syncSettingsControls(); } });
    });
    sortGames(allGames).slice(0, 40).forEach(g => {
        cmds.push({ group: "Games", label: g.name || "Unknown", sub: `${fmt(g.players)} online`, ico: "gamepad",
            run: () => { switchTab("games"); const s = $("gameSearch"); if (s) { s.value = g.name || ""; renderGames(); } } });
    });
    return cmds;
}

function openCmdk() {
    if (qs(".cmdk-scrim")) return;
    const all = buildCommands();
    const scrim = document.createElement("div");
    scrim.className = "cmdk-scrim";
    scrim.innerHTML = `<div class="cmdk" role="dialog" aria-modal="true">
        <div class="cmdk-input">${icon("search")}
            <input id="cmdkInput" placeholder="Search tabs, games and actions…" autocomplete="off" spellcheck="false">
        </div>
        <div class="cmdk-list" id="cmdkList"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span><kbd>Esc</kbd> close</span></div>
    </div>`;
    $("cmdkHost").appendChild(scrim);

    const input = $("cmdkInput");
    const paint = () => {
        const q = input.value.trim().toLowerCase();
        cmdkItems = !q ? all : all.filter(c => c.label.toLowerCase().includes(q) || (c.sub || "").toLowerCase().includes(q));
        cmdkIx = 0;
        const list = $("cmdkList");
        if (!cmdkItems.length) { list.innerHTML = `<div class="cmdk-empty">Nothing matches “${escapeHtml(input.value)}”.</div>`; return; }
        let html = "", lastGroup = "";
        cmdkItems.forEach((c, i) => {
            if (c.group !== lastGroup) { html += `<div class="cmdk-sec">${escapeHtml(c.group)}</div>`; lastGroup = c.group; }
            html += `<button class="cmdk-item" data-i="${i}" aria-selected="${i === 0}">
                ${icon(c.ico)}<span>${escapeHtml(c.label)}</span>${c.sub ? `<span class="ci-sub">${escapeHtml(c.sub)}</span>` : ""}
            </button>`;
        });
        list.innerHTML = html;
    };
    const move = d => {
        if (!cmdkItems.length) return;
        cmdkIx = (cmdkIx + d + cmdkItems.length) % cmdkItems.length;
        qsa(".cmdk-item").forEach(el => el.setAttribute("aria-selected", el.dataset.i === String(cmdkIx)));
        qs(`.cmdk-item[data-i="${cmdkIx}"]`)?.scrollIntoView({ block: "nearest" });
    };
    const runIx = i => { const c = cmdkItems[i]; closeCmdk(); if (c) c.run(); };

    input.addEventListener("input", paint);
    scrim.addEventListener("click", e => {
        if (e.target === scrim) return closeCmdk();
        const it = e.target.closest(".cmdk-item");
        if (it) runIx(Number(it.dataset.i));
    });
    input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        else if (e.key === "Enter") { e.preventDefault(); runIx(cmdkIx); }
        else if (e.key === "Escape") closeCmdk();
    });
    paint();
    input.focus();
}

function closeCmdk() { qs(".cmdk-scrim")?.remove(); }

function openKeysSheet() {
    const rows = [
        ["Command palette", ["Ctrl", "K"]], ["Focus search", ["/"]],
        ["Overview", ["G", "O"]], ["Games", ["G", "G"]], ["Favorites", ["G", "F"]],
        ["Stats", ["G", "S"]], ["Tracking", ["G", "T"]],
        ["Run script", ["Ctrl", "↵"]], ["Close / back", ["Esc"]], ["This sheet", ["?"]]
    ];
    const host = $("dialogHost");
    const scrim = document.createElement("div");
    scrim.className = "dialog-scrim";
    scrim.innerHTML = `<div class="dialog" style="width:min(620px,100%)" role="dialog" aria-modal="true">
        <div class="dialog-ico">${icon("bolt")}</div>
        <h3>Keyboard shortcuts</h3>
        <p>Move around the console without touching the mouse.</p>
        <div class="keys-grid">${rows.map(([l, k]) =>
            `<div class="keys-row"><span>${escapeHtml(l)}</span><b>${k.map(x => `<kbd>${escapeHtml(x)}</kbd>`).join("")}</b></div>`
        ).join("")}</div>
        <div class="dialog-actions" style="margin-top:22px"><button class="btn btn-primary" data-close>Got it</button></div>
    </div>`;
    const close = () => { scrim.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    scrim.addEventListener("click", e => { if (e.target === scrim || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey);
    host.appendChild(scrim);
}

/* ── clipboard ─────────────────────────────────────────────────────────── */
async function copyText(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            const old = btn.textContent;
            btn.classList.add("done");
            if (!btn.classList.contains("copy-id")) btn.textContent = "Copied";
            setTimeout(() => { btn.classList.remove("done"); if (!btn.classList.contains("copy-id")) btn.textContent = old; }, 1400);
        }
        toast("ok", "Copied", text.length > 40 ? text.slice(0, 40) + "…" : text, 2200);
        return true;
    } catch {
        toast("error", "Could not copy", "Select the text and copy it manually.");
        return false;
    }
}

function setView(mode) {
    viewMode = mode === "list" ? "list" : "grid";
    try { localStorage.setItem(VIEW_KEY, viewMode); } catch {}
    syncFilterChips();
    renderGames(); renderFavorites();
}

/* ══ EVENT WIRING ═══════════════════════════════════════════════════════ */

// cursor glow
const glowEl = $("cursorGlow");
document.addEventListener("mousemove", e => {
    if (!glowEl) return;
    glowEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}, { passive: true });

// sticky landing nav
window.addEventListener("scroll", () => {
    $("lnav")?.classList.toggle("stuck", window.scrollY > 12);
}, { passive: true });

// delegated clicks
document.addEventListener("click", async e => {
    const pageEl = e.target.closest("[data-page]");
    if (pageEl) { e.preventDefault(); return showPage(pageEl.dataset.page); }

    const tabEl = e.target.closest("[data-tab]");
    if (tabEl) { e.preventDefault(); return switchTab(tabEl.dataset.tab); }

    const swatch = e.target.closest(".accent-swatch");
    if (swatch) { updateSetting("accent", swatch.dataset.accent); return syncSettingsControls(); }

    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;

    switch (act) {
        case "signup":          return doSignup();
        case "login":           return doLogin();
        case "logout":          return doLogout();
        case "verify":          return doVerifyRoblox();
        case "new-verify-code": return newCode("verify");
        case "new-reset-code":  return newCode("reset");
        case "forgot-open":     return openForgotPage();
        case "forgot":          return doForgotPassword();
        case "reset":           return doResetPassword();
        case "change-password": return doChangePassword();
        case "save-tracking":   return saveTracking();
        case "clear-favorites": return clearFavorites();
        case "reset-settings":  return resetSettings();
        case "cmdk-open":       return openCmdk();
        case "keys-open":       return openKeysSheet();
        case "menu-open":       return openSidebar();
        case "reload-owner":    return loadOwnerUsers();
        case "exec-run":        return runExec();
        case "exec-close":      return closeExecModal();
        case "exec-popout":     return popoutExec();
        case "exec-clear":      return void ($("execOutput").innerHTML = "");
        case "fav":             return toggleFavorite(el.dataset.place);
        case "join":            return joinGame(el.dataset.place, el.dataset.name);
        case "set-tier":        return setTier(el.dataset.row, el.dataset.username);
        case "view":            return setView(el.dataset.view);
        case "copy-text":       return void copyText(el.dataset.text, el);
        case "copy": {
            const src = $(el.dataset.source);
            const ok = await copyText(src?.textContent || "", el);
            setFormStatus(el.dataset.status,
                ok ? "Code copied. Paste it into your Roblox About section." : "Could not copy automatically — select the code and copy it.",
                ok ? "ok" : "error");
            return;
        }
        case "reveal": {
            const input = $(el.dataset.target);
            if (!input) return;
            const shown = input.type === "text";
            input.type = shown ? "password" : "text";
            el.setAttribute("aria-label", shown ? "Show password" : "Hide password");
            return;
        }
        case "cycle-sort": {
            const order = ["players-asc", "players-desc", "name-asc", "name-desc"];
            const next = order[(order.indexOf(settings.sort) + 1) % order.length];
            updateSetting("sort", next);
            $("setSort") && ($("setSort").value = next);
            return;
        }
        case "toggle-empty":    return updateSetting("hideEmpty", !settings.hideEmpty);
        case "toggle-favfirst": return updateSetting("favoritesFirst", !settings.favoritesFirst);
    }
});

// settings inputs
document.addEventListener("change", e => {
    const el = e.target.closest("[data-setting]");
    if (!el) return;
    const key = el.dataset.setting;
    const value = el.type === "checkbox" ? el.checked
        : key === "refreshInterval" ? Number(el.value) : el.value;
    updateSetting(key, value);
});

// live inputs
document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "gameSearch")  return renderGames();
    if (t.id === "ownerSearch") return filterOwnerUsers();
    if (t.dataset && t.dataset.strength) {
        return scorePassword(t.id, t.dataset.strength, t.dataset.strength + "Note");
    }
});

// scrim + modal backdrops
$("sidebarScrim")?.addEventListener("click", closeSidebar);
$("menuBtn")?.addEventListener("click", openSidebar);
$("execModal")?.addEventListener("click", e => { if (e.target.id === "execModal") closeExecModal(); });

// exec history with arrow keys
$("execCode")?.addEventListener("keydown", e => {
    if (e.key === "ArrowUp" && !e.shiftKey && execHistory.length && e.target.selectionStart === 0) {
        e.preventDefault();
        execHistoryIx = Math.max(0, execHistoryIx - 1);
        e.target.value = execHistory[execHistoryIx] || "";
    } else if (e.key === "ArrowDown" && execHistory.length) {
        e.preventDefault();
        execHistoryIx = Math.min(execHistory.length, execHistoryIx + 1);
        e.target.value = execHistory[execHistoryIx] || "";
    }
});

// keyboard
let chordTimer = null, chording = false;
document.addEventListener("keydown", e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        return currentUser ? openCmdk() : null;
    }
    if (e.ctrlKey && e.key === "Enter") {
        if (!$("execModal").classList.contains("hidden")) { e.preventDefault(); return runExec(); }
    }
    if (e.key === "Escape") {
        if (qs(".cmdk-scrim")) return closeCmdk();
        if (!$("execModal").classList.contains("hidden")) return closeExecModal();
        closeSidebar();
        return;
    }
    if (typing) {
        if (e.key === "Enter") {
            if (e.target.id === "fp-username") doForgotPassword();
            if (e.target.id === "rp-password") doResetPassword();
            if (e.target.id === "li-username" || e.target.id === "li-password") doLogin();
            if (e.target.id === "trackUsername") saveTracking();
        }
        return;
    }
    if (!currentUser) return;

    if (e.key === "/") { e.preventDefault(); switchTab("games"); return; }
    if (e.key === "?") { e.preventDefault(); return openKeysSheet(); }

    if (chording) {
        const map = { o: "overview", g: "games", f: "favorites", s: "stats", t: "tracking", u: "upgrade", h: "help" };
        const tab = map[e.key.toLowerCase()];
        chording = false; clearTimeout(chordTimer);
        if (tab) { e.preventDefault(); switchTab(tab); }
        return;
    }
    if (e.key.toLowerCase() === "g") {
        chording = true;
        clearTimeout(chordTimer);
        chordTimer = setTimeout(() => { chording = false; }, 900);
    }
});

/* ── legacy globals (kept for the in-game panel / bookmarks) ───────────── */
Object.assign(window, {
    showPage, switchTab, joinGame, openExec, closeExecModal, popoutExec, runExec,
    toggleFavorite, updateSetting, resetSettings, clearFavorites,
    filterOwnerUsers, setTier, renderGames, toast
});

/* ── init ──────────────────────────────────────────────────────────────── */
const yearEl = $("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());
loadSettings();
applySettings();
syncSettingsControls();
checkSession();
