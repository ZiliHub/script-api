const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// script của bạn
const scripts = {
  "abc123": `
print("AUTO FARM RUNNING 😎")
`
};

// encode đơn giản
function encode(str, key) {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    let k = key.charCodeAt(i % key.length);
    let c = str.charCodeAt(i);
    result += String.fromCharCode(c ^ k);
  }
  return result;
}

// API chính
app.get("/scripts/:id", (req, res) => {
  const id = req.params.id;

  if (!scripts[id]) return res.send("");

  // chặn người mở bằng trình duyệt
  const ua = req.headers["user-agent"];
  if (!ua || !ua.includes("Roblox")) {
    return res.send("access denied");
  }

  const encoded = encode(scripts[id], "my_secret");

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
  loadstring(d(${JSON.stringify(encoded)}, "my_secret"))()
  `;

  res.send(loader);
});

app.listen(PORT, () => {
  console.log("Server running...");
});