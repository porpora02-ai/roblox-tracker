
const glow = document.getElementById("cursorGlow");

/* MOUSE GLOW */
document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
});

/* STATE */
let selectedGame = null;
let selectedPlayer = null;
let selectedCommand = null;

/* ===================== */
/* PAGE SWITCHING */
/* ===================== */

function openGame(game) {
    selectedGame = game;

    document.getElementById("gameListPage").style.display = "none";
    document.getElementById("gameExecPage").style.display = "block";

    document.getElementById("selectedGameTitle").innerText = game.name;

    loadPlayers();
}

function backToGames() {
    document.getElementById("gameListPage").style.display = "block";
    document.getElementById("gameExecPage").style.display = "none";
}

/* ===================== */
/* LOAD GAMES */
/* ===================== */

async function loadGames() {
    const res = await fetch("/games");
    const games = await res.json();

    const container = document.getElementById("gamesContainer");
    const search = document.getElementById("search").value.toLowerCase();

    container.innerHTML = "";

    games.forEach(game => {

        if (search && !game.name.toLowerCase().includes(search)) return;

        container.innerHTML += `
            <div class="card">

                <img src="${game.icon || "https://placehold.co/600x400"}">

                <div class="info">

                    <h2>${game.name}</h2>

                    <p>👥 Players: ${game.players}</p>
                    <p>👤 By: ${game.creator}</p>

                    <a href="https://www.roblox.com/games/${game.placeId}" target="_blank">
                        <button class="join">Join</button>
                    </a>

                    <button class="join" onclick='openGame(${JSON.stringify(game)})'>
                        Execute
                    </button>

                </div>

            </div>
        `;
    });
}

/* ===================== */
/* PLAYERS (REAL FIX LATER HOOK) */
/* ===================== */

function loadPlayers() {

    const list = document.getElementById("playerList");
    list.innerHTML = "";

    // NOTE: Roblox cannot send full player list via HTTP easily
    // so this is placeholder structure for now

    list.innerHTML += `
        <div onclick="selectPlayer('example','Player1')" style="padding:10px;cursor:pointer">
            👤 Player1
        </div>
    `;
}

/* ===================== */
/* SELECTORS */
/* ===================== */

function selectPlayer(id, name) {
    selectedPlayer = id;
    document.getElementById("selectedPlayer").innerText =
        "Selected Player: " + name;
}

function selectCommand(cmd) {
    selectedCommand = cmd;
    document.getElementById("selectedCommand").innerText =
        "Selected Command: " + cmd;
}

/* ===================== */
/* EXECUTE COMMAND */
/* ===================== */

async function executeCommand() {

    if (!selectedGame || !selectedPlayer || !selectedCommand) return;

    await fetch("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            placeId: selectedGame.placeId,
            cmd: selectedCommand,
            target: selectedPlayer
        })
    });

    alert("Command sent!");
}

/* INIT */
document.getElementById("search").addEventListener("input", loadGames);
setInterval(loadGames, 3000);
loadGames();
