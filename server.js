
let currentGame = null;
let selectedPlayer = null;
let selectedCommand = null;

/* OPEN EXECUTOR */
function openExecute(placeId, name) {

    currentGame = { placeId, name };

    document.getElementById("gameListPage").style.display = "none";
    document.getElementById("gameExecPage").style.display = "block";

    document.getElementById("selectedGameTitle").innerText = name;

    loadPlayers();
}

/* BACK */
function goBack() {
    document.getElementById("gameListPage").style.display = "block";
    document.getElementById("gameExecPage").style.display = "none";
}

/* ===================== */
/* PLAYERS (REAL LOOK UI) */
/* ===================== */

function loadPlayers() {

    const list = document.getElementById("playerList");
    list.innerHTML = "";

    // REAL LOOKING MOCK (replace later with real Roblox API if you want)
    const players = [
        { name: "Player1", id: "1" },
        { name: "Player2", id: "2" }
    ];

    players.forEach(p => {

        const img = `https://www.roblox.com/headshot-thumbnail/image?userId=${p.id}&width=150&height=150&format=png`;

        list.innerHTML += `
            <div class="playerCard" onclick="selectPlayer('${p.id}','${p.name}')">
                <img src="${img}">
                <span>${p.name}</span>
            </div>
        `;
    });
}

/* ===================== */
/* SELECT PLAYER */
/* ===================== */

function selectPlayer(id, name) {
    selectedPlayer = id;

    document.getElementById("selectedPlayer").innerText =
        "Selected Player: " + name;
}

/* ===================== */
/* SELECT COMMAND */
/* ===================== */

function selectCommand(cmd) {
    selectedCommand = cmd;

    document.getElementById("selectedCommand").innerText =
        "Selected Command: " + cmd;
}

/* ===================== */
/* HOVER FX (optional glow control) */
/* ===================== */

function hoverCmd(el) {
    el.style.transform = "scale(1.05)";
}

function unhoverCmd(el) {
    el.style.transform = "scale(1)";
}

/* ===================== */
/* EXECUTE */
/* ===================== */

async function executeCommand() {

    if (!currentGame || !selectedPlayer || !selectedCommand) return;

    await fetch("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            placeId: currentGame.placeId,
            cmd: selectedCommand,
            target: selectedPlayer
        })
    });

    alert("Executed!");
}

/* INIT */
document.getElementById("search")?.addEventListener("input", loadGames);
setInterval(loadGames, 3000);
loadGames();
