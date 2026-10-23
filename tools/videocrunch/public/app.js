'use strict';

const $ = (selector) => document.querySelector(selector);
let config;
let jobs = [];
let selectedJobId = null;
let selectedJob = null;
let pending = false;
let pollTimer;
let failureCount = 0;

function showError(selector, message) {
  const element = $(selector);
  element.textContent = message || '';
  element.hidden = !message;
}

async function api(url, options = {}) {
  let response;
  try { response = await fetch(url, { cache: 'no-store', ...options }); } catch {
    throw new Error('Cannot reach the local app. Make sure its terminal is still open, then refresh this page.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The app returned an unexpected response. Refresh the page or check its terminal.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function bytes(value) {
  if (!Number.isFinite(value)) return '--';
  if (value < 1024) return `${value} B`;
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return `${(value / 1024 ** unit).toFixed(1)} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fileUrl(job, relativePath, download = false) {
  return `./api/jobs/${job.id}/files/${relativePath.split('/').map(encodeURIComponent).join('/')}${download ? '?download=1' : ''}`;
}

function fileLink(job, label, relativePath, primary = false, download = false) {
  const link = element('a', `button ${primary ? 'primary' : 'secondary'}`, label);
  link.href = fileUrl(job, relativePath, download);
  if (download) link.download = '';
  else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  return link;
}

function sourceTitle(job) {
  try { return new URL(job.url).hostname.replace(/^www\./, ''); } catch { return 'Video export'; }
}

function createJobCard(job, expanded = false) {
  const card = element('article', 'card job-card');
  card.dataset.jobId = job.id;
  const top = element('div', 'job-top');
  top.append(element('span', 'job-icon', job.status === 'completed' ? '\u25b6' : job.status === 'failed' ? '!' : '\u21bb'));
  const title = element('div', 'job-title');
  title.append(element('h3', '', sourceTitle(job)));
  const date = new Date(job.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  title.append(element('p', '', `${date} \u00b7 ${job.skipCompression ? 'Original only' : `${job.compression} compression`}`));
  top.append(title, element('span', `job-status ${job.status}`, job.stage || job.status));
  card.append(top);
  if (job.status === 'running') {
    const track = element('div', 'activity-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Export in progress');
    card.append(track);
  }
  card.append(element('p', 'job-url', job.url));
  if (job.exportDir) card.append(element('p', 'job-directory', `Saved to ${job.exportDir}`));
  if (job.manifest?.original) {
    const stats = element('div', 'job-stats');
    const original = job.manifest.original.bytes;
    const compressed = job.manifest.compressed?.bytes;
    const addStat = (label, value) => {
      const stat = element('div', 'job-stat', label);
      stat.append(element('strong', '', value));
      stats.append(stat);
    };
    addStat('Original file', bytes(original));
    if (compressed !== undefined) {
      addStat('Playback file', bytes(compressed));
      const reduction = (1 - compressed / original) * 100;
      addStat(reduction >= 0 ? 'Space saved' : 'Size change',
        reduction >= 0 ? `${reduction.toFixed(1)}% smaller` : `${Math.abs(reduction).toFixed(1)}% larger`);
    } else addStat('Original preserved', 'SHA-256 verified');
    card.append(stats);
  }
  if (job.error) card.append(element('p', 'job-error', job.error));
  if (job.manifest) {
    const actions = element('div', 'job-actions');
    if (job.status === 'completed') actions.append(fileLink(job, 'Watch offline \u2197', 'index.html', true));
    if (job.manifest.compressed) actions.append(fileLink(job, 'Download MP4', job.manifest.compressed.path, false, true));
    if (job.manifest.original) actions.append(fileLink(job, 'Original', job.manifest.original.path, false, true));
    actions.append(fileLink(job, 'Manifest', 'manifest.json'));
    if (job.status !== 'running') {
      const retry = element('button', 'button secondary', 'Use this link again');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        $('#video-url').value = job.url;
        location.hash = 'workspace';
        $('#video-url').focus();
        $('#video-url').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      actions.append(retry);
    }
    card.append(actions);
  }
  if (expanded) {
    const details = element('details', 'job-log');
    details.open = job.status === 'running' || job.status === 'failed';
    details.append(element('summary', '', 'PS > Technical details & live log'));
    const log = element('pre', 'log-content', job.logs || 'Waiting for the video tool...');
    log.setAttribute('aria-label', 'Export log');
    details.append(log);
    card.append(details);
  } else {
    const details = element('button', 'button secondary', 'View details');
    details.type = 'button';
    details.addEventListener('click', () => {
      selectedJobId = job.id;
      location.hash = 'workspace';
      refresh().then(() => $('#active-section').scrollIntoView({ behavior: 'smooth', block: 'start' }))
        .catch((error) => showError('#global-error', error.message));
    });
    const actions = card.querySelector('.job-actions') || element('div', 'job-actions');
    actions.append(details);
    if (!actions.parentElement) card.append(actions);
  }
  return card;
}

function renderList(selector, list) {
  const container = $(selector);
  container.replaceChildren();
  if (!list.length) container.append($('#empty-template').content.cloneNode(true));
  else list.forEach((job) => container.append(createJobCard(job)));
}

function updateFormState() {
  const running = jobs.some((job) => job.status === 'running');
  const missing = !config || config.tools.some((tool) => !tool.available);
  $('#submit-button').disabled = pending || running || missing || Boolean(config?.storageError);
  $('#submit-label').textContent = pending ? 'Starting export...' : running ? 'Export in progress...' :
    $('#skip-compression').checked ? 'Download original' : 'Download & compress';
  $('#compression-options').disabled = $('#skip-compression').checked;
}

function renderJobs() {
  $('#history-count').textContent = jobs.length;
  $('#recent-count').textContent = jobs.length;
  renderList('#recent-jobs', jobs.slice(0, 3));
  renderList('#history-jobs', jobs);
  $('#active-section').hidden = !selectedJob;
  if (selectedJob) {
    const oldDetails = $('#active-job details');
    const oldLog = $('#active-job pre');
    const wasOpen = oldDetails?.open;
    const wasAtBottom = !oldLog || oldLog.scrollTop + oldLog.clientHeight >= oldLog.scrollHeight - 30;
    const oldPosition = oldLog?.scrollTop || 0;
    const card = createJobCard(selectedJob, true);
    if (oldDetails && card.querySelector('details')) card.querySelector('details').open = wasOpen;
    $('#active-job').replaceChildren(card);
    const log = card.querySelector('pre');
    if (log) log.scrollTop = wasAtBottom ? log.scrollHeight : oldPosition;
  }
  updateFormState();
}

async function refresh() {
  const data = await api('./api/jobs');
  jobs = data.jobs;
  if (data.storageError) showError('#global-error', data.storageError);
  const running = jobs.find((job) => job.status === 'running');
  if (!selectedJobId) selectedJobId = running?.id || jobs[0]?.id || null;
  if (selectedJobId) selectedJob = await api(`./api/jobs/${selectedJobId}`);
  renderJobs();
}

async function poll() {
  try {
    await refresh();
    if (failureCount) showError('#global-error', config?.storageError);
    failureCount = 0;
  } catch (error) {
    failureCount++;
    showError('#global-error', error.message);
  } finally {
    pollTimer = setTimeout(poll, Math.min(1500 * 2 ** failureCount, 15000));
  }
}

function setView() {
  const name = location.hash.slice(1);
  const view = ['history', 'guide'].includes(name) ? name : 'workspace';
  for (const node of document.querySelectorAll('.view')) node.hidden = node.id !== `${view}-view`;
  for (const link of document.querySelectorAll('[data-view]')) {
    link.classList.toggle('active', link.dataset.view === view);
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  $('#page-label').textContent = { workspace: 'Overview', history: 'Export history', guide: 'How it works' }[view];
}

$('#skip-compression').addEventListener('change', updateFormState);
$('#output-dir').addEventListener('input', () => { $('#output-summary').textContent = $('#output-dir').value || 'Choose a folder'; });
window.addEventListener('hashchange', setView);
window.addEventListener('pagehide', () => clearTimeout(pollTimer));
window.addEventListener('pageshow', (event) => {
  if (event.persisted && config) {
    clearTimeout(pollTimer);
    poll();
  }
});

$('#export-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('#form-error', '');
  if (!config || pending) return;
  let url;
  try {
    url = new URL($('#video-url').value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL');
  } catch {
    showError('#form-error', 'Enter a public HTTP or HTTPS video link without embedded credentials.');
    return;
  }
  pending = true;
  updateFormState();
  try {
    selectedJob = await api('./api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WebVideoCrunch-Token': config.token },
      body: JSON.stringify({ url: url.href, outputDir: $('#output-dir').value.trim(),
        compression: $('input[name="compression"]:checked').value, skipCompression: $('#skip-compression').checked }),
    });
    selectedJobId = selectedJob.id;
    jobs.unshift(selectedJob);
    renderJobs();
    $('#active-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { showError('#form-error', error.message); } finally {
    pending = false;
    updateFormState();
  }
});

async function initialize() {
  setView();
  try {
    config = await api('./api/config');
    $('#output-dir').value = config.defaultOutputDir;
    $('#output-summary').textContent = config.defaultOutputDir;
    const list = $('#tool-list');
    list.replaceChildren();
    for (const tool of config.tools) {
      const chip = element('span', `tool-chip${tool.available ? '' : ' missing'}`);
      chip.title = tool.version || tool.error;
      chip.append(element('span', 'status-dot'), document.createTextNode(tool.name));
      list.append(chip);
    }
    const missing = config.tools.filter((tool) => !tool.available);
    $('#engine-status').textContent = missing.length ? 'SETUP NEEDED' : 'ALL SYSTEMS READY';
    if (missing.length) {
      showError('#global-error', `Missing tools: ${missing.map((tool) => tool.name).join(', ')}. See "How it works" for installation commands, then restart the app.`);
    } else if (config.storageError) showError('#global-error', config.storageError);
    await poll();
  } catch (error) {
    showError('#global-error', error.message);
    $('#engine-status').textContent = 'UNAVAILABLE';
  }
}

initialize();
