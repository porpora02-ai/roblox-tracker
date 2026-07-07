const glow = document.getElementById("cursorGlow");

// CURSOR GLOW
document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
});

// LOAD GAMES
async function loadGames() {
    const res = await fetch("/games");
    const games = await res.json();
    const container = document.getElementById("gamesContainer");
    container.innerHTML = "";

    const search = document.getElementById("search").value.toLowerCase();

    games.forEach(game => {
        if (search && !game.name.toLowerCase().includes(search)) return;

        container.innerHTML += `
        <div class="card">
            <img src="${game.icon || "https://placehold.co/600x400"}">
            <div class="info">
                <h2>${game.name}</h2>
                <p>👥 Players: ${game.players}</p>
                <p>🆔 Place ID: ${game.placeId}</p>
                <p>👤 By: ${game.creator}</p>
                <a href="https://www.roblox.com/games/${game.placeId}" target="_blank">
                    <button class="join">Join Game</button>
                </a>
            </div>
        </div>`;
    });
}

document.getElementById("search").addEventListener("input", loadGames);

// LIVE UPDATES
setInterval(loadGames, 3000);

loadGames();
