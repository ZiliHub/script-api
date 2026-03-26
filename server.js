const express = require("express");
const crypto = require("crypto");
const app = express();

app.use(express.json());

// ===== DATABASE =====
let keys = {};

// ===== CONFIG =====
const SECRET = "super_secret_key";
const SCRIPT_URL = "https://raw.githubusercontent.com/ZiliHub/main.lua/refs/heads/main/main.lua?token=GHSAT0AAAAAADXKL762VJN6G4YEPC3ELPQA2OFKWQA"; // thay

// ===== RANDOM STRING =====
function genKey() {
    return crypto.randomBytes(4).toString("hex");
}

// ===== SIGNATURE =====
function sign(data) {
    return crypto.createHash("sha256").update(data + SECRET).digest("hex");
}

// ===== LOADER (ANTI SKID) =====
app.get("/l", (req, res) => {
    res.send(`
    local k="d494528c"
    local h=game:GetService("RbxAnalyticsService"):GetClientId()
    local t=tostring(math.floor(tick()))
    local s="${sign("loader")}"
    local u="https://script-api-6uxu.onrender.com/v?k="..k.."&h="..h.."&t="..t.."&s="..s
    local r=game:HttpGet(u)
    local d=game:GetService("HttpService"):JSONDecode(r)
    if d.s=="ok" then
        loadstring(game:HttpGet(d.u))()
    else
        warn("ERR: "..d.s)
    end
    `)
})

// ===== VERIFY =====
app.get("/v", (req, res) => {
    let { k, h, t, s } = req.query;

    // check signature
    if (s !== sign("loader")) {
        return res.json({ s: "sig_error" });
    }

    let data = keys[k];

    if (!data) return res.json({ s: "invalid" });

    if (Date.now() > data.exp) {
        return res.json({ s: "expired" });
    }

    // HWID LOCK
    if (!data.hwid) {
        data.hwid = h;
    } else if (data.hwid !== h) {
        data.flag++;

        if (data.flag >= 3) {
            delete keys[k];
            return res.json({ s: "banned" });
        }

        return res.json({ s: "hwid" });
    }

    // RATE LIMIT
    let now = Date.now();
    if (now - data.last < 2000) {
        return res.json({ s: "spam" });
    }
    data.last = now;

    // LOG
    console.log("OK:", k, h);

    res.json({
        s: "ok",
        u: SCRIPT_URL + "?v=" + Math.random()
    });
});

// ===== CREATE KEY =====
app.get("/create", (req, res) => {
    let days = parseInt(req.query.days || 7);

    let key = genKey();

    keys[key] = {
        hwid: null,
        exp: Date.now() + days * 86400000,
        flag: 0,
        last: 0
    };

    res.json({ key });
});

// ===== ADMIN VIEW =====
app.get("/admin", (req, res) => {
    res.json(keys);
});

// ===== DELETE =====
app.get("/delete", (req, res) => {
    delete keys[req.query.key];
    res.send("deleted");
});

app.listen(3000, () => console.log("PRO MAX RUNNING"));
