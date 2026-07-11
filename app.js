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
    }
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
    document.getElementById("tierBadge").textContent = TIER_LABELS[currentUser.tier] || "No Tier";
    document.getElementById("profileUsername").textContent = currentUser.username;
    document.getElementById("profileTier").textContent = TIER_LABELS[currentUser.tier] || "No Tier";
    document.getElementById("overviewTier").textContent = TIER_LABELS[currentUser.tier] || "No Tier";

    document.getElementById("ownerTabBtn").classList.add("hidden");
    if (isOwnerAccount()) {
        document.getElementById("ownerTabBtn").classList.remove("hidden");
    }

    loadGames();
    loadTracking();
    switchTab("overview");
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
    const overviewGames = document.getElementById("overviewGames");
    if (overviewGames) overviewGames.textContent = allGames.length;
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
                    <span>Players: <b>${g.players}</b></span>
                    <span>Place ID: <b>${g.placeId}</b></span>
                    <span>Creator: <b>${g.creator}</b></span>
                    ${g.earlyAccess ? '<span><b>Early Access</b></span>' : ""}
                </div>
                <div class="game-actions">
                    <button class="btn-join" onclick="joinGame('${g.placeId}', '${g.name}')">Join Game</button>
                    <button class="btn-exec" onclick="openExec('${g.placeId}', '${g.name}')">Execute</button>
                </div>
            </div>
        </div>
    `).join("");
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
        updateOverviewTracking(data);
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
function log(text,type="output"){const line=document.createElement("div");line.className="line-"+type;line.textContent=text;out.appendChild(line);out.scrollTop=out.scrollHeight;}
async function poll(id,attempts=0){if(attempts>120){log("No result after 60s. Check Roblox Developer Console for [Vantix] poll/result errors.","warn");return;}await new Promise(r=>setTimeout(r,500));try{const res=await fetch("/api/result?placeId="+encodeURIComponent(placeId)+"&id="+encodeURIComponent(id));const data=await res.json();if(data.status==="done"){log("Done: "+data.output,"output");}else{if(attempts>0&&attempts%20===0)log("Still waiting for Roblox to post the result...","info");poll(id,attempts+1);}}catch{poll(id,attempts+1);}}
async function execute(){const text=code.value.trim();if(!text)return;run.disabled=true;run.textContent="Sending...";log("> "+text,"input");try{const res=await fetch("/api/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId,code:text})});const data=await res.json();if(!data.ok){log("Error: "+(data.error||"Failed to send"),"error");}else{log("Sent to the tracked server. Watch Roblox Developer Console for [Vantix exec] output.","info");poll(data.id);code.value="";}}catch(e){log("Error: "+e.message,"error");}run.disabled=false;run.textContent="Run";}
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

    const res  = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: execPlaceId, code })
    });
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

document.addEventListener("click", e => {
    const pageTarget = e.target.closest("[data-page]");
    if (!pageTarget) return;
    e.preventDefault();
    showPage(pageTarget.dataset.page);
