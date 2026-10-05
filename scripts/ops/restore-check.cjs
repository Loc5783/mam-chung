const fs = require("node:fs/promises");
const path = require("node:path");
const { digest, run } = require("./backup.cjs");
async function restoreCheck({
  name = process.env.RESTORE_FILE,
  directory = "/backups",
  execute = run,
} = {}) {
  if (!/^mam-chung-[0-9TZ]+-[a-f0-9]{8}\.archive\.gz$/.test(name || ""))
    throw Error("Use a generated archive basename, not a path.");
  const archive = path.join(directory, name);
  const checksum = await fs.readFile(archive + ".sha256", "utf8");
  const expected = checksum.trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(expected) || (await digest(archive)) !== expected)
    throw Error("Backup checksum mismatch; restore blocked");
  // Target is deliberately fixed to a separate isolated restore-check service.
  await execute("mongorestore", [
    "--uri=mongodb://mongo-restore:27017/?replicaSet=restore-rs&directConnection=true",
    "--gzip",
    "--oplogReplay",
    "--archive=" + archive,
  ]);
  console.log(
    "Archive restored to isolated mongo-restore. Verify balances, indexes and application access before any production recovery.",
  );
}
if (require.main === module)
  restoreCheck().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { restoreCheck };
