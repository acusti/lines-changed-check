import { describe, it, expect } from "bun:test";
import { minimatch } from "minimatch";

// Unit tests for the glob pattern matching logic used in the action.
// The action itself requires GitHub API context, so we test the core
// filtering logic in isolation.

const testFiles = [
  "src/index.ts",
  "src/utils.ts",
  "src/components/Button.tsx",
  "src/__tests__/index.test.ts",
  "src/__tests__/utils.test.ts",
  "tests/integration/api.test.ts",
  "test/e2e/login.spec.ts",
  "prisma/migrations/20240101_init/migration.sql",
  "drizzle/0001_snapshot.json",
  "drizzle/meta/0001_snapshot.json",
  "src/db/migrations/0002_snapshot.sql",
  "package.json",
  "README.md",
];

function filterFiles(files: string[], patterns: string[]): string[] {
  return files.filter(
    (f) => !patterns.some((pattern) => minimatch(f, pattern))
  );
}

describe("exclusion pattern matching", () => {
  it("excludes test files with **/*.test.ts pattern", () => {
    const result = filterFiles(testFiles, ["**/*.test.ts"]);
    expect(result).not.toContain("src/__tests__/index.test.ts");
    expect(result).not.toContain("src/__tests__/utils.test.ts");
    expect(result).not.toContain("tests/integration/api.test.ts");
    expect(result).toContain("src/index.ts");
  });

  it("excludes spec files with **/*.spec.ts pattern", () => {
    const result = filterFiles(testFiles, ["**/*.spec.ts"]);
    expect(result).not.toContain("test/e2e/login.spec.ts");
    expect(result).toContain("src/index.ts");
  });

  it("excludes snapshot files with **/*snapshot* pattern", () => {
    const result = filterFiles(testFiles, ["**/*snapshot*"]);
    expect(result).not.toContain("drizzle/0001_snapshot.json");
    expect(result).not.toContain("drizzle/meta/0001_snapshot.json");
    expect(result).not.toContain("src/db/migrations/0002_snapshot.sql");
    expect(result).toContain("src/index.ts");
  });

  it("excludes migration directories with **/migrations/** pattern", () => {
    const result = filterFiles(testFiles, ["**/migrations/**"]);
    expect(result).not.toContain(
      "prisma/migrations/20240101_init/migration.sql"
    );
    expect(result).not.toContain("src/db/migrations/0002_snapshot.sql");
    expect(result).toContain("src/index.ts");
  });

  it("handles multiple patterns", () => {
    const result = filterFiles(testFiles, [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*snapshot*",
    ]);
    expect(result).toEqual([
      "src/index.ts",
      "src/utils.ts",
      "src/components/Button.tsx",
      "prisma/migrations/20240101_init/migration.sql",
      "package.json",
      "README.md",
    ]);
  });

  it("returns all files when no patterns given", () => {
    const result = filterFiles(testFiles, []);
    expect(result).toEqual(testFiles);
  });

  it("excludes __tests__ directories", () => {
    const result = filterFiles(testFiles, ["**/__tests__/**"]);
    expect(result).not.toContain("src/__tests__/index.test.ts");
    expect(result).not.toContain("src/__tests__/utils.test.ts");
    expect(result).toContain("tests/integration/api.test.ts");
  });
});
