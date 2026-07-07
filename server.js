            const thumbRes = await fetch(
                `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png`
            );

            const thumbData =
                await thumbRes.json();

            icon =
                thumbData?.data?.[0]?.imageUrl || "";

        } catch {}

        // SAVE GAME
        games[placeId] = {

            placeId,

            players:
                Number(players) || 0,

            name:
                name || "Unknown Game",

            creator:
                creator || "Unknown Creator",

            icon,

            updated: Date.now()
        };

        saveGames(games);

        console.log(
            "Updated:",
            games[placeId]
        );

        res.json({
            ok: true
        });

    } catch (err) {

        console.log(err);

        res.json({
            ok: false
        });
    }
});

// START
const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        "🌙 LunarX Running"
    );
});
