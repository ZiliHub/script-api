const express = require("express");
const app = express();

let keys = {
    "vip123": {
        hwid: null,
        exp: Date.now() + 7 * 86400000,
        flag: 0
    }
};

app.get("/l", (req, res) => {
    res.send(`
    local k="PUT_KEY_HERE"
    local h=game:GetService("RbxAnalyticsService"):GetClientId()
    local r=game:HttpGet("https://YOUR-APP.onrender.com/v?k="..k.."&h="..h)
    local d=game:GetService("HttpService"):JSONDecode(r)
    if d.s=="ok" then
        loadstring(game:HttpGet(d.u))()
    else
        warn("Key lỗi: "..d.s)
    end
    `)
})

app.get("/v", (req, res) => {
    let { k, h } = req.query
    let data = keys[k]

    if (!data) return res.json({ s: "invalid" })

    if (Date.now() > data.exp) {
        return res.json({ s: "expired" })
    }

    if (!data.hwid) {
        data.hwid = h
    } else if (data.hwid !== h) {
        data.flag++

        if (data.flag >= 3) {
            delete keys[k]
            return res.json({ s: "banned" })
        }

        return res.json({ s: "hwid" })
    }

    res.json({
        s: "ok",
        u: "https://raw.githubusercontent.com/ZiliHub/main.lua/refs/heads/main/main.lua?token=GHSAT0AAAAAADXKL762VJN6G4YEPC3ELPQA2OFKWQA"
    })
})

app.get("/create", (req, res) => {
    let key = Math.random().toString(36).substring(2, 10)

    keys[key] = {
        hwid: null,
        exp: Date.now() + 7 * 86400000,
        flag: 0
    }

    res.json({ key })
})

app.listen(3000, () => console.log("RUNNING"));
