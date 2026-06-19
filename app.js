const glow = document.getElementById("cursorGlow");

// CURSOR GLOW
document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
});

// ─── LOAD GAMES ───────────────────────────────────────────────────────────────

async function loadGames() {
    const res = await fetch("/games");
    const games = await res.json();

    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    const search = document.getElementById("search").value.toLowerCase();

    games.forEach(game => {
        if (search && !game.name.toLowerCase().includes(search)) return;

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <img src="${game.icon || "https://placehold.co/600x400"}">
            <div class="info">
                <h2>${game.name}</h2>
                <p>👥 Players: ${game.players}</p>
                <p>🆔 Place ID: ${game.placeId}</p>
                <p>👤 By: ${game.creator}</p>
                <div class="card-actions">
                    <a href="https://www.roblox.com/games/${game.placeId}" target="_blank">
                        <button class="join">Join Game</button>
                    </a>
                    <button class="dev-panel-btn" data-placeid="${game.placeId}" data-name="${game.name}">
                        🖥️ Dev Panel
                    </button>
                </div>
            </div>`;

        container.appendChild(card);
    });

    // Attach Dev Panel button listeners
    document.querySelectorAll(".dev-panel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            openDevPanel(btn.dataset.placeid, btn.dataset.name);
        });
    });
}

document.getElementById("search").addEventListener("input", loadGames);
setInterval(loadGames, 3000);
loadGames();

// ─── DEVELOPER PANEL ──────────────────────────────────────────────────────────

let activePlaceId = null;
let activePlaceName = null;
const outputLog = [];

function openDevPanel(placeId, name) {
    activePlaceId = placeId;
    activePlaceName = name;

    document.getElementById("panelTitle").textContent = `Dev Panel — ${name}`;
    document.getElementById("consoleOutput").innerHTML = "";
    document.getElementById("codeInput").value = "";

    outputLog.length = 0;
    appendOutput(`// Connected to: ${name} (Place ID: ${placeId})`, "info");
    appendOutput(`// Commands are sent to the Roblox server script via polling.`, "info");
    appendOutput(`// Type Lua code and press Run or Ctrl+Enter.`, "info");

    document.getElementById("devPanelOverlay").classList.add("open");
    document.getElementById("codeInput").focus();
}

function closeDevPanel() {
    document.getElementById("devPanelOverlay").classList.remove("open");
    activePlaceId = null;
}

function appendOutput(text, type = "output") {
    const el = document.getElementById("consoleOutput");
    const line = document.createElement("div");
    line.className = `log-line log-${type}`;
    line.textContent = text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
}

async function runCommand() {
    const code = document.getElementById("codeInput").value.trim();
    if (!code || !activePlaceId) return;

    const btn = document.getElementById("runBtn");
    btn.disabled = true;
    btn.textContent = "Sending...";

    appendOutput(`> ${code}`, "input");

    try {
        const res = await fetch("/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeId: activePlaceId, code })
        });

        const data = await res.json();

        if (!data.ok) {
            appendOutput(`❌ Error: ${data.error || "Unknown error"}`, "error");
            btn.disabled = false;
            btn.textContent = "▶ Run";
            return;
        }

        appendOutput(`⏳ Command sent (ID: ${data.id}). Waiting for server response...`, "info");

        // Poll for result
        pollResult(data.id);

    } catch (err) {
        appendOutput(`❌ Network error: ${err.message}`, "error");
    }

    btn.disabled = false;
    btn.textContent = "▶ Run";
    document.getElementById("codeInput").value = "";
}

async function pollResult(cmdId, attempts = 0) {
    if (attempts > 30) {
        appendOutput(`⚠️ No response from server after 15s. The game server may be offline.`, "warn");
        return;
    }

    await new Promise(r => setTimeout(r, 500));

    try {
        const res = await fetch(`/result?placeId=${activePlaceId}&id=${cmdId}`);
        const data = await res.json();

        if (data.status === "done") {
            appendOutput(`✅ ${data.output}`, "output");
        } else {
            pollResult(cmdId, attempts + 1);
        }
    } catch {
        pollResult(cmdId, attempts + 1);
    }
}

// Ctrl+Enter to run
document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "Enter") {
        if (document.getElementById("devPanelOverlay").classList.contains("open")) {
            runCommand();
        }
    }
    if (e.key === "Escape") {
        closeDevPanel();
    }
});

// Close on overlay background click
document.getElementById("devPanelOverlay").addEventListener("click", e => {
    if (e.target === document.getElementById("devPanelOverlay")) {
        closeDevPanel();
    }
});

// Expose globally for onclick attributes
window.closeDevPanel = closeDevPanel;
window.runCommand = runCommand;
