const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const dir = path.resolve(__dirname, "../apps/web/dist"),
  script = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
assert(
  !script.includes("__PRECACHE__") && !script.includes("__VERSION__"),
  "Build phải thay đầy đủ placeholder",
);
new vm.Script(script);
let files;
const handlers = {};
vm.runInNewContext(script, {
  self: {
    location: { origin: "http://localhost" },
    addEventListener: (n, f) => (handlers[n] = f),
  },
  caches: {
    open: async () => ({
      addAll: async (paths) => (files = Array.from(paths)),
    }),
  },
  URL,
  Set,
});
(async () => {
  let pending;
  handlers.install({ waitUntil: (p) => (pending = p) });
  await pending;
  assert(files.length > 5);
  assert(
    files.every(
      (x) => !x.startsWith("/api") && x !== "/index.html" && x !== "/",
    ),
  );
  for (const f of files) assert(fs.existsSync(path.join(dir, f.slice(1))), f);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, "manifest.webmanifest"), "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  for (const icon of manifest.icons) {
    const file = fs.readFileSync(path.join(dir, icon.src.slice(1))),
      [w, h] = icon.sizes.split("x").map(Number);
    assert.equal(file.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(file.readUInt32BE(16), w);
    assert.equal(file.readUInt32BE(20), h);
  }
  const chunks = files
    .filter((x) => x.endsWith(".js"))
    .map((x) => ({
      file: x,
      bytes: fs.statSync(path.join(dir, x.slice(1))).size,
    }));
  assert(
    chunks.every((x) => x.bytes < 500000),
    "Gói JS vượt500KB",
  );
  console.log(
    JSON.stringify({
      publicFiles: files.length,
      pngIcons: manifest.icons.length,
      largestChunkBytes: Math.max(...chunks.map((x) => x.bytes)),
      privateCacheFiles: 0,
      placeholders: 0,
    }),
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
