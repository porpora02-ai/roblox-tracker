// ─── CURSOR GLOW ──────────────────────────────────────────────────────────────
const glow = document.getElementById("cursorGlow");
document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top  = e.clientY + "px";
});

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentUser  = null;
let allGames     = [];
let execPlaceId  = null;
let execGameName = "";
let ownerUsers   = [];
let gamesTimer   = null;
let trackingTimer = null;
let csrfToken = "";

let pendingVerifyUsername = "";
let pendingResetUsername  = "";
let accountData           = null;
let favorites             = [];
let settings              = {};

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[ch]));
}

function jsString(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r/g, "")
        .replace(/\n/g, "\\n");
}

function userDomId(username) {
    return "tier-sel-" + encodeURIComponent(String(username ?? "")).replace(/%/g, "_");
}

async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const res = await fetch("/api/csrf");
    const data = await res.json();
    csrfToken = data.token || "";
    return csrfToken;
}

async function postJson(url, body) {
    const token = await getCsrfToken();
    let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body || {})
    });
    if (res.status === 403) {
        csrfToken = "";
        const retryToken = await getCsrfToken();
        res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": retryToken },
            body: JSON.stringify(body || {})
        });
    }
    return res;
}

// ─── SETTINGS (device-local) ──────────────────────────────────────────────────
const SETTINGS_KEY  = "vantix.settings";
const FAVORITES_KEY = "vantix.favorites";

const DEFAULT_SETTINGS = {
    cursorGlow: true,
    bgEffects: true,
    animations: true,
    accent: "green",
    density: "comfortable",
    autoRefresh: true,
    refreshInterval: 5000,
    sort: "players-asc",
    hideEmpty: false,
    favoritesFirst: true
};

function loadSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        settings = { ...DEFAULT_SETTINGS, ...raw };
    } catch {
        settings = { ...DEFAULT_SETTINGS };
    }
    try {
        favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        if (!Array.isArray(favorites)) favorites = [];
    } catch {
        favorites = [];
    }
}

function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function persistFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch {}
}

function applySettings() {
    const root = document.documentElement;
    root.setAttribute("data-accent", settings.accent || "green");
    root.setAttribute("data-density", settings.density || "comfortable");
    root.classList.toggle("no-animations", !settings.animations);
    root.classList.toggle("no-bg-effects", !settings.bgEffects);
    toggleCursorGlow(settings.cursorGlow);
}

function syncSettingsControls() {
    const set = (id, prop, value) => {
        const el = document.getElementById(id);
        if (el) el[prop] = value;
    };
    set("setCursorGlow", "checked", settings.cursorGlow);
    set("setBgEffects", "checked", settings.bgEffects);
    set("setAnimations", "checked", settings.animations);
    set("setAutoRefresh", "checked", settings.autoRefresh);
    set("setHideEmpty", "checked", settings.hideEmpty);
    set("setFavoritesFirst", "checked", settings.favoritesFirst);
    set("setRefreshInterval", "value", String(settings.refreshInterval));
    set("setSort", "value", settings.sort);
    set("setDensity", "value", settings.density);
    document.querySelectorAll(".accent-swatch").forEach(el => {
        el.classList.toggle("active", el.dataset.accent === settings.accent);
    });
}

function updateSetting(key, value) {
    settings[key] = value;
    persistSettings();
    applySettings();

    if (key === "autoRefresh" || key === "refreshInterval") {
        restartGamesTimer();
    }
    if (key === "sort" || key === "hideEmpty" || key === "favoritesFirst" || key === "density") {
        renderGames();
        renderFavorites();
    }
    if (key === "cursorGlow") toggleCursorGlow(value);
}

function restartGamesTimer() {
    if (gamesTimer) clearInterval(gamesTimer);
    gamesTimer = settings.autoRefresh
        ? setInterval(loadGames, Number(settings.refreshInterval) || 5000)
        : null;
}

function resetSettings() {
    settings = { ...DEFAULT_SETTINGS };
    persistSettings();
    applySettings();
    syncSettingsControls();
    restartGamesTimer();
    renderGames();
    renderFavorites();
    setFormStatus("settingsStatus", "Settings restored to defaults.", "ok");
}

function clearFavorites() {
    favorites = [];
    persistFavorites();
    renderGames();
    renderFavorites();
    setFormStatus("settingsStatus", "Favorites cleared.", "ok");
}

// ─── SMALL UI HELPERS ─────────────────────────────────────────────────────────
function setFormStatus(id, message, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("ok", "error", "hidden");
    if (!message) { el.classList.add("hidden"); return; }
    if (kind) el.classList.add(kind);
}

function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!message) { el.classList.add("hidden"); el.textContent = ""; return; }
    el.textContent = message;
    el.classList.remove("hidden");
}

function relativeDate(value) {
    if (!value) return "Unknown";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ─── PAGE ROUTING ─────────────────────────────────────────────────────────────
function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    const page = document.getElementById(id);
    if (page) page.classList.remove("hidden");
}

function switchTab(tab) {
    if (tab === "owner" && !isOwnerAccount()) return switchTab("overview");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.remove("hidden");
    document.querySelectorAll(".tab").forEach(t => {
        if (t.getAttribute("onclick") === `switchTab('${tab}')`) t.classList.add("active");
    });
    if (tab === "owner") loadOwnerUsers();
    if (tab === "tracking") loadTracking();
    if (tab === "security") loadAccount();
    if (tab === "favorites") renderFavorites();
    if (tab === "stats") renderStats();
    if (tab === "settings") syncSettingsControls();
}

function isOwnerAccount() {
    return currentUser && currentUser.username === "dr.muffinn_09" && currentUser.isOwner === true;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function doSignup() {
    const email    = document.getElementById("su-email").value.trim();
    const username = document.getElementById("su-username").value.trim();
    const password = document.getElementById("su-password").value;
    const dob      = document.getElementById("su-dob").value;
    const robloxUsername = document.getElementById("su-roblox").value.trim().replace(/^@/, "");

    const btn = document.getElementById("signupBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Checking Roblox..."; }

    const res = await postJson("/api/signup", { email, username, password, dob, robloxUsername });
    const data = await res.json();

    if (btn) { btn.disabled = false; btn.textContent = "Create Account"; }

    if (data.ok) {
        showError("signupError", "");
        pendingVerifyUsername = data.username;
        openVerifyPage(data);
    } else {
        showError("signupError", data.error);
    }
}

async function doLogin() {
    const username = document.getElementById("li-username").value.trim();
    const password = document.getElementById("li-password").value;

    const res = await postJson("/api/login", { username, password });
    const data = await res.json();
    if (data.ok) {
        currentUser = { username: data.username, tier: data.tier, isOwner: data.isOwner, robloxUsername: data.robloxUsername || "" };
        showError("loginError", "");
        enterApp();
        return;
    }
    if (data.needsVerification) {
        showError("loginError", "");
        pendingVerifyUsername = data.username;
        openVerifyPage(data);
        return;
    }
    showError("loginError", data.error);
}

async function doLogout() {
    await postJson("/api/logout", {});
    currentUser = null;
    allGames = [];
    accountData = null;
    if (gamesTimer) clearInterval(gamesTimer);
    gamesTimer = null;
    if (trackingTimer) clearInterval(trackingTimer);
    trackingTimer = null;
    document.getElementById("ownerTabBtn").classList.add("hidden");
    showPage("landingPage");
}

async function checkSession() {
    const res  = await fetch("/api/me");
    const data = await res.json();
    if (data.ok) {
        currentUser = { username: data.username, tier: data.tier, isOwner: data.isOwner, robloxUsername: data.robloxUsername || "" };
        enterApp();
    }
}

// ─── ROBLOX PROFILE VERIFICATION ──────────────────────────────────────────────
function fillProfileCard(prefix, data) {
    const codeEl = document.getElementById(prefix + "Code");
    if (codeEl) codeEl.textContent = data.code || "";
    const nameEl = document.getElementById(prefix + "Roblox");
    if (nameEl) nameEl.textContent = data.robloxUsername || "your Roblox account";
    const avatarEl = document.getElementById(prefix + "Avatar");
    if (avatarEl) {
        if (data.avatar) {
            avatarEl.src = data.avatar;
            avatarEl.classList.remove("hidden");
        } else {
            avatarEl.classList.add("hidden");
        }
    }
}

function copyCode(elementId, statusId) {
    const text = document.getElementById(elementId)?.textContent || "";
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
        () => setFormStatus(statusId, "Code copied. Paste it into your Roblox About section.", "ok"),
        () => setFormStatus(statusId, "Could not copy automatically — select the code and copy it.", "error")
    );
}

function openVerifyPage(data) {
    pendingVerifyUsername = data.username || pendingVerifyUsername;
    fillProfileCard("verify", data);
    showError("verifyError", "");
    setFormStatus("verifyStatus", "", "");
    showPage("verifyPage");
}

async function doVerifyRoblox() {
    if (!pendingVerifyUsername) return showError("verifyError", "Start from the login page.");

    const btn = document.getElementById("verifyBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Checking your profile..."; }
    showError("verifyError", "");

    const res  = await postJson("/api/verify-roblox", { username: pendingVerifyUsername });
    const data = await res.json();

    if (btn) { btn.disabled = false; btn.textContent = "I've added it — Verify"; }

    if (!data.ok) return showError("verifyError", data.error || "Could not verify your profile");

    pendingVerifyUsername = "";
    currentUser = { username: data.username, tier: data.tier, isOwner: data.isOwner, robloxUsername: data.robloxUsername || "" };
    enterApp();
}

async function newVerifyCode() {
    if (!pendingVerifyUsername) return;
    const res  = await postJson("/api/new-code", { username: pendingVerifyUsername, kind: "verify" });
    const data = await res.json();
    if (!data.ok) return setFormStatus("verifyStatus", data.error || "Could not generate a new code", "error");
    document.getElementById("verifyCode").textContent = data.code;
    setFormStatus("verifyStatus", "New code generated. Paste this one instead.", "ok");
}

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────
function openForgotPage() {
    document.getElementById("fp-username").value = "";
    showError("forgotError", "");
    setFormStatus("forgotStatus", "", "");
    showPage("forgotPage");
}

async function doForgotPassword() {
    const username = document.getElementById("fp-username").value.trim();
    if (!username) return showError("forgotError", "Enter your Vantix username");

    setFormStatus("forgotStatus", "Looking up your account...", "");
    const res  = await postJson("/api/forgot-password", { username });
    const data = await res.json();
    if (!data.ok) {
        setFormStatus("forgotStatus", "", "");
        return showError("forgotError", data.error || "Could not start a password reset");
    }

    showError("forgotError", "");
    showError("resetError", "");
    setFormStatus("resetStatus", "", "");
    pendingResetUsername = data.username;
    document.getElementById("rp-password").value = "";
    fillProfileCard("reset", data);
    showPage("resetPage");
}

async function doResetPassword() {
    const password = document.getElementById("rp-password").value;
    if (!pendingResetUsername) return showError("resetError", "Start the reset from the login page.");
    if (!password) return showError("resetError", "Choose a new password");

    const btn = document.getElementById("resetBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Checking your profile..."; }

    const res  = await postJson("/api/reset-password", { username: pendingResetUsername, password });
    const data = await res.json();

    if (btn) { btn.disabled = false; btn.textContent = "Verify & Set Password"; }

    if (!data.ok) return showError("resetError", data.error || "Could not reset your password");

    showError("resetError", "");
    document.getElementById("li-username").value = pendingResetUsername;
    document.getElementById("li-password").value = "";
    pendingResetUsername = "";
    showError("loginError", "");
    setFormStatus("loginNotice", "Password updated. Log in with your new password.", "ok");
    showPage("loginPage");
}

async function newResetCode() {
    if (!pendingResetUsername) return;
    const res  = await postJson("/api/new-code", { username: pendingResetUsername, kind: "reset" });
    const data = await res.json();
    if (!data.ok) return setFormStatus("resetStatus", data.error || "Could not generate a new code", "error");
    document.getElementById("resetCode").textContent = data.code;
    setFormStatus("resetStatus", "New code generated. Paste this one instead.", "ok");
}

async function doChangePassword() {
    const currentPassword = document.getElementById("cp-current").value;
    const newPassword     = document.getElementById("cp-new").value;
    const confirmPassword = document.getElementById("cp-confirm").value;

    if (!currentPassword || !newPassword) return setFormStatus("changePwStatus", "Fill in every field.", "error");
    if (newPassword !== confirmPassword)  return setFormStatus("changePwStatus", "New passwords do not match.", "error");

    setFormStatus("changePwStatus", "Saving...", "");
    const res  = await postJson("/api/change-password", { currentPassword, newPassword });
    const data = await res.json();
    if (!data.ok) return setFormStatus("changePwStatus", data.error || "Could not change your password", "error");

    document.getElementById("cp-current").value = "";
    document.getElementById("cp-new").value = "";
    document.getElementById("cp-confirm").value = "";
    setFormStatus("changePwStatus", "Password updated.", "ok");
    loadAccount();
}

// ─── APP ENTRY ────────────────────────────────────────────────────────────────
const TIER_LABELS = {
    none:         "No Tier",
    bronze:       "Bronze",
    silver:       "Silver",
    gold:         "Gold",
    diamond:      "Diamond",
    platinum:     "Platinum",
    early_access: "Early Access",
    elite:        "Elite",
    absolute:     "Absolute"
};

function enterApp() {
    showPage("appPage");
    document.getElementById("userLabel").textContent = currentUser.username;
    const avatarEl = document.getElementById("accountAvatar");
    if (avatarEl) avatarEl.textContent = (currentUser.username || "V").slice(0, 1).toUpperCase();
    document.getElementById("tierBadge").textContent = TIER_LABELS[currentUser.tier] || "No Tier";
    document.getElementById("profileUsername").textContent = currentUser.username;
    document.getElementById("profileTier").textContent = TIER_LABELS[currentUser.tier] || "No Tier";
    document.getElementById("overviewTier").textContent = TIER_LABELS[currentUser.tier] || "No Tier";

    document.getElementById("ownerTabBtn").classList.add("hidden");
    if (isOwnerAccount()) {
        document.getElementById("ownerTabBtn").classList.remove("hidden");
    }

    syncSettingsControls();
    loadGames();
    loadTracking();
    loadAccount();
    switchTab("overview");
    restartGamesTimer();
    if (trackingTimer) clearInterval(trackingTimer);
    trackingTimer = setInterval(loadTracking, 5000);
}

// ─── ACCOUNT / SECURITY ───────────────────────────────────────────────────────
async function loadAccount() {
    if (!currentUser) return;
    try {
        const res = await fetch("/api/account");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok) return;
        accountData = data;
        renderAccount(data);
    } catch {}
}

function renderAccount(data) {
    const rows = [
        ["Username", escapeHtml(data.username)],
        ["Email", escapeHtml(data.email || "—")],
        ["Tier", escapeHtml(TIER_LABELS[data.tier] || data.tier || "No Tier")],
        ["Roblox account", escapeHtml(data.robloxUsername || "Not linked")],
        ["Roblox user ID", escapeHtml(data.robloxUserId ? String(data.robloxUserId) : "—")],
        ["Member since", escapeHtml(relativeDate(data.joinedAt))],
        ["Password last changed", escapeHtml(data.passwordChangedAt ? relativeDate(data.passwordChangedAt) : "Never")]
    ];
    const table = document.getElementById("accountRows");
    if (table) {
        table.innerHTML = rows.map(([k, v]) =>
            `<div class="kv-row"><span>${k}</span><b>${v}</b></div>`
        ).join("");
    }

    const badge = document.getElementById("verifyBadge");
    if (badge) {
        badge.className = "verify-badge " + (data.robloxVerified ? "verified" : "unverified");
        badge.textContent = data.robloxVerified ? "Roblox profile verified" : "Roblox profile not verified";
    }
    const avatar = document.getElementById("accountAvatarImg");
    if (avatar) {
        if (data.avatar) {
            avatar.src = data.avatar;
            avatar.classList.remove("hidden");
        } else {
            avatar.classList.add("hidden");
        }
    }
}

// ─── GAMES ────────────────────────────────────────────────────────────────────
async function loadGames() {
    if (!currentUser) return;
    const res  = await fetch("/api/games");
    if (!res.ok) return;
    allGames = await res.json();
    const overviewGames = document.getElementById("overviewGames");
    if (overviewGames) overviewGames.textContent = allGames.length;
    renderGames();
    renderFavorites();
    renderStats();
}

function isFavorite(placeId) {
    return favorites.includes(String(placeId));
}

function toggleFavorite(placeId) {
    const id = String(placeId);
    const i = favorites.indexOf(id);
    if (i === -1) favorites.push(id);
    else favorites.splice(i, 1);
    persistFavorites();
    renderGames();
    renderFavorites();
}

function sortGames(list) {
    const arr = [...list];
    const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
    switch (settings.sort) {
        case "players-desc": arr.sort((a, b) => (Number(b.players) || 0) - (Number(a.players) || 0)); break;
        case "name-asc":     arr.sort(byName); break;
        case "name-desc":    arr.sort((a, b) => byName(b, a)); break;
        case "players-asc":
        default:             arr.sort((a, b) => (Number(a.players) || 0) - (Number(b.players) || 0)); break;
    }
    if (settings.favoritesFirst) {
        arr.sort((a, b) => (isFavorite(b.placeId) ? 1 : 0) - (isFavorite(a.placeId) ? 1 : 0));
    }
    return arr;
}

function gameCardHtml(g) {
    const name = escapeHtml(g.name || "Unknown");
    const rawName = g.name || "Unknown";
    const placeId = escapeHtml(g.placeId || "");
    const icon = escapeHtml(g.icon || "");
    const creator = escapeHtml(g.creator || "Unknown");
    const players = Number(g.players) || 0;
    const heat = players === 0 ? "empty" : players < 10 ? "low" : players < 100 ? "mid" : "high";
    const fav = isFavorite(g.placeId);
    return `
    <div class="game-card">
        <div class="game-thumb" data-initial="${name.slice(0, 1).toUpperCase()}">
            ${icon ? `<img src="${icon}" alt="" loading="lazy" onerror="this.classList.add('img-fail')">` : ""}
            <div class="thumb-scrim"></div>
            <div class="thumb-pills">
                <span class="live-pill heat-${heat}"><i></i>${players} online</span>
                ${g.earlyAccess ? '<span class="ea-pill">Early Access</span>' : ""}
            </div>
            <button class="fav-btn${fav ? " on" : ""}" title="${fav ? "Remove from favorites" : "Add to favorites"}"
                    onclick="toggleFavorite('${jsString(g.placeId)}')" aria-label="Toggle favorite">
                <svg viewBox="0 0 24 24" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
        </div>
        <div class="game-info">
            <h3 title="${name}">${name}</h3>
            <div class="game-meta">
                <span class="meta-row"><em>Creator</em><b>${creator}</b></span>
                <span class="meta-row"><em>Place ID</em><b>${placeId}</b></span>
            </div>
            <div class="game-actions">
                <button class="btn-join" onclick="joinGame('${jsString(g.placeId)}', '${jsString(rawName)}')">
                    <span>Join Game</span>
                </button>
            </div>
        </div>
    </div>`;
}

function renderGames() {
    const search = (document.getElementById("gameSearch")?.value || "").toLowerCase();
    const grid   = document.getElementById("gamesGrid");
    if (!grid) return;
    let filtered = allGames.filter(g =>
        !search || String(g.name || "").toLowerCase().includes(search)
    );
    if (settings.hideEmpty) filtered = filtered.filter(g => (Number(g.players) || 0) > 0);
    filtered = sortGames(filtered);

    const countEl = document.getElementById("gamesCount");
    if (countEl) countEl.textContent = `${filtered.length} of ${allGames.length}`;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-games"><div class="no-games-mark"></div><h3>${currentUser.tier === "none" ? "No tier yet" : "No games found"}</h3><p>${currentUser.tier === "none" ? "Head to the Upgrade tab to unlock tracked servers." : "No tracked games match your tier, search, or filters right now."}</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(gameCardHtml).join("");
}

function renderFavorites() {
    const grid = document.getElementById("favoritesGrid");
    if (!grid) return;
    const list = sortGames(allGames.filter(g => isFavorite(g.placeId)));

    const countEl = document.getElementById("favoritesCount");
    if (countEl) countEl.textContent = String(list.length);

    if (list.length === 0) {
        grid.innerHTML = `<div class="no-games"><div class="no-games-mark"></div><h3>No favorites yet</h3><p>Tap the star on any game card to pin it here. Favorites are saved on this device.</p></div>`;
        return;
    }
    grid.innerHTML = list.map(gameCardHtml).join("");
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function renderStats() {
    const wrap = document.getElementById("statsGrid");
    if (!wrap) return;

    const total   = allGames.length;
    const players = allGames.reduce((sum, g) => sum + (Number(g.players) || 0), 0);
    const active  = allGames.filter(g => (Number(g.players) || 0) > 0).length;
    const early   = allGames.filter(g => g.earlyAccess).length;
    const avg     = total ? Math.round((players / total) * 10) / 10 : 0;
    const sorted  = [...allGames].sort((a, b) => (Number(b.players) || 0) - (Number(a.players) || 0));
    const busiest = sorted[0];
    const quietest = [...allGames].sort((a, b) => (Number(a.players) || 0) - (Number(b.players) || 0))[0];

    wrap.innerHTML = [
        ["Tracked Games", total, "Servers visible to your tier"],
        ["Players Online", players, "Across every tracked server"],
        ["Active Servers", active, "With at least one player"],
        ["Average Population", avg, "Players per tracked server"],
        ["Early Access", early, "Flagged early access games"],
        ["Favorites", favorites.length, "Pinned on this device"]
    ].map(([label, value, note]) => `
        <div class="stat-card">
            <span>${escapeHtml(String(value))}</span>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(note)}</p>
        </div>`).join("");

    const highlight = document.getElementById("statsHighlight");
    if (highlight) {
        if (!total) {
            highlight.innerHTML = `<p class="tab-sub">No tracked games yet. Once servers report in, their breakdown appears here.</p>`;
        } else {
            const max = Math.max(1, Number(busiest?.players) || 1);
            const bars = sorted.slice(0, 8).map(g => {
                const p = Number(g.players) || 0;
                const pct = Math.round((p / max) * 100);
                return `
                <div class="bar-row">
                    <span class="bar-label" title="${escapeHtml(g.name || "Unknown")}">${escapeHtml(g.name || "Unknown")}</span>
                    <span class="bar-track"><i style="width:${pct}%"></i></span>
                    <span class="bar-value">${p}</span>
                </div>`;
            }).join("");
            highlight.innerHTML = `
                <div class="stat-line"><em>Busiest</em><b>${escapeHtml(busiest?.name || "—")} · ${Number(busiest?.players) || 0} players</b></div>
                <div class="stat-line"><em>Quietest</em><b>${escapeHtml(quietest?.name || "—")} · ${Number(quietest?.players) || 0} players</b></div>
                <div class="bar-chart">${bars}</div>`;
        }
    }
}

// USER TRACKING
async function loadTracking() {
    if (!currentUser) return;
    const input = document.getElementById("trackUsername");
    const status = document.getElementById("trackStatus");
    if (!input || !status) return;
    try {
        const res = await fetch("/api/tracking");
        const data = await res.json();
        if (data.ok) {
            input.value = data.robloxUsername || "";
            currentUser.robloxUsername = data.robloxUsername || "";
            renderTrackingStatus(data);
            updateOverviewTracking(data);
        }
    } catch {
        status.textContent = "Could not load tracking settings.";
        status.classList.add("error");
    }
}

async function saveTracking() {
    const input = document.getElementById("trackUsername");
    const status = document.getElementById("trackStatus");
    const robloxUsername = input.value.trim().replace(/^@/, "");
    status.textContent = "Saving...";
    status.classList.remove("error");
    const res = await postJson("/api/tracking", { robloxUsername });
    const data = await res.json();
    if (data.ok) {
        input.value = data.robloxUsername || "";
        currentUser.robloxUsername = data.robloxUsername || "";
        renderTrackingStatus(data);
        updateOverviewTracking(data);
        loadAccount();
    } else {
        status.textContent = data.error || "Could not save tracking settings.";
        status.classList.add("error");
    }
}

function renderTrackingStatus(data) {
    const status = document.getElementById("trackStatus");
    if (!status) return;
    status.classList.remove("error", "online", "offline");
    if (!data.robloxUsername) {
        status.textContent = "No Roblox username set.";
        status.classList.add("offline");
        return;
    }
    if (data.online) {
        status.textContent = `Online now in ${data.gameName || "a connected game"}${data.placeId ? ` (${data.placeId})` : ""}.`;
        status.classList.add("online");
        return;
    }
    status.textContent = data.lastSeen
        ? `Offline. Last seen ${new Date(data.lastSeen).toLocaleString()}.`
        : `Watching for ${data.robloxUsername}. Offline right now.`;
    status.classList.add("offline");
}

function updateOverviewTracking(data) {
    const el = document.getElementById("overviewTracking");
    if (!el) return;
    if (!data?.robloxUsername) {
        el.textContent = "Not Set";
    } else if (data.online) {
        el.textContent = "Online";
    } else {
        el.textContent = "Offline";
    }
}

function toggleCursorGlow(enabled) {
    const glowEl = document.getElementById("cursorGlow");
    if (glowEl) glowEl.style.display = enabled ? "block" : "none";
}

function toggleGamesRefresh(enabled) {
    if (gamesTimer) clearInterval(gamesTimer);
    gamesTimer = enabled ? setInterval(loadGames, 5000) : null;
}

window.showPage = showPage;
window.switchTab = switchTab;
window.doSignup = doSignup;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.saveTracking = saveTracking;
window.renderGames = renderGames;
window.joinGame = joinGame;
window.openExec = openExec;
window.closeExecModal = closeExecModal;
window.popoutExec = popoutExec;
window.runExec = runExec;
window.toggleCursorGlow = toggleCursorGlow;
window.toggleGamesRefresh = toggleGamesRefresh;
window.doVerifyRoblox = doVerifyRoblox;
window.newVerifyCode = newVerifyCode;
window.newResetCode = newResetCode;
window.copyCode = copyCode;
window.openForgotPage = openForgotPage;
window.doForgotPassword = doForgotPassword;
window.doResetPassword = doResetPassword;
window.doChangePassword = doChangePassword;
window.toggleFavorite = toggleFavorite;
window.updateSetting = updateSetting;
window.resetSettings = resetSettings;
window.clearFavorites = clearFavorites;
window.filterOwnerUsers = filterOwnerUsers;
window.setTier = setTier;

// ─── JOIN GAME ────────────────────────────────────────────────────────────────
async function joinGame(placeId, name) {
    const res  = await postJson("/api/join", { placeId });
    const data = await res.json();
    if (!data.ok) {
        alert(data.error || "Could not join game.");
        return;
    }

    const token = data.token;
    const url   = `roblox://placeId=${placeId}&launchData=${encodeURIComponent(token)}`;

    const confirmed = confirm(`Open Roblox to join "${name}"?`);
    if (confirmed) {
        window.location.href = url;
    }
}

// ─── SCRIPT EXECUTION ─────────────────────────────────────────────────────────
function openExec(placeId, name) {
    execPlaceId = placeId;
    execGameName = name;
    document.getElementById("execModalTitle").textContent = `Execute - ${name}`;
    document.getElementById("execOutput").innerHTML = "";
    document.getElementById("execCode").value = "";
    appendExecLog(`// Connected to: ${name} (${placeId})`, "info");
    appendExecLog(`// Type Lua code and press Run or Ctrl+Enter.`, "info");
    document.getElementById("execModal").classList.remove("hidden");
    document.getElementById("execCode").focus();
}

function closeExecModal() {
    document.getElementById("execModal").classList.add("hidden");
    execPlaceId = null;
    execGameName = "";
}

function appendExecLog(text, type = "output") {
    const el   = document.getElementById("execOutput");
    const line = document.createElement("div");
    line.className = "log-line log-" + type;
    line.textContent = text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

function popoutExec() {
    if (!execPlaceId) return;
    const currentCode = document.getElementById("execCode").value;
    const title = `Execute - ${execGameName || execPlaceId}`;
    const popup = window.open("", "vantixExecutor", "popup=yes,width=860,height=640");
    if (!popup) {
        appendExecLog("Pop-out blocked. Allow pop-ups for this site and try again.", "warn");
        return;
    }

    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title.replace(/[<>&"]/g, "")}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#030a06;color:#e8f5ee;font-family:'Space Grotesk',Arial,sans-serif;height:100vh;display:flex;flex-direction:column}header{padding:14px 18px;border-bottom:1px solid rgba(0,255,136,.18);color:#00ff88;font:700 14px 'Space Mono',monospace;background:rgba(0,255,136,.04)}#out{flex:1;overflow:auto;padding:14px 18px;font:13px/1.7 'Space Mono',Consolas,monospace}.line-info{color:rgba(0,255,136,.55)}.line-input{color:#7fffb8}.line-output{color:#a0ffcc}.line-error{color:#ff7070}.line-warn{color:#ffd470}.input{border-top:1px solid rgba(0,255,136,.18);padding:12px 14px;background:rgba(0,0,0,.24)}textarea{width:100%;min-height:130px;resize:vertical;background:rgba(0,255,136,.04);border:1px solid rgba(0,255,136,.18);border-radius:10px;color:#e8f5ee;padding:10px 12px;font:13px/1.6 'Space Mono',Consolas,monospace;outline:none}textarea:focus{border-color:#00cc6a}footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:rgba(232,245,238,.5);font-size:12px}button{background:#00ff88;color:#000;border:0;border-radius:10px;padding:10px 24px;font-weight:800;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}
</style>
</head>
<body>
<header>${title.replace(/[<>&"]/g, "")}</header>
<div id="out"></div>
<div class="input">
<textarea id="code" spellcheck="false" placeholder="-- Enter Lua code&#10;print('Hello from server!')"></textarea>
<footer><span>Ctrl+Enter to run</span><button id="run">Run</button></footer>
</div>
<script>
const placeId=${JSON.stringify(execPlaceId)};
const initialCode=${JSON.stringify(currentCode)};
const out=document.getElementById("out");
const code=document.getElementById("code");
const run=document.getElementById("run");
code.value=initialCode;
let popupCsrf="";
function log(text,type="output"){const line=document.createElement("div");line.className="line-"+type;line.textContent=text;out.appendChild(line);out.scrollTop=out.scrollHeight;}
async function csrf(){if(popupCsrf)return popupCsrf;const r=await fetch("/api/csrf");const d=await r.json();popupCsrf=d.token||"";return popupCsrf;}
async function poll(id,attempts=0){if(attempts>120){log("No result after 60s. Check Roblox Developer Console for [Vantix] poll/result errors.","warn");return;}await new Promise(r=>setTimeout(r,500));try{const res=await fetch("/api/result?placeId="+encodeURIComponent(placeId)+"&id="+encodeURIComponent(id));const data=await res.json();if(data.status==="done"){log("Done: "+data.output,"output");}else{if(attempts>0&&attempts%20===0)log("Still waiting for Roblox to post the result...","info");poll(id,attempts+1);}}catch{poll(id,attempts+1);}}
async function execute(){const text=code.value.trim();if(!text)return;run.disabled=true;run.textContent="Sending...";log("> "+text,"input");try{const token=await csrf();const res=await fetch("/api/execute",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":token},body:JSON.stringify({placeId,code:text})});const data=await res.json();if(!data.ok){log("Error: "+(data.error||"Failed to send"),"error");}else{log("Sent to the tracked server. Watch Roblox Developer Console for [Vantix exec] output.","info");poll(data.id);code.value="";}}catch(e){log("Error: "+e.message,"error");}run.disabled=false;run.textContent="Run";}
run.addEventListener("click",execute);
document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.key==="Enter")execute();});
log("// Connected to: ${String(execGameName || "Game").replace(/[\\`$]/g, "")} ("+placeId+")","info");
log("// Pop-out executor ready.","info");
</script>
</body>
</html>`);
    popup.document.close();
    popup.focus();
}

async function runExec() {
    const code = document.getElementById("execCode").value.trim();
    if (!code || !execPlaceId) return;

    const btn = document.getElementById("execRunBtn");
    btn.disabled = true;
    btn.textContent = "Sending...";
    appendExecLog("> " + code, "input");

    const res  = await postJson("/api/execute", { placeId: execPlaceId, code });
    const data = await res.json();

    if (!data.ok) {
        appendExecLog("Error: " + (data.error || "Failed to send"), "error");
        btn.disabled = false;
        btn.textContent = "Run";
        return;
    }

    appendExecLog("Sent to the tracked server. Watch Roblox Developer Console for [Vantix exec] output.", "info");
    pollExecResult(data.id);

    btn.disabled = false;
    btn.textContent = "Run";
    document.getElementById("execCode").value = "";
}

async function pollExecResult(cmdId, attempts = 0) {
    if (attempts > 120) {
        appendExecLog("No result after 60s. Check Roblox Developer Console for [Vantix] poll/result errors.", "warn");
        return;
    }
    await new Promise(r => setTimeout(r, 500));
    try {
        const res  = await fetch(`/api/result?placeId=${execPlaceId}&id=${cmdId}`);
        const data = await res.json();
        if (data.status === "done") {
            appendExecLog("Done: " + data.output, "output");
        } else {
            if (attempts > 0 && attempts % 20 === 0) {
                appendExecLog("Still waiting for Roblox to post the result...", "info");
            }
            pollExecResult(cmdId, attempts + 1);
        }
    } catch {
        pollExecResult(cmdId, attempts + 1);
    }
}

// ─── OWNER PANEL ──────────────────────────────────────────────────────────────
async function loadOwnerUsers() {
    const res  = await fetch("/api/owner/users");
    if (!res.ok) return;
    ownerUsers = await res.json();
    renderOwnerUsers(ownerUsers);
}

function filterOwnerUsers() {
    const q = document.getElementById("ownerSearch").value.toLowerCase();
    renderOwnerUsers(ownerUsers.filter(u => String(u.username || "").toLowerCase().includes(q) || String(u.email || "").toLowerCase().includes(q)));
}

function renderOwnerUsers(list) {
    const tiers = ["none","bronze","silver","gold","diamond","platinum","early_access","elite","absolute"];
    const el = document.getElementById("ownerUsersTable");
    el.innerHTML = `
        <table class="owner-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Verified</th>
                    <th>Current Tier</th>
                    <th>Set Tier</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${list.map(u => {
                    const username = escapeHtml(u.username);
                    const email = escapeHtml(u.email);
                    const tier = escapeHtml(TIER_LABELS[u.tier] || u.tier || "none");
                    const selectId = userDomId(u.username);
                    const verified = u.emailVerified
                        ? '<span class="pill-yes">Yes</span>'
                        : '<span class="pill-no">No</span>';
                    return `
                    <tr>
                        <td>${username}</td>
                        <td>${email}</td>
                        <td>${verified}</td>
                        <td>${tier}</td>
                        <td>
                            <select class="tier-select" id="${selectId}">
                                ${tiers.map(t => `<option value="${t}" ${u.tier === t ? "selected" : ""}>${TIER_LABELS[t]}</option>`).join("")}
                            </select>
                        </td>
                        <td>
                            <button class="btn-save" onclick="setTier('${jsString(u.username)}')">Save</button>
                        </td>
                    </tr>
                `;
                }).join("")}
            </tbody>
        </table>`;
}

async function setTier(username) {
    const tier = document.getElementById(userDomId(username)).value;
    const res  = await postJson("/api/owner/set-tier", { username, tier });
    const data = await res.json();
    if (data.ok) {
        const u = ownerUsers.find(u => u.username === username);
        if (u) u.tier = tier;
        renderOwnerUsers(ownerUsers);
    } else {
        alert(data.error || "Failed to set tier");
    }
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "Enter") {
        if (!document.getElementById("execModal").classList.contains("hidden")) {
            runExec();
        }
    }
    if (e.key === "Escape") closeExecModal();
    if (e.key === "Enter") {
        const active = document.activeElement;
        if (!active) return;
        if (active.id === "fp-username") doForgotPassword();
        if (active.id === "rp-password") doResetPassword();
        if (active.id === "li-username" || active.id === "li-password") doLogin();
    }
});

document.getElementById("execModal").addEventListener("click", e => {
    if (e.target === document.getElementById("execModal")) closeExecModal();
});

document.addEventListener("click", e => {
    const pageTarget = e.target.closest("[data-page]");
    if (!pageTarget) return;
    e.preventDefault();
    showPage(pageTarget.dataset.page);
});

document.addEventListener("click", e => {
    const swatch = e.target.closest(".accent-swatch");
    if (!swatch) return;
    updateSetting("accent", swatch.dataset.accent);
    syncSettingsControls();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadSettings();
applySettings();
checkSession();
