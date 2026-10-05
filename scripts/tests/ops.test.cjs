const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {
  configuration,
  writeConfiguration,
} = require("../prepare-production.cjs");
const { backup } = require("../ops/backup.cjs");
const { restoreCheck } = require("../ops/restore-check.cjs");
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mam-ops-test-"));
  t.after(async () => {
    assert.ok(
      path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep),
    );
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}
test("configuration uses independent secrets and real lines", () => {
  const entries = Object.fromEntries(
    configuration("Example.com", "ops@example.com")
      .trim()
      .split("\n")
      .map((x) => x.split("=")),
  );
  assert.equal(entries.DOMAIN, "example.com");
  assert.equal(entries.ACME_EMAIL, "ops@example.com");
  const secrets = [
    entries.JWT_SECRET,
    entries.MONGO_ROOT_PASSWORD,
    entries.MONGO_APP_PASSWORD,
    entries.MONGO_BACKUP_PASSWORD,
  ];
  assert.equal(new Set(secrets).size, 4);
  secrets.forEach((s) => assert.match(s, /^[a-zA-Z0-9_-]{64}$/));
});
test("configuration rejects dotenv injection, URL paths and local domains", () => {
  for (const d of [
    "https://example.com",
    "example.com\nJWT_SECRET=bad",
    "localhost",
    "app.local",
    "app.test",
    "example.com:443",
    "example.com/path",
  ])
    assert.throws(() => configuration(d, "ops@example.com"));
  assert.throws(() => configuration("example.com", "ops@example.com\nPORT=80"));
});
test("configuration cannot overwrite existing production credentials", async (t) => {
  const dir = await temporary(t),
    file = path.join(dir, ".env.production");
  writeConfiguration(file, "example.com", "ops@example.com");
  const first = await fs.readFile(file, "utf8");
  assert.throws(
    () => writeConfiguration(file, "example.com", "ops@example.com"),
    { code: "EEXIST" },
  );
  assert.equal(await fs.readFile(file, "utf8"), first);
});
async function fixture(dir, execute) {
  return backup({
    directory: dir,
    password: "test-password-do-not-use",
    execute:
      execute ||
      (async (command, args) => {
        assert.equal(command, "mongodump");
        await fs.writeFile(
          args.find((x) => x.startsWith("--archive=")).slice(10),
          "FAKE archive for orchestration test; not BSON",
        );
      }),
  });
}
test("backup protects credentials and publishes checksum only after success", async (t) => {
  const dir = await temporary(t);
  let config;
  const name = await fixture(dir, async (command, args) => {
    assert.equal(command, "mongodump");
    assert.ok(args.includes("--oplog"));
    assert.ok(args.includes("--gzip"));
    assert.ok(
      !args.some((x) => x.includes("test-password") || x.startsWith("--db")),
    );
    config = args.find((x) => x.startsWith("--config=")).slice(9);
    assert.match(await fs.readFile(config, "utf8"), /replicaSet=rs0/);
    await fs.writeFile(
      args.find((x) => x.startsWith("--archive=")).slice(10),
      "FAKE archive",
    );
  });
  assert.match(
    await fs.readFile(path.join(dir, name + ".sha256"), "utf8"),
    /^[a-f0-9]{64}  mam-chung-/,
  );
  assert.equal(
    JSON.parse(await fs.readFile(path.join(dir, "last-success.json"), "utf8"))
      .archive,
    name,
  );
  assert.ok(!(await fs.readdir(dir)).some((x) => x.endsWith(".partial")));
  await assert.rejects(fs.stat(config), { code: "ENOENT" });
});
test("failed dump removes generated partial files and preserves last success", async (t) => {
  const dir = await temporary(t);
  const first = await fixture(dir);
  await assert.rejects(
    fixture(dir, async (_cmd, args) => {
      await fs.writeFile(
        args.find((x) => x.startsWith("--archive=")).slice(10),
        "partial",
      );
      throw Error("tool failed");
    }),
  );
  assert.equal(
    JSON.parse(await fs.readFile(path.join(dir, "last-success.json"), "utf8"))
      .archive,
    first,
  );
  assert.ok(!(await fs.readdir(dir)).some((x) => x.endsWith(".partial")));
});
test("restore blocks tampered archives before executing any tool", async (t) => {
  const dir = await temporary(t),
    name = await fixture(dir);
  await fs.appendFile(path.join(dir, name), "tampered");
  let called = false;
  await assert.rejects(
    restoreCheck({
      name,
      directory: dir,
      execute: async () => {
        called = true;
      },
    }),
    /checksum/,
  );
  assert.equal(called, false);
});
test("restore target stays isolated and oplog replay cannot be disabled", async (t) => {
  const dir = await temporary(t),
    name = await fixture(dir);
  let args;
  await restoreCheck({
    name,
    directory: dir,
    uri: "mongodb://production",
    execute: async (command, a) => {
      assert.equal(command, "mongorestore");
      args = a;
    },
  });
  assert.ok(args.includes("--oplogReplay"));
  assert.ok(
    args.includes(
      "--uri=mongodb://mongo-restore:27017/?replicaSet=restore-rs&directConnection=true",
    ),
  );
  assert.ok(!args.some((x) => x.includes("production")));
});
test("restore rejects paths and incomplete backup filenames", async () => {
  for (const name of [
    "../x.archive.gz",
    "/backups/x",
    "mam-chung-123-abcd1234.archive.gz.partial",
  ])
    await assert.rejects(restoreCheck({ name }), /basename/);
});

test("backup health fails before first backup or after staleness", async (t) => {
  const { healthy } = require("../ops/backup-health.cjs");
  const dir = await temporary(t);
  assert.equal(healthy(dir), false);
  await fixture(dir);
  assert.equal(healthy(dir), true);
  assert.equal(healthy(dir, 86400, Date.now() + 3 * 86400000), false);
});
