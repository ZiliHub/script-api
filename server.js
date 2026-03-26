const express = require("express");
const axios = require("axios");

const app = express();

const validKeys = ["abc123"];
const validHWID = ["HWID_1"];

app.get("/api/v2/cache/x8f3k2", async (req, res) => {
  const { key, hwid } = req.query;

  if (!validKeys.includes(key)) return res.send("invalid key");
  if (!validHWID.includes(hwid)) return res.send("hwid not allowed");

  const r = await axios.get("https://raw.githubusercontent.com/ZiliHub/REPO/main/main.lua");
  res.send(r.data);
});

app.listen(3000, () => console.log("running"));
