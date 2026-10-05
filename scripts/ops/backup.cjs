const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { createReadStream } = require("node:fs");
const { spawn } = require("node:child_process");
const os = require("node:os");
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            Error(
              "Database tool failed; check connectivity, credentials and disk space (secrets omitted).",
            ),
          ),
    );
  });
}
async function digest(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function backup({
  directory = "/backups",
  password = process.env.MONGO_BACKUP_PASSWORD,
  execute = run,
} = {}) {
  if (!password) throw Error("Backup password required");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mam-backup-"));
  const config = path.join(scratch, "config.yaml");
  const name = `mam-chung-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${crypto.randomBytes(4).toString("hex")}.archive.gz`;
  const archive = path.join(directory, name);
  const partial = archive + ".partial";
  const checksumPartial = archive + ".sha256.partial";
  try {
    const uri = `mongodb://mam_backup:${encodeURIComponent(password)}@mongo:27017/?authSource=admin&replicaSet=rs0`;
    await fs.writeFile(config, `uri: ${JSON.stringify(uri)}\n`, {
      mode: 0o600,
    });
    // Full replica set dump: --db / namespace filters would invalidate --oplog.
    await execute("mongodump", [
      "--config=" + config,
      "--oplog",
      "--gzip",
      "--archive=" + partial,
    ]);
    const stat = await fs.stat(partial);
    if (stat.size === 0) throw Error("Empty backup archive");
    await fs.chmod(partial, 0o600);
    await fs.writeFile(checksumPartial, `${await digest(partial)}  ${name}\n`, {
      mode: 0o600,
    });
    await fs.rename(partial, archive);
    await fs.rename(checksumPartial, archive + ".sha256");
    await fs.writeFile(
      path.join(directory, "last-success.json"),
      JSON.stringify({
        at: new Date().toISOString(),
        archive: name,
        bytes: stat.size,
      }),
      { mode: 0o600 },
    );
    console.log("Backup complete: " + name);
    return name;
  } finally {
    if (
      !path
        .resolve(scratch)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + "mam-backup-")
    )
      throw Error("Unexpected scratch path; cleanup blocked");
    await fs.rm(scratch, { recursive: true, force: true });
    await fs.rm(partial, { force: true });
    await fs.rm(checksumPartial, { force: true });
  }
}
async function main() {
  process.umask(0o077);
  if (!process.argv.includes("--loop")) return backup();
  const seconds = Number(process.env.BACKUP_INTERVAL_SECONDS || 86400);
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 604800)
    throw Error("Backup interval must be 60..604800 seconds");
  while (true) {
    try {
      await backup();
    } catch {
      console.error(
        "Backup FAILED; last-success not advanced. Check storage and database; secrets omitted.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
if (require.main === module)
  main().catch(() => {
    console.error("Backup failed; secrets omitted.");
    process.exitCode = 1;
  });
module.exports = { backup, digest, run };
