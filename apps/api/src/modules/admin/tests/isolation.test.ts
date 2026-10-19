import fs from "node:fs";
import path from "node:path";

describe("Admin Module Content Isolation (Giai đoạn 1.7)", () => {
  const adminDir = path.resolve(__dirname, "..");
  const forbiddenModules = [
    "finance",
    "shared",
    "tasks",
    "fitness",
    "planning",
    "dashboard",
  ];

  function getFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "tests") {
          files.push(...getFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  test("mọi file trong modules/admin/** tuyệt đối không import từ các module nội dung người dùng", () => {
    const adminFiles = getFiles(adminDir);
    expect(adminFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: string }[] = [];

    for (const filePath of adminFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Kiểm tra câu lệnh import hoặc require
        if (
          (trimmed.startsWith("import ") ||
            trimmed.startsWith("export ") ||
            trimmed.includes("require(")) &&
          !trimmed.startsWith("//")
        ) {
          for (const forbidden of forbiddenModules) {
            const forbiddenPattern = new RegExp(
              `['"\`].*\\/${forbidden}(\\/|['"\`])`,
            );
            if (forbiddenPattern.test(trimmed)) {
              violations.push({
                file: path.relative(adminDir, filePath),
                line: `Line ${index + 1}: ${trimmed}`,
              });
            }
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
