const glow = document.getElementById("cursorGlow");

document.addEventListener("mousemove", e => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
});

async function loadGames() {
    const res = await fetch("/games");
    const games = await res.json();

    const container = document.getElementById("gamesContainer");

    const search = document.getElementById("search").value.toLowerCase();

    container.innerHTML = "";

    games
        .sort((a, b) => b.players - a.players)
        .forEach(game => {

            if (search && !game.name.toLowerCase().includes(search)) return;

            container.innerHTML += `
                <div class="card">

                    <img src="${game.icon || "https://placehold.co/600x400"}">

                    <div class="info">

                        <h2>${game.name}</h2>

                        <p>👥 Players: ${game.players}</p>
                        <p>👤 By: ${game.creator}</p>
                        <p>🆔 ${game.placeId}</p>

                        <a href="https://www.roblox.com/games/${game.placeId}" target="_blank">
                            <button class="join">Join Game</button>
                        </a>

                    </div>

                </div>
            `;
        });
}

document.getElementById("search").addEventListener("input", loadGames);

setInterval(loadGames, 3000);
loadGames();
