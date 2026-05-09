
const glow = document.getElementById("cursorGlow");

/* MOUSE GLOW */
document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
});

/* GET URL PARAMS */
function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

/* ROUTING CHECK */
let currentGame = null;

/* ===================== */
/* LOAD GAMES PAGE */
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

                    <button class="join" onclick="openExecute('${game.placeId}', '${game.name}')">
                        Execute
                    </button>

                </div>

            </div>
        `;
    });
}

/* ===================== */
/* NAV TO EXECUTOR PAGE */
/* ===================== */

function openExecute(placeId, name) {
    window.location.href = `/execute?id=${placeId}&name=${encodeURIComponent(name)}`;
}

/* ===================== */
/* EXECUTOR PAGE LOAD */
/* ===================== */

async function loadExecutePage() {

    const id = getParam("id");
    const name = getParam("name");

    if (!id) return;

    document.getElementById("gameListPage").style.display = "none";
    document.getElementById("gameExecPage").style.display = "block";

    document.getElementById("selectedGameTitle").innerText = name;

    currentGame = { placeId: id, name };

    loadPlayers();
}

/* ===================== */
/* BACK BUTTON */
/* ===================== */

function goBack() {
    window.location.href = "/";
}

/* ===================== */
/* PLAYERS (PLACEHOLDER FOR NOW) */
/* ===================== */

function loadPlayers() {
    const list = document.getElementById("playerList");
    list.innerHTML = "";

    list.innerHTML += `
        <div onclick="selectPlayer('1','Player1')" style="padding:10px;cursor:pointer">
            👤 Player1
        </div>
    `;
}

/* ===================== */
/* SELECTORS */
/* ===================== */

let selectedPlayer = null;
let selectedCommand = null;

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
document.getElementById("search").addEventListener("input", loadGames);
setInterval(loadGames, 3000);
loadGames();
loadExecutePage();
