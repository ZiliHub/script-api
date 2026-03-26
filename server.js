const express = require("express");
const axios = require("axios");
const app = express();

// fake database (sau nâng cấp thành db thật)
let keys = {
  "abc123": { hwid: null, expires: Date.now() + 86400000 } // 1 ngày
};

// API GET SCRIPT
app.get("/scripts/:id", async (req, res) => {
  const { key, hwid } = req.query;

  if (!keys[key]) return res.send("print('invalid key')");

  // check hết hạn
  if (Date.now() > keys[key].expires) {
    return res.send("print('key expired')");
  }

  // lock HWID
  if (!keys[key].hwid) {
    keys[key].hwid = hwid;
  } else if (keys[key].hwid !== hwid) {
    return res.send("print('hwid not match')");
  }

  try {
    const r = await axios.get("https://raw.githubusercontent.com/USERNAME/REPO/main/main.lua");
    res.send(r.data);
  } catch {
    res.send("print('error loading script')");
  }
});

// API TẠO KEY
app.get("/create-key", (req, res) => {
  const newKey = Math.random().toString(36).substring(2, 10);
  keys[newKey] = { hwid: null, expires: Date.now() + 86400000 };
  res.send(newKey);
});

app.listen(3000, () => console.log("Server running"));
