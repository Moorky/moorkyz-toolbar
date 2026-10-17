import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const tests = readdirSync("packages/toolbar/test")
  .filter((name) => name.endsWith(".test.js"))
  .map((name) => join("packages", "toolbar", "test", name));
const core = [
  "configuration",
  "capabilities",
  "context",
  "commands",
  "surfaces",
];
const cases = [
  {
    name: "Headless core branch coverage >=90%",
    args: [
      ...core.map(
        (name) => `--test-coverage-include=packages/toolbar/dist/${name}.js`,
      ),
      "--test-coverage-branches=90",
    ],
  },
  {
    name: "Emitted library overall lines, branches and functions >=85%",
    args: [
      "--test-coverage-include=packages/toolbar/dist/*.js",
      "--test-coverage-lines=85",
      "--test-coverage-branches=85",
      "--test-coverage-functions=85",
    ],
  },
];
for (const check of cases) {
  console.log(`\n${check.name}`);
  const result = spawnSync(
    process.execPath,
    ["--test", "--experimental-test-coverage", ...check.args, ...tests],
    {
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
