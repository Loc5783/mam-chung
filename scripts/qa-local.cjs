/* Isolated browser QA. Never reads/writes .local/data or the user's API on4000. */
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const root = path.resolve(__dirname, "..");
let mongo,
  server,
  api,
  closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
  if (api && api.exitCode === null) {
    api.kill();
    await Promise.race([
      new Promise((r) => api.once("exit", r)),
      new Promise((r) => setTimeout(r, 10000)),
    ]);
  }
  if (mongo) {
    await mongo.stop();
    console.log("QA stopped; generated temporary database cleaned.");
  }
  process.exit(code);
}
process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());
process.stdin.setEncoding("utf8");
process.stdin.on("data", (input) => {
  if (input.trim().toLowerCase() === "q") void close();
});
async function free(port) {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(port, "127.0.0.1", () => s.close(resolve));
  });
}
(async () => {
  await Promise.all([4001, 5174, 27119].map(free));
  mongo = await MongoMemoryReplSet.create({
    binary: {
      version: "7.0.14",
      downloadDir: path.join(root, ".local/mongodb-binaries"),
    },
    instanceOpts: [{ port: 27119 }],
    replSet: {
      count: 1,
      name: "mam-chung-qa",
      ip: "127.0.0.1",
      storageEngine: "wiredTiger",
    },
  });
  api = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: path.join(root, "apps/api"),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "4001",
      MONGODB_URI: mongo.getUri("mam_chung_qa"),
      JWT_SECRET: crypto.randomBytes(48).toString("base64url"),
      CORS_ORIGIN: "http://localhost:5174",
      TRUST_PROXY_HOPS: "0",
    },
    stdio: "inherit",
    windowsHide: true,
  });
  api.once("error", (e) => {
    console.error(e.message);
    void close(1);
  });
  api.once("exit", () => {
    if (!closing) void close(1);
  });
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch("http://127.0.0.1:4001/api/health");
      if (r.ok) break;
    } catch {}
    if (i === 119) throw Error("QA API not ready");
    await new Promise((r) => setTimeout(r, 250));
  }
  const vite = await import(
    pathToFileURL(
      path.join(
        path.dirname(require.resolve("vite/package.json")),
        "dist/node/index.js",
      ),
    ).href
  );
  server = await vite.preview({
    root: path.join(root, "apps/web"),
    configFile: path.join(root, "apps/web/vite.config.ts"),
    preview: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: { "/api": "http://127.0.0.1:4001" },
    },
  });
  console.log(
    "QA: http://localhost:5174/register · API4001 · Mongo27119 · database temporary, separate from demo. Enter q then Return to stop and remove only generated temporary QA database; Ctrl+C also supported.",
  );
})().catch((e) => {
  console.error(e.message);
  void close(1);
});
