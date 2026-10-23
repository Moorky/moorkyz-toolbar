'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const { createApplication } = require('../server');
const run = promisify(execFile);

test('real Windows media exports preserve originals and produce playable files in every mode', { timeout: 240000 }, async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'VideoCrunch media with spaces-'));
  const mediaPath = path.join(root, 'fixture.mp4');
  let app;
  let sourceServer;
  t.after(async () => {
    if (app) await app.close();
    if (sourceServer?.listening) await new Promise((resolve) => sourceServer.close(resolve));
    await fsp.rm(root, { recursive: true, force: true });
  });
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-f', 'lavfi', '-i', 'testsrc2=size=1440x1080:rate=12:duration=1',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-vf', 'setsar=4/3', '-c:v', 'mpeg4', '-q:v', '3', '-c:a', 'aac', '-shortest', mediaPath,
  ], { windowsHide: true });
  const media = await fsp.readFile(mediaPath);
  const digest = createHash('sha256').update(media).digest('hex').toUpperCase();
  sourceServer = http.createServer((req, res) => {
    if (req.url === '/watch') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>Local test video</title><video src="/fixture.mp4" controls></video>');
    } else if (req.url === '/fixture.mp4') {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': media.length });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(mediaPath).pipe(res);
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => sourceServer.listen(0, '127.0.0.1', resolve));
  const sourceBase = `http://127.0.0.1:${sourceServer.address().port}`;
  app = await createApplication({ dataDir: path.join(root, 'state'),
    defaultOutputDir: path.join(root, 'exports') });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.ok(config.tools.every((tool) => tool.available), JSON.stringify(config.tools));

  for (const mode of ['Balanced', 'Crunch', 'Extreme', 'Original']) {
    await t.test(mode, { timeout: 60000 }, async () => {
      const response = await fetch(`${base}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WebVideoCrunch-Token': config.token },
        body: JSON.stringify({ url: `${sourceBase}/${mode === 'Balanced' ? 'watch' : 'fixture.mp4'}`,
          outputDir: config.defaultOutputDir, compression: mode === 'Original' ? 'Crunch' : mode,
          skipCompression: mode === 'Original' }),
      });
      assert.equal(response.status, 202, await response.clone().text());
      const accepted = await response.json();
      let job;
      for (let count = 0; count < 300; count++) {
        job = await (await fetch(`${base}/api/jobs/${accepted.id}`)).json();
        if (job.status !== 'running') break;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.equal(job.status, 'completed', job.logs);
      assert.equal(job.manifest.original.path, 'original/source.mp4');
      assert.equal(job.manifest.original.sha256, digest);
      assert.deepEqual(await fsp.readFile(path.join(job.exportDir, 'original', 'source.mp4')), media);
      assert.equal(job.manifest.pageSource.saved, mode === 'Balanced');
      const player = await fetch(`${base}/api/jobs/${job.id}/files/index.html`);
      const html = await player.text();
      assert.match(html, mode === 'Original' ? /src="original\/source.mp4"/ : /src="compressed\/video.mp4"/);
      for (const file of ['page-url.txt', 'detected-urls.txt', 'resolved-stream-urls.txt', 'manifest.json', 'index.html']) {
        await fsp.access(path.join(job.exportDir, file));
      }
      await assert.rejects(fsp.access(path.join(job.exportDir, '.downloads')));
      if (mode === 'Original') {
        assert.equal(job.manifest.compressed, null);
        return;
      }
      const compressed = path.join(job.exportDir, 'compressed', 'video.mp4');
      const { stdout } = await run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', compressed]);
      const streams = JSON.parse(stdout).streams;
      const video = streams.find((stream) => stream.codec_type === 'video');
      assert.equal(video.codec_name, 'h264');
      assert.equal(video.pix_fmt, 'yuv420p');
      assert.equal(video.sample_aspect_ratio, '1:1');
      assert.equal(video.width, mode === 'Extreme' ? 1280 : 1920);
      assert.equal(video.height, mode === 'Extreme' ? 720 : 1080);
      assert.equal(streams.find((stream) => stream.codec_type === 'audio').codec_name, 'aac');
      assert.equal(job.manifest.compression.crf, { Balanced: 23, Crunch: 29, Extreme: 33 }[mode]);
      assert.equal(job.manifest.compressed.bytes, (await fsp.stat(compressed)).size);
      const range = await fetch(`${base}/api/jobs/${job.id}/files/compressed/video.mp4`, { headers: { Range: 'bytes=0-127' } });
      assert.equal(range.status, 206);
      assert.equal((await range.arrayBuffer()).byteLength, 128);
    });
  }
});
