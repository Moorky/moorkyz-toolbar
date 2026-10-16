import { copyFile, mkdir } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(
  new URL("../src/toolbar.css", import.meta.url),
  new URL("../dist/toolbar.css", import.meta.url),
);
await copyFile(
  new URL("../../../LICENSE", import.meta.url),
  new URL("../dist/LICENSE", import.meta.url),
);
