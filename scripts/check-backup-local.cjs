// Real backup/restore rehearsal, using only two generated temporary replica sets.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { MongoClient, ObjectId } = require("mongodb");
const { backup, run } = require("./ops/backup.cjs");
const { restoreCheck } = require("./ops/restore-check.cjs");
async function main() {
  const tools = path.resolve(process.argv[2] || "");
  const extension = process.platform === "win32" ? ".exe" : "";
  for (const command of ["mongodump", "mongorestore"])
    await fs.access(path.join(tools, command + extension));
  const root = path.resolve(__dirname, "..");
  const bin = {
    version: "7.0.14",
    downloadDir: path.join(root, ".local/mongodb-binaries"),
  };
  const password = crypto.randomBytes(48).toString("base64url");
  let source,
    target,
    client,
    restored,
    directory,
    writing,
    stop = false;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "mam-backup-live-"));
    source = await MongoMemoryReplSet.create({
      binary: bin,
      replSet: {
        count: 1,
        name: "rs0",
        ip: "127.0.0.1",
        auth: {
          enable: true,
          customRootName: "qa_admin",
          customRootPwd: password,
        },
      },
    });
    target = await MongoMemoryReplSet.create({
      binary: bin,
      replSet: { count: 1, name: "restore-rs", ip: "127.0.0.1" },
    });
    const sourceURI = source.getUri();
    client = await MongoClient.connect(sourceURI, {
      auth: { username: "qa_admin", password },
      authSource: "admin",
    });
    await client.db("admin").command({
      createUser: "mam_backup",
      pwd: password,
      roles: [{ role: "backup", db: "admin" }],
    });
    const db = client.db("mam_chung"),
      walletId = new ObjectId();
    await db.collection("wallets").insertOne({
      _id: walletId,
      name: "FAKE restore-check wallet",
      balance: 800,
    });
    await db
      .collection("transactions")
      .createIndex({ sequence: 1 }, { unique: true });
    await db.collection("transactions").insertMany([
      { sequence: 0, type: "opening", amount: 1000, walletId },
      { sequence: 1, type: "expense", amount: 200, walletId },
    ]);
    writing = (async () => {
      for (let sequence = 2; sequence <= 31 && !stop; sequence++) {
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            await db
              .collection("wallets")
              .updateOne(
                { _id: walletId },
                { $inc: { balance: -1 } },
                { session },
              );
            await db
              .collection("transactions")
              .insertOne(
                { sequence, type: "expense", amount: 1, walletId },
                { session },
              );
          });
        } finally {
          await session.endSession();
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    })();
    const name = await backup({
      directory,
      password,
      execute: async (command, args) => {
        const config = args.find((x) => x.startsWith("--config=")).slice(9);
        const uri = new URL(sourceURI);
        uri.username = "mam_backup";
        uri.password = password;
        uri.searchParams.set("authSource", "admin");
        await fs.writeFile(
          config,
          "uri: " + JSON.stringify(uri.toString()) + "\n",
          { mode: 0o600 },
        );
        await run(path.join(tools, command + extension), args);
      },
    });
    stop = true;
    await writing;
    await restoreCheck({
      name,
      directory,
      execute: async (command, args) => {
        await run(
          path.join(tools, command + extension),
          args.map((a) =>
            a.startsWith("--uri=") ? "--uri=" + target.getUri() : a,
          ),
        );
      },
    });
    restored = await MongoClient.connect(target.getUri());
    const recovered = restored.db("mam_chung");
    const wallet = await recovered
      .collection("wallets")
      .findOne({ _id: walletId });
    const tx = await recovered
      .collection("transactions")
      .find({ walletId })
      .toArray();
    const ledger = tx.reduce(
      (sum, x) => sum + (x.type === "opening" ? x.amount : -x.amount),
      0,
    );
    assert.equal(wallet.balance, ledger);
    assert.ok(tx.length >= 2);
    assert.ok(
      (await recovered.collection("transactions").indexes()).some(
        (x) => x.name === "sequence_1" && x.unique,
      ),
    );
    assert.ok(
      await restored
        .db("admin")
        .collection("system.users")
        .findOne({ user: "mam_backup" }),
    );
    assert.ok(
      await recovered
        .collection("wallets")
        .findOne({ name: "FAKE restore-check wallet" }),
    );
    console.log(
      JSON.stringify({
        result: "PASS",
        fakeOnly: true,
        concurrentWrites: true,
        walletBalance: wallet.balance,
        ledgerBalance: ledger,
        transactions: tx.length,
        uniqueIndexRestored: true,
        backupUserRestored: true,
      }),
    );
  } finally {
    stop = true;
    if (writing) await writing;
    if (client) await client.close();
    if (restored) await restored.close();
    if (source) await source.stop();
    if (target) await target.stop();
    if (directory) {
      assert.ok(
        path
          .resolve(directory)
          .startsWith(path.resolve(os.tmpdir()) + path.sep),
      );
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}
main().catch(() => {
  console.error(
    "Real backup rehearsal failed; secrets omitted. Main local DB was not used.",
  );
  process.exitCode = 1;
});
