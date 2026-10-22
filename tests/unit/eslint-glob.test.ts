import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, parse, relative } from "node:path";
import { Linter } from "eslint";

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(
  require.resolve("@next/eslint-plugin-next/package.json"),
);
const { getRootDirs } = pluginRequire("./dist/utils/get-root-dirs.js") as {
  getRootDirs: (context: {
    cwd: string;
    settings: { next?: { rootDir?: string | string[] } };
  }) => string[];
};
const slash = (path: string) => path.replaceAll("\\", "/");
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "next-eslint-glob-"));
  for (const path of [
    "apps/cafe/pages",
    "apps/bistro/pages",
    "packages/shared",
  ])
    mkdirSync(join(root, path), { recursive: true });
  writeFileSync(
    join(root, "apps/cafe/pages/about.tsx"),
    "export default function About() {}",
  );
  writeFileSync(join(root, "apps/README.md"), "Not an app directory.");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function roots(rootDir?: string | string[]) {
  return getRootDirs({ cwd: root, settings: { next: { rootDir } } }).sort();
}

describe("Next.js ESLint directory glob compatibility", () => {
  it("keeps the vulnerable braces and micromatch packages out of the lockfile", () => {
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    expect(
      Object.keys(lock.packages).filter((path) =>
        /(?:^|\/)node_modules\/(?:braces|micromatch)$/.test(path),
      ),
    ).toEqual([]);
  });

  it("defaults to the ESLint working directory", () => {
    expect(roots()).toEqual([root]);
  });

  it("returns a literal app directory without recursively expanding it", () => {
    expect(roots(slash(join(root, "apps/cafe")))).toEqual([
      slash(join(root, "apps/cafe")),
    ]);
  });

  it("matches directory globs without including files or nested directories", () => {
    expect(roots(slash(join(root, "apps/*")))).toEqual([
      slash(join(root, "apps/bistro")),
      slash(join(root, "apps/cafe")),
    ]);
  });

  it("preserves relative patterns and removes trailing directory separators", () => {
    const pattern = `${slash(relative(process.cwd(), root))}/apps/*/`;
    expect(roots(pattern)).toEqual([
      slash(relative(process.cwd(), join(root, "apps/bistro"))),
      slash(relative(process.cwd(), join(root, "apps/cafe"))),
    ]);
  });

  it("preserves the filesystem root separator", () => {
    const filesystemRoot = slash(parse(root).root);
    expect(roots(filesystemRoot)).toEqual([filesystemRoot]);
  });

  it("preserves brace alternatives in root-directory patterns", () => {
    expect(roots(`${slash(root)}/apps/{cafe,bistro}`)).toEqual([
      slash(join(root, "apps/bistro")),
      slash(join(root, "apps/cafe")),
    ]);
  });

  it("preserves arrays of root directories and Windows path separators", () => {
    expect(
      roots([
        join(root, "apps/cafe").replaceAll("/", "\\"),
        slash(join(root, "packages/*")),
      ]),
    ).toEqual([
      slash(join(root, "apps/cafe")),
      slash(join(root, "packages/shared")),
    ]);
  });

  it("still runs the Next.js link rule for apps discovered through a glob", () => {
    const messages = new Linter().verify(
      'const link = <a href="/about">About</a>;',
      {
        languageOptions: {
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { "@next/next": pluginRequire(".") },
        settings: { next: { rootDir: `${slash(root)}/apps/*` } },
        rules: { "@next/next/no-html-link-for-pages": "error" },
      },
    );
    expect(messages).toEqual([
      expect.objectContaining({
        ruleId: "@next/next/no-html-link-for-pages",
        severity: 2,
      }),
    ]);
  });

  it("handles deeply nested brace patterns without exhausting the stack", () => {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `const { getRootDirs } = require(process.argv[1]);
         getRootDirs({
           cwd: process.cwd(),
           settings: { next: { rootDir: "{".repeat(5000) + "missing" + "}".repeat(5000) } }
         });`,
        pluginRequire.resolve("./dist/utils/get-root-dirs.js"),
      ],
      { timeout: 5000, encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
