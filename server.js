const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const app = express();
app.use(express.json());

// 🔴 ENV VARS (RENDER)
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 📦 SAVE FILE (stores message IDs)
const FILE = "./games.json";

let games = {};
if (fs.existsSync(FILE)) {
    games = JSON.parse(fs.readFileSync(FILE));
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(games, null, 2));
}

// 🤖 DISCORD BOT
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let ready = false;

client.once("ready", () => {
    ready = true;
    console.log("✅ Bot online:", client.user.tag);
});

client.login(TOKEN).catch(err => {
    console.log("❌ Login error:", err.message);
});

// 🌐 TEST
app.get("/", (req, res) => {
    res.send("Tracker Running");
});

// 📡 ROBLOX ENDPOINT
app.post("/report", async (req, res) => {
    try {
        if (!ready) return res.json({ ok
