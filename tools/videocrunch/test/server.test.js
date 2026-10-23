'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { createApplication } = require('../server');

const availableTools = [
  { name: 'PowerShell', available: true, version: '5.1' },
  { name: 'yt-dlp', available: true, version: 'test' },
  { name: 'FFmpeg', available: true, version: 'test' },
];

async function fixture(t, overrides = {}) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'video crunch test-'));
  const outputDir = path.join(root, 'exports');
  const dataDir = path.join(root, 'state');
  const runExport = async (job, resultPath, onLog) => {
    onLog('Downloading candidate 1 : fixture\n');
    const exportDir = path.join(job.outputDir, job.id);
    await fsp.mkdir(path.join(exportDir, 'original', 'attempt-01'), { recursive: true });
    await fsp.writeFile(path.join(exportDir, 'original', 'attempt-01', 'source.mp4'), '0123456789');
    await fsp.writeFile(path.join(exportDir, 'index.html'), '<video src="original/attempt-01/source.mp4" controls></video>');
    await fsp.writeFile(resultPath, JSON.stringify({ exportDir }));
    await fsp.writeFile(path.join(exportDir, 'manifest.json'), JSON.stringify({
      status: 'completed', original: { path: 'original/attempt-01/source.mp4', bytes: 10, sha256: 'test' },
      compressed: null,
    }));
    onLog('Export complete.\n');
  };
  const app = await createApplication({ dataDir, defaultOutputDir: outputDir,
    checkTools: async () => availableTools, runExport, ...overrides });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const config = await (await fetch(`${base}/api/config`)).json();
  t.after(async () => {
    await app.close();
    await fsp.rm(root, { recursive: true, force: true });
  });
  const start = (input = {}, headers = {}) => fetch(`${base}/api/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json',
      'X-WebVideoCrunch-Token': config.token, ...headers },
    body: JSON.stringify({ url: 'https://example.test/video', outputDir,
      compression: 'Crunch', skipCompression: false, ...input }),
  });
  async function finished(id) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const job = await (await fetch(`${base}/api/jobs/${id}`)).json();
      if (job.status !== 'running') return job;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail('Fixture export did not finish.');
  }
  return { app, base, config, root, outputDir, dataDir, runExport, start, finished };
}

test('serves the app and reports local tool readiness', async (t) => {
  const { base, config, outputDir } = await fixture(t);
  assert.equal(config.defaultOutputDir, outputDir);
  assert.equal(config.tools.length, 3);
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Good videos\. Smaller footprint\./);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/styles.css`)).status, 200);
});

test('runs an export, returns live details, and persists history', async (t) => {
  const { base, dataDir, start, finished } = await fixture(t);
  const response = await start();
  assert.equal(response.status, 202);
  const accepted = await response.json();
  const job = await finished(accepted.id);
  assert.equal(job.status, 'completed');
  assert.match(job.logs, /Downloading candidate/);
  assert.equal(job.manifest.original.bytes, 10);
  const list = await (await fetch(`${base}/api/jobs`)).json();
  assert.equal(list.jobs[0].id, job.id);
  assert.equal(list.jobs[0].logs, undefined);
  // Completion is visible just before the final atomic history write.
  await new Promise((resolve) => setTimeout(resolve, 30));
  const history = JSON.parse(await fsp.readFile(path.join(dataDir, 'history.json'), 'utf8'));
  assert.equal(history[0].status, 'completed');
});

test('serves playback, manifests, downloads and byte ranges', async (t) => {
  const { base, start, finished } = await fixture(t);
  const job = await finished((await (await start()).json()).id);
  const file = `${base}/api/jobs/${job.id}/files/original/attempt-01/source.mp4`;
  const full = await fetch(file);
  assert.equal(full.headers.get('content-type'), 'video/mp4');
  assert.equal(await full.text(), '0123456789');
  const range = await fetch(file, { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await range.text(), '2345');
  const suffix = await fetch(file, { headers: { Range: 'bytes=-3' } });
  assert.equal(await suffix.text(), '789');
  const badRange = await fetch(file, { headers: { Range: 'bytes=50-' } });
  assert.equal(badRange.status, 416);
  const head = await fetch(file, { method: 'HEAD' });
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal(await head.text(), '');
  const download = await fetch(`${file}?download=1`);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  await download.arrayBuffer();
  const player = await fetch(`${base}/api/jobs/${job.id}/files/index.html`);
  assert.equal(player.status, 200);
  await player.text();
  assert.equal((await fetch(`${base}/api/jobs/${job.id}/files/manifest.json`)).status, 200);
});

test('denies arbitrary file access and unknown jobs', async (t) => {
  const { base, start, finished } = await fixture(t);
  const job = await finished((await (await start()).json()).id);
  assert.equal((await fetch(`${base}/server.js`)).status, 404);
  assert.equal((await fetch(`${base}/api/jobs/${job.id}/files/page-source.html`)).status, 404);
  assert.equal((await fetch(`${base}/api/jobs/${job.id}/files/%2e%2e%5cmanifest.json`)).status, 404);
  assert.equal((await fetch(`${base}/api/jobs/00000000-0000-0000-0000-000000000000`)).status, 404);
});

test('rejects missing tokens, cross-origin requests, and untrusted hosts', async (t) => {
  const { base, start } = await fixture(t);
  assert.equal((await start({}, { 'X-WebVideoCrunch-Token': '' })).status, 403);
  assert.equal((await start({}, { Origin: 'https://other-site.test' })).status, 403);
  const hostStatus = await new Promise((resolve, reject) => {
    const request = http.get(`${base}/api/config`, { headers: { Host: 'untrusted.test' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
  });
  assert.equal(hostStatus, 403);
  assert.equal((await fetch(`${base}/api/config`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});

test('validates URLs, local output paths, compression modes, and option types', async (t) => {
  const { start } = await fixture(t);
  for (const input of [
    { url: 'file:///C:/private' }, { url: 'not a URL' }, { url: 'https://user:password@example.test/' },
    { outputDir: '..\\outside' }, { outputDir: '\\\\server\\share' }, { outputDir: 'C:\\bad|folder' },
    { compression: 'Unknown' }, { skipCompression: 'false' },
  ]) {
    const response = await start(input);
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('rejects malformed, oversized, and non-JSON requests', async (t) => {
  const { base, config } = await fixture(t);
  const headers = { 'Content-Type': 'application/json', 'X-WebVideoCrunch-Token': config.token };
  const malformed = await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: '{' });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: JSON.stringify('x'.repeat(20000)) });
  assert.equal(oversized.status, 413);
  const unsupported = await fetch(`${base}/api/jobs`, { method: 'POST',
    headers: { ...headers, 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(unsupported.status, 415);
});

test('prevents concurrent exports from different tabs', async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const context = await fixture(t, { runExport: async () => gate });
  const first = await context.start();
  assert.equal(first.status, 202);
  assert.equal((await context.start()).status, 409);
  release();
  assert.equal((await context.finished((await first.json()).id)).status, 'failed');
});

test('reports missing tools rather than accepting an unusable export', async (t) => {
  const { start } = await fixture(t, {
    checkTools: async () => [{ name: 'FFmpeg', available: false, error: 'Not found' }],
  });
  const response = await start();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Install FFmpeg/);
});

test('records native tool failures with explicit errors', async (t) => {
  const { start, finished } = await fixture(t, {
    runExport: async () => { throw new Error('Expected downloader failure'); },
  });
  const job = await finished((await (await start()).json()).id);
  assert.equal(job.status, 'failed');
  assert.match(job.error, /Expected downloader failure/);
  assert.match(job.logs, /Could not load export details/);
});

test('does not mark a successful process with missing results as completed', async (t) => {
  const { start, finished } = await fixture(t, { runExport: async () => {} });
  const job = await finished((await (await start()).json()).id);
  assert.equal(job.status, 'failed');
  assert.match(job.error, /Could not load export details/);
});

test('restores completed export history after an app restart', async (t) => {
  const { app, start, finished, dataDir, runExport, outputDir } = await fixture(t);
  const job = await finished((await (await start()).json()).id);
  await app.close();
  const restored = await createApplication({ dataDir, defaultOutputDir: outputDir,
    checkTools: async () => availableTools, runExport });
  await new Promise((resolve) => restored.server.listen(0, '127.0.0.1', resolve));
  t.after(() => restored.close());
  const response = await fetch(`http://127.0.0.1:${restored.server.address().port}/api/jobs`);
  const list = await response.json();
  assert.equal(list.jobs[0].id, job.id);
  assert.equal(list.jobs[0].status, 'completed');
});

test('marks interrupted exports failed with an explicit interruption stage on restart', async (t) => {
  const { app, dataDir, outputDir } = await fixture(t);
  await app.close();
  await fsp.writeFile(path.join(dataDir, 'history.json'), JSON.stringify([{
    id: 'interrupted', status: 'running', stage: 'Downloading source',
    url: 'https://example.test/video', logs: '', outputDir,
  }]));
  const restored = await createApplication({ dataDir, defaultOutputDir: outputDir,
    checkTools: async () => availableTools });
  await new Promise((resolve) => restored.server.listen(0, '127.0.0.1', resolve));
  t.after(() => restored.close());
  const data = await (await fetch(`http://127.0.0.1:${restored.server.address().port}/api/jobs`)).json();
  assert.equal(data.jobs[0].status, 'failed');
  assert.equal(data.jobs[0].stage, 'Export interrupted');
  assert.match(data.jobs[0].error, /app stopped/);
});
