const fs = require("node:fs");
const crypto = require("node:crypto");
const file = "/key/keyfile";
if (!fs.existsSync(file))
  fs.writeFileSync(file, crypto.randomBytes(756).toString("base64"), {
    flag: "wx",
    mode: 0o400,
  });
fs.chownSync(file, 999, 999);
fs.chmodSync(file, 0o400);
console.log("MongoDB internal key ready; existing key preserved.");
