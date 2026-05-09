let selectedPlayer = null;
let selectedCommand = null;

/* LOAD PLAYERS (FROM YOUR GAME LIST SYSTEM) */
async function loadPlayers() {
    const res = await fetch("/games");
    const games = await res.json();

    const list = document.getElementById("playerList");
    list.innerHTML = "";

    games.forEach(g => {
        list.innerHTML += `
            <div onclick="selectPlayer('${g.placeId}', '${g.creator}')"
                 style="padding:10px;cursor:pointer">
                👤 ${g.creator}
            </div>
        `;
    });
}

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

/* SEND SIGNAL TO SERVER */
async function executeCommand() {
    if (!selectedPlayer || !selectedCommand) return;

    await fetch("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            placeId: "YOUR_PLACE_ID",
            cmd: selectedCommand,
            target: selectedPlayer
        })
    });

    alert("Command executed!");
}

setInterval(loadPlayers, 5000);
loadPlayers();
