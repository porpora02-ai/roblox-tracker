const glow = document.getElementById("cursorGlow");

document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
});

let allGames = [];
let currentGame = null;
let selectedPlayer = null;
let selectedCommand = null;

/* =========================
   OPEN EXECUTOR
========================= */

function openExecute(placeId) {

    const game = allGames.find(
        g => String(g.placeId) === String(placeId)
    );

    if (!game) return;

    currentGame = game;

    document.getElementById("gameListPage").style.display = "none";
    document.getElementById("gameExecPage").style.display = "block";

    document.getElementById("selectedGameTitle").innerText = game.name;

    loadPlayers();
}

/* BACK */
function goBack() {
    document.getElementById("gameListPage").style.display = "block";
    document.getElementById("gameExecPage").style.display = "none";
}

/* =========================
   LOAD GAMES
========================= */

async function loadGames() {

    const res = await fetch("/games");
    const games = await res.json();

    allGames = games;

    const container = document.getElementById("gamesContainer");
    const search = document.getElementById("search").value.toLowerCase();

    container.innerHTML = "";

    games.forEach(game => {

        if (search && !game.name.toLowerCase().includes(search)) return;

        // 🔥 FIXED ICON (ROBLOX OFFICIAL API)
        const icon = game.placeId
            ? `https://thumbnails.roblox.com/v1/games/icons?universeIds=${game.placeId}&size=512x512&format=Png&isCircular=false`
            : "https://placehold.co/600x400";

        container.innerHTML += `
            <div class="card">

                <img src="${icon}">

                <div class="info">

                    <h2>${game.name}</h2>

                    <p>👥 Players: ${game.players}</p>
                    <p>👤 By: ${game.creator}</p>

                    <a href="https://www.roblox.com/games/${game.placeId}" target="_blank">
                        <button class="join">Join</button>
                    </a>

                    <button class="join" onclick="openExecute('${game.placeId}')">
                        Execute
                    </button>

                </div>

            </div>
        `;
    });
}

/* =========================
   LOAD PLAYERS (FIXED)
========================= */

function loadPlayers() {

    const list = document.getElementById("playerList");
    list.innerHTML = "";

    if (!currentGame || !currentGame.playerList || currentGame.playerList.length === 0) {
        list.innerHTML = "<p>No players found</p>";
        return;
    }

    currentGame.playerList.forEach(player => {

        const avatar =
`https://www.roblox.com/headshot-thumbnail/image?userId=${player.userId}&width=150&height=150&format=png`;

        list.innerHTML += `
            <div class="playerCard"
                onclick="selectPlayer('${player.userId}','${player.name}')">

                <img src="${avatar}">
                <span>${player.name}</span>

            </div>
        `;
    });
}

/* SELECT */
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

/* EXECUTE */
async function executeCommand() {

    if (!currentGame || !selectedPlayer || !selectedCommand) {
        alert("Select player + command first");
        return;
    }

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
