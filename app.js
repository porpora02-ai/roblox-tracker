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
let ownerUsers   = [];
let gamesTimer   = null;
let trackingTimer = null;

// ─── PAGE ROUTING ─────────────────────────────────────────────────────────────
function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
}

function switchTab(tab) {
    if (tab === "owner" && !isOwnerAccount()) return switchTab("games");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.remove("hidden");
    document.querySelectorAll(".tab").forEach(t => {
        if (t.getAttribute("onclick") === `switchTab('${tab}')`) t.classList.add("active");
    });
    if (tab === "owner") loadOwnerUsers();
    if (tab === "tracking") loadTracking();
}

function isOwnerAccount() {
    return currentUser && currentUser.username === "dr.muffinn" && currentUser.isOwner === true;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function doSignup() {
    const email    = document.getElementById("su-email").value.trim();
    const username = document.getElementById("su-username").value.trim();
    const password = document.getElementById("su-password").value;
    const dob      = document.getElementById("su-dob").value;
    const errEl    = document.getElementById("signupError");

    const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, dob })
    });
    const data = await res.json();
    if (data.ok) {
        alert("Account created successfully. Please log in.");
        document.getElementById("li-username").value = username;
        document.getElementById("li-password").value = "";
        errEl.classList.add("hidden");
        showPage("loginPage");
    } else {
        errEl.textContent = data.error;
        errEl.classList.remove("hidden");
    }
}

async function doLogin() {
    const username = document.getElementById("li-username").value.trim();
    const password = document.getElementById("li-password").value;
    const errEl    = document.getElementById("loginError");

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.ok) {
        currentUser = { username: data.username, tier: data.tier, isOwner: data.isOwner, robloxUsername: data.robloxUsername || "" };
        enterApp();
    } else {
        errEl.textContent = data.error;
        errEl.classList.remove("hidden");
    }
}

async function doLogout() {
    await fetch("/api/logout", { method: "POST" });
    currentUser = null;
    allGames = [];
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
    } else {
        showPage("landingPage");
    }
}

// ─── APP ENTRY ────────────────────────────────────────────────────────────────
const TIER_LABELS = {
    none:         "No Tier",
    bronze:       "🥉 Bronze",
    silver:       "🥈 Silver",
    gold:         "🥇 Gold",
    diamond:      "💠 Diamond",
    platinum:     "👑 Platinum",
    early_access: "🚀 Early Access",
    elite:        "🔥 Elite",
    absolute:     "🌌 Absolute"
};

function enterApp() {
    showPage("appPage");
    document.getElementById("userLabel").textContent = currentUser.username;
    document.getElementById("tierBadge").textContent = TIER_LABELS[currentUser.tier] || "No Tier";

    document.getElementById("ownerTabBtn").classList.add("hidden");
    if (isOwnerAccount()) {
        document.getElementById("ownerTabBtn").classList.remove("hidden");
    }

    loadGames();
    loadTracking();
    if (gamesTimer) clearInterval(gamesTimer);
    gamesTimer = setInterval(loadGames, 5000);
    if (trackingTimer) clearInterval(trackingTimer);
    trackingTimer = setInterval(loadTracking, 5000);
}

// ─── GAMES ────────────────────────────────────────────────────────────────────
async function loadGames() {
    if (!currentUser) return;
    const res  = await fetch("/api/games");
    if (!res.ok) return;
    allGames = await res.json();
    renderGames();
}

function renderGames() {
    const search = (document.getElementById("gameSearch")?.value || "").toLowerCase();
    const grid   = document.getElementById("gamesGrid");
    const filtered = allGames.filter(g =>
        !search || g.name.toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-games"><h3>${currentUser.tier === "none" ? "No tier yet" : "No games found"}</h3><p>${currentUser.tier === "none" ? "Go to Upgrade tab to get a tier." : "No tracked games visible for your tier right now."}</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(g => `
        <div class="game-card">
            <img src="${g.icon || "https://placehold.co/400x160/030a06/00ff88?text=Vantix"}" alt="${g.name}">
            <div class="game-info">
                <h3>${g.name}</h3>
                <div class="game-meta">
                    <span>👥 Players: <b>${g.players}</b></span>
                    <span>🆔 <b>${g.placeId}</b></span>
                    <span>👤 <b>${g.creator}</b></span>
                    ${g.earlyAccess ? '<span>🚀 <b>Early Access</b></span>' : ""}
                </div>
                <div class="game-actions">
                    <button class="btn-join" onclick="joinGame('${g.placeId}', '${g.name}')">▶ Join Game</button>
                    <button class="btn-exec" onclick="giveGui('${g.placeId}', '${g.name}')">Give GUI</button>
                </div>
            </div>
        </div>
    `).join("");
}

async function giveGui(placeId, name) {
    const tracking = await fetch("/api/tracking").then(r => r.json()).catch(() => null);
    if (!tracking?.ok || !tracking.robloxUsername) {
        alert("Set your Roblox username in the Tracking tab first.");
        return;
    }
    if (!tracking.online || String(tracking.placeId) !== String(placeId)) {
        alert(`${tracking.robloxUsername} is not online in "${name}" right now.`);
        return;
    }
    const confirmed = confirm(`We see ${tracking.robloxUsername} is in "${name}". Would you like ${tracking.robloxUsername} to receive the GUI?`);
    if (!confirmed) return;

    const res = await fetch("/api/give-gui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId })
    });
    const data = await res.json();
    if (data.ok) {
        pollGiveGuiResult(placeId, data.id, data.username);
    } else {
        alert(data.error || "Could not send GUI.");
    }
}

async function pollGiveGuiResult(placeId, cmdId, username, attempts = 0) {
    if (attempts > 30) {
        alert(`GUI command was sent for ${username}, but the Roblox server did not answer yet.`);
        return;
    }
    await new Promise(r => setTimeout(r, 500));
    try {
        const res = await fetch(`/api/result?placeId=${placeId}&id=${cmdId}`);
        const data = await res.json();
        if (data.status === "done") {
            alert(data.output || `GUI sent to ${username}.`);
        } else {
            pollGiveGuiResult(placeId, cmdId, username, attempts + 1);
        }
    } catch {
        pollGiveGuiResult(placeId, cmdId, username, attempts + 1);
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
    const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ robloxUsername })
    });
    const data = await res.json();
    if (data.ok) {
        input.value = data.robloxUsername || "";
        currentUser.robloxUsername = data.robloxUsername || "";
        renderTrackingStatus(data);
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

// ─── JOIN GAME ────────────────────────────────────────────────────────────────
async function joinGame(placeId, name) {
    const res  = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId })
    });
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
    document.getElementById("execModalTitle").textContent = `💻 Execute — ${name}`;
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
}

function appendExecLog(text, type = "output") {
    const el   = document.getElementById("execOutput");
    const line = document.createElement("div");
    line.className = "log-line log-" + type;
    line.textContent = text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

async function runExec() {
    const code = document.getElementById("execCode").value.trim();
    if (!code || !execPlaceId) return;

    const btn = document.getElementById("execRunBtn");
    btn.disabled = true;
    btn.textContent = "Sending...";
    appendExecLog("> " + code, "input");

    const res  = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: execPlaceId, code })
    });
    const data = await res.json();

    if (!data.ok) {
        appendExecLog("❌ " + (data.error || "Failed to send"), "error");
        btn.disabled = false;
        btn.textContent = "▶ Run";
        return;
    }

    appendExecLog("⏳ Sent. Waiting for response...", "info");
    pollExecResult(data.id);

    btn.disabled = false;
    btn.textContent = "▶ Run";
    document.getElementById("execCode").value = "";
}

async function pollExecResult(cmdId, attempts = 0) {
    if (attempts > 30) {
        appendExecLog("⚠️ No response after 15s. Server may be offline.", "warn");
        return;
    }
    await new Promise(r => setTimeout(r, 500));
    try {
        const res  = await fetch(`/api/result?placeId=${execPlaceId}&id=${cmdId}`);
        const data = await res.json();
        if (data.status === "done") {
            appendExecLog("✅ " + data.output, "output");
        } else {
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
    renderOwnerUsers(ownerUsers.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
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
                    <th>Current Tier</th>
                    <th>Set Tier</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${list.map(u => `
                    <tr>
                        <td>${u.username}</td>
                        <td>${u.email}</td>
                        <td>${TIER_LABELS[u.tier] || u.tier}</td>
                        <td>
                            <select class="tier-select" id="tier-sel-${u.username}">
                                ${tiers.map(t => `<option value="${t}" ${u.tier === t ? "selected" : ""}>${TIER_LABELS[t]}</option>`).join("")}
                            </select>
                        </td>
                        <td>
                            <button class="btn-save" onclick="setTier('${u.username}')">Save</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>`;
}

async function setTier(username) {
    const tier = document.getElementById("tier-sel-" + username).value;
    const res  = await fetch("/api/owner/set-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tier })
    });
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
});

document.getElementById("execModal").addEventListener("click", e => {
    if (e.target === document.getElementById("execModal")) closeExecModal();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
checkSession();
