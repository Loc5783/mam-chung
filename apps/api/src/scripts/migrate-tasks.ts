import "dotenv/config";
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { migrateTaskLists } from "../modules/tasks/migration";
import { Task, TaskList } from "../modules/tasks/models";
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--dry-run", "--apply"].includes(arg)) ||
    (args.includes("--dry-run") && args.includes("--apply"))
  )
    throw new Error("Dùng --dry-run hoặc --apply.");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Thiếu MONGODB_URI của database cần chuyển đổi.");
  const dryRun = !args.includes("--apply");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  if (!dryRun) {
    // Validate/count without writes before making a recoverable collection snapshot.
    await migrateTaskLists(true);
    const directory = resolve(
      __dirname,
      "../../../..",
      ".local",
      "task-migration-backups",
    );
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${Date.now()}-tasks.json`);
    const snapshot = {
      format: "mongodb-extended-json",
      createdAt: new Date(),
      tasks: await Task.collection.find().toArray(),
      task_lists: await TaskList.collection.find().toArray(),
    };
    await writeFile(path, mongoose.mongo.BSON.EJSON.stringify(snapshot), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(`Đã sao lưu tasks/task_lists: ${path}`);
    await TaskList.createIndexes();
  }
  console.log(JSON.stringify(await migrateTaskLists(dryRun), null, 2));
}
void main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Migration thất bại.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
