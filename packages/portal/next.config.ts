import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(portalDirectory, "../.."),
  transpilePackages: ["@moorkyz/toolbar"],
};

export default nextConfig;
