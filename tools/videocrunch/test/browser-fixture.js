'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createApplication } = require('../server');

let root;
let app;
let source;
let shutdown;

function close() {
  if (!shutdown) shutdown = (async () => {
    if (app) await app.close();
    if (source?.listening) await new Promise((resolve) => source.close(resolve));
    if (root) await fsp.rm(root, { recursive: true, force: true });
  })();
  return shutdown;
}

async function main() {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'VideoCrunch browser fixture-'));
  const clip = path.join(root, 'sample.mp4');
  await promisify(execFile)('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=12:duration=2',
    '-c:v', 'mpeg4', '-q:v', '3', clip,
  ], { windowsHide: true });
  const size = (await fsp.stat(clip)).size;
  source = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__stop-fixture') {
      res.end('Stopping test fixture.');
      setImmediate(() => close().catch((error) => { console.error(error); process.exitCode = 1; }));
      return;
    }
    if (req.url !== '/sample.mp4') { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': size });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(clip).pipe(res);
  });
  await new Promise((resolve, reject) => {
    source.once('error', reject);
    source.listen(8877, '127.0.0.1', resolve);
  });
  app = await createApplication({ dataDir: path.join(root, 'state'),
    defaultOutputDir: path.join(root, 'exports') });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(8876, '127.0.0.1', resolve);
  });
  console.log('Browser fixture ready on loopback ports 8876 and 8877.');
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    close().catch((error) => { console.error(error); process.exitCode = 1; });
  });
}

main().catch(async (error) => {
  console.error(error);
  await close();
  process.exitCode = 1;
});
