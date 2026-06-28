import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(CURRENT_DIR, "../..");
const SOURCE_ROOT = path.join(FRONTEND_ROOT, "src");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");

const listSourceFiles = (rootDir) => {
  const result = [];
  const pending = [rootDir];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && [".js", ".jsx"].includes(path.extname(entry.name))) {
        result.push(fullPath);
      }
    }
  }

  return result;
};

const sourceFiles = listSourceFiles(SOURCE_ROOT);
const toRelative = (filePath) => path.relative(REPO_ROOT, filePath).replaceAll("\\", "/");

const readImports = (source = "") => {
  const imports = [];
  const importPattern = /(?:import\s+(?:[^"']+?\s+from\s+)?|import\s*\()(["'])([^"']+)\1/g;
  let match;
  while ((match = importPattern.exec(source))) imports.push(match[2]);
  return imports;
};

describe("frontend runtime source safety", () => {
  it("semua ikon Ant Design yang dipakai di JSX sudah di-import", () => {
    const violations = [];

    sourceFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const usedIcons = new Set(
        [...source.matchAll(/<([A-Z][A-Za-z0-9]*(?:Outlined|Filled|TwoTone))\b/g)]
          .map((match) => match[1]),
      );
      if (usedIcons.size === 0) return;

      const importedIcons = new Set();
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@ant-design\/icons["']/gs)) {
        match[1].split(",").forEach((part) => {
          const normalized = part.trim();
          if (!normalized) return;
          importedIcons.add(normalized.split(/\s+as\s+/).at(-1).trim());
        });
      }

      const locallyDeclared = new Set(
        [...source.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9]*(?:Outlined|Filled|TwoTone))\b/g)]
          .map((match) => match[1]),
      );

      usedIcons.forEach((iconName) => {
        if (!importedIcons.has(iconName) && !locallyDeclared.has(iconName)) {
          violations.push(`${toRelative(filePath)}: ${iconName}`);
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it("entry ESM shared yang dipakai browser tidak mengimpor CommonJS", () => {
    const sharedEntries = new Set();

    sourceFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      readImports(source).forEach((specifier) => {
        if (!specifier.startsWith(".") || !specifier.includes("shared/") || !specifier.endsWith(".js")) return;
        sharedEntries.add(path.resolve(path.dirname(filePath), specifier));
      });
    });

    const violations = [];
    sharedEntries.forEach((entryPath) => {
      const source = fs.readFileSync(entryPath, "utf8");
      if (/\.cjs["']|\brequire\s*\(|module\.exports/.test(source)) {
        violations.push(toRelative(entryPath));
      }
    });

    expect(violations).toEqual([]);
  });

  it("import ke file dengan nama case-insensitive sama selalu menyebut ekstensi", () => {
    const collisions = new Set();
    const grouped = new Map();

    sourceFiles.forEach((filePath) => {
      const key = `${path.dirname(filePath).toLowerCase()}::${path.parse(filePath).name.toLowerCase()}`;
      const group = grouped.get(key) || [];
      group.push(filePath);
      grouped.set(key, group);
    });

    grouped.forEach((files, key) => {
      if (files.length > 1) collisions.add(key);
    });

    const violations = [];
    sourceFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      readImports(source).forEach((specifier) => {
        if (!specifier.startsWith(".") || path.extname(specifier)) return;
        const target = path.resolve(path.dirname(filePath), specifier);
        const key = `${path.dirname(target).toLowerCase()}::${path.basename(target).toLowerCase()}`;
        if (collisions.has(key)) violations.push(`${toRelative(filePath)} -> ${specifier}`);
      });
    });

    expect(violations).toEqual([]);
  });
});
