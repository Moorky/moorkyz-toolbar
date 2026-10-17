import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { basename, resolve, join } from "node:path";

const [artifactArgument, outputArgument] = process.argv.slice(2);
if (!artifactArgument || !outputArgument) {
  console.error(
    "Usage: node scripts/prepare-release-evidence.mjs <local-package.tgz> <evidence-directory>",
  );
  process.exit(2);
}
const status = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
const sourceScope = [
  "packages/toolbar",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.base.json",
  "LICENSE",
  "scripts/prepare-release-evidence.mjs",
];
const sourceStatus = execFileSync(
  "git",
  ["status", "--porcelain", "--", ...sourceScope],
  { encoding: "utf8" },
).trim();
if (sourceStatus !== "") {
  console.error(
    "Release evidence requires committed, clean package inputs. Nothing was written.",
  );
  process.exit(1);
}
const artifact = resolve(artifactArgument);
if (!artifact.endsWith(".tgz") || !statSync(artifact).isFile()) {
  throw new Error("Expected an existing local package tarball.");
}
const bytes = readFileSync(artifact);
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const manifest = JSON.parse(
  readFileSync("packages/toolbar/package.json", "utf8"),
);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const evidence = {
  formatVersion: 1,
  status: "NOT_AUTHORIZED_FOR_RELEASE",
  sourceRevision,
  sourceScope,
  unrelatedWorktreeChanges: status !== "",
  package: {
    name: manifest.name,
    version: manifest.version,
    file: basename(artifact),
    bytes: bytes.length,
    sha256,
  },
  site: {
    domain: "toolbar.moorkyz.com",
    proposedHosting:
      "Existing Coolify Docker/Next.js standalone design; no deployment performed",
  },
  pendingApprovals: [
    "Stable public contract and supported platform/version matrix",
    "Manual screen-reader, touch and device acceptance",
    "Approved numerical performance budgets",
    "Third-party distribution notices and release security review",
    "Exact infrastructure cost, account ownership and rollback target",
    "Package publishing/signing owner and separate explicit release authorization",
  ],
  prohibitedActions: [
    "publish",
    "deploy",
    "sign",
    "spend",
    "push",
    "external-product-integration",
  ],
};
const output = resolve(outputArgument);
mkdirSync(output, { recursive: true });
writeFileSync(
  join(output, "release-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  { flag: "wx" },
);
writeFileSync(
  join(output, "SHA256SUMS"),
  `${sha256}  ${basename(artifact)}\n`,
  { flag: "wx" },
);
console.log(JSON.stringify(evidence, null, 2));
