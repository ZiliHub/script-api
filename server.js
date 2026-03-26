const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// 🔥 script nằm trong ENV (KHÔNG ở GitHub)
const scripts = {
  "x8f3k2": process.env.SCRIPT_MAIN
};

// encode
function encode(str, key) {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    let k = key.charCodeAt(i % key.length);
    let c = str.charCodeAt(i);
    result += String.fromCharCode(c ^ k);
  }
  return result;
}

// API
app.get("/api/v2/cache/:id", (req, res) => {
  const id = req.params.id;

  if (!scripts[id]) return res.send("");

  // chặn browser
  const ua = req.headers["user-agent"];
  if (!ua || !ua.includes("Roblox")) {
    return res.send("access denied");
  }

  const encoded = encode(scripts[id], "my_secret_key");

  const loader = `
  local function d(s,k)
    local r={}
    for i=1,#s do
      local c=s:byte(i)
      local k2=k:byte((i%#k)+1)
      r[i]=string.char(bit32.bxor(c,k2))
    end
    return table.concat(r)
  end
  loadstring(d(${JSON.stringify(encoded)}, "my_secret_key"))()
  `;

  res.send(loader);
});

app.listen(PORT, () => {
  console.log("Server running...");
});
