const glow = document.getElementById("cursorGlow");

/* CURSOR GLOW */
document.addEventListener("mousemove", e => {

    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";

});

/* STATE */
let allGames = [];

let currentGame = null;

let selectedPlayer = null;
let selectedCommand = null;

/* ========================= */
/* OPEN EXECUTOR */
/* ========================= */

function openExecute(placeId) {

    const game = allGames.find(
        g => String(g.placeId) === String(placeId)
    );

    if (!game) return;

    currentGame = game;

    document.getElementById("gameListPage").style.display =
        "none";

    document.getElementById("gameExecPage").style.display =
        "block";

    document.getElementById("selectedGameTitle").innerText =
        game.name;

    loadPlayers();
}

/* ========================= */
/* BACK */
/* ========================= */

function goBack() {

    document.getElementById("gameListPage").style.display =
        "block";

    document.getElementById("gameExecPage").style.display =
        "none";
}

/* ========================= */
/* LOAD GAMES */
/* ========================= */

async function loadGames() {

    try {

        const res = await fetch("/games");

        const games = await res.json();

        allGames = games;

        const container =
            document.getElementById("gamesContainer");

        const search =
            document.getElementById("search")
            .value
            .toLowerCase();

        container.innerHTML = "";

        games.forEach(game => {

            if (
                search &&
                !game.name.toLowerCase().includes(search)
            ) return;

            container.innerHTML += `

                <div class="card">

                    <img
                        src="${
                            game.icon &&
                            game.icon !== ""
                            ? game.icon
                            : "https://placehold.co/600x400"
                        }"
                    >

                    <div class="info">

                        <h2>${game.name}</h2>

                        <p>
                            👥 Players:
                            ${game.players}
                        </p>

                        <p>
                            👤 By:
                            ${game.creator}
                        </p>

                        <a
                            href="https://www.roblox.com/games/${game.placeId}"
                            target="_blank"
                        >
                            <button class="join">
                                Join
                            </button>
                        </a>

                        <button
                            class="join"
                            onclick="openExecute('${game.placeId}')"
                        >
                            Execute
                        </button>

                    </div>

                </div>

            `;
        });

    } catch (err) {

        console.error(err);

    }
}

/* ========================= */
/* LOAD PLAYERS */
/* ========================= */

function loadPlayers() {

    const list =
        document.getElementById("playerList");

    list.innerHTML = "";

    if (
        !currentGame ||
        !currentGame.playerList ||
        currentGame.playerList.length <= 0
    ) {

        list.innerHTML =
            "<p>No players found</p>";

        return;
    }

    currentGame.playerList.forEach(player => {

        const avatar =
`https://www.roblox.com/headshot-thumbnail/image?userId=${player.userId}&width=150&height=150&format=png`;

        list.innerHTML += `

            <div
                class="playerCard"
                onclick="selectPlayer('${player.userId}','${player.name}')"
            >

                <img src="${avatar}">

                <span>${player.name}</span>

            </div>

        `;
    });
}

/* ========================= */
/* SELECT PLAYER */
/* ========================= */

function selectPlayer(id, name) {

    selectedPlayer = id;

    document.getElementById("selectedPlayer").innerText =
        "Selected Player: " + name;
}

/* ========================= */
/* SELECT COMMAND */
/* ========================= */

function selectCommand(cmd) {

    selectedCommand = cmd;

    document.getElementById("selectedCommand").innerText =
        "Selected Command: " + cmd;
}

/* ========================= */
/* EXECUTE */
/* ========================= */

async function executeCommand() {

    if (
        !currentGame ||
        !selectedPlayer ||
        !selectedCommand
    ) {

        alert("Select player + command");

        return;
    }

    try {

        await fetch("/command", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                placeId: currentGame.placeId,

                cmd: selectedCommand,

                target: selectedPlayer
            })
        });

        alert("Executed!");

    } catch (err) {

        console.error(err);

    }
}

/* ========================= */
/* INIT */
/* ========================= */

document
.getElementById("search")
.addEventListener("input", loadGames);

setInterval(loadGames, 3000);

loadGames();
