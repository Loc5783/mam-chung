const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".local");
fs.mkdirSync(path.join(local, "data"), { recursive: true });
const secretPath = path.join(local, "jwt-secret");
if (!fs.existsSync(secretPath))
  fs.writeFileSync(secretPath, crypto.randomBytes(48).toString("base64url"), {
    mode: 0o600,
  });
const children = [];
let replica;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once("exit", resolve);
          child.kill();
          const timeout = setTimeout(resolve, 5000);
          timeout.unref();
        }),
    ),
  );
  if (replica) await replica.stop({ doCleanup: false, force: false });
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Cổng ${port} đang được sử dụng. Hãy dừng bản chạy cũ trước.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
function run(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) void stop(code ?? 1);
  });
  return child;
}
(async () => {
  const webPort = Number(process.env.WEB_PORT || 5180);
  await Promise.all([
    assertPortAvailable(27118),
    assertPortAvailable(4000),
    assertPortAvailable(webPort),
  ]);
  console.log("Đang mở MongoDB replica set riêng cho bản chạy local…");
  replica = await MongoMemoryReplSet.create({
    binary: {
      version: "7.0.14",
      downloadDir:
        process.env.MONGOMS_DOWNLOAD_DIR ||
        path.join(local, "mongodb-binaries"),
    },
    instanceOpts: [{ port: 27118, dbPath: path.join(local, "data") }],
    replSet: {
      count: 1,
      name: "mam-chung-local",
      ip: "127.0.0.1",
      storageEngine: "wiredTiger",
    },
  });
  const env = {
    ...process.env,
    NODE_ENV: "development",
    PORT: "4000",
    TRUST_PROXY_HOPS: "0",
    CORS_ORIGIN: `http://127.0.0.1:${webPort}`,
    MONGODB_URI: replica.getUri("mam_chung_local"),
    JWT_SECRET: fs.readFileSync(secretPath, "utf8"),
  };
  run(["--import", "tsx", "src/server.ts"], path.join(root, "apps/api"), env);
  const viteBin = path.join(
    path.dirname(require.resolve("vite/package.json")),
    "bin/vite.js",
  );
  run(
    [viteBin, "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"],
    path.join(root, "apps/web"),
    env,
  );
  console.log(
    `Mầm Chung: http://127.0.0.1:${webPort}/ · Swagger: http://127.0.0.1:4000/api/docs`,
  );
  console.log(
    "Dữ liệu local nằm trong .local/data và được giữ khi dừng bình thường. Ctrl+C để dừng.",
  );
})().catch((error) => {
  console.error(error.message);
  void stop(1);
});
