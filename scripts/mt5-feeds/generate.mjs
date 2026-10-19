#!/usr/bin/env node
// Transport adapters only. Directions come from the existing, hash-pinned models.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PINS = JSON.parse(readFileSync(new URL('./source-pins.json', import.meta.url)));
const DAY = 86400000, WIB = 25200000;
export const FILENAMES = {news: 'news-astrology-mt5.json', moments: 'astro-4momen-mt5.json'};
const assert = (condition, message) => { if (!condition) throw Error(message); };
const sha = data => createHash('sha256').update(data).digest('hex');
export const wibDate = ms => new Date(ms + WIB).toISOString().slice(0, 10);
const midnight = ms => Date.parse(wibDate(ms) + 'T00:00:00Z') - WIB;

export function loadModels(root = ROOT) {
  for (const [path, hash] of Object.entries(PINS.files_sha256)) {
    assert(sha(readFileSync(resolve(root, path))) === hash, 'Unreviewed model change: ' + path);
  }
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const start = html.indexOf('/* CEBONK ASTROLOGY');
  const end = html.indexOf('</script>', start);
  assert(start >= 0 && end > start, 'Original Astrology core is missing');
  const source = html.slice(start, end);
  assert(sha(source) === PINS.embedded_core_sha256, 'Unreviewed Astrology core change');
  const module = {exports: {}};
  vm.runInNewContext(source, {module, Date, setTimeout, console}, {timeout: 15000});
  const core = module.exports;
  assert(['createEngine', 'analyse', 'classify'].every(k => typeof core[k] === 'function'), 'Core API mismatch');
  const news = require(resolve(root, 'assets/astro-news-v1.js'));
  const moments = require(resolve(root, 'assets/triple-cycle-core.js'));
  const bias = require(resolve(root, 'assets/astro-moment-bias.js'));
  assert(news.VERSION === '1.0.0' && moments.VERSION === '2.1.0' && bias.VERSION === '1.0.0', 'Model version mismatch');
  const astronomy = require('astronomy-engine');
  const dependency = JSON.parse(readFileSync(new URL('./node_modules/astronomy-engine/package.json', import.meta.url)));
  assert(dependency.version === '2.1.19', 'Ephemeris version mismatch');
  return {core, news, moments, bias, astronomy};
}

function header(kind, now, from, to, sourceCommit) {
  assert(Number.isSafeInteger(now) && now * 1000 >= Date.parse('2020-01-01T00:00:00Z') &&
    now * 1000 < Date.parse('2041-01-01T00:00:00Z'), 'Invalid UTC clock');
  return {
    schema_version: kind === 'news' ? 1 : 2,
    model: kind === 'news' ? 'CEBONK_NEWS_ASTROLOGY_V1' : 'CEBONK_FOUR_MOMENTS_ASTROLOGY_V1',
    engine_version: kind === 'news' ? '1.0.0' : '2.1.0',
    ...(kind === 'moments' ? {bias_engine_version: '1.0.0', window_policy: 'WIB_CONTEXT_DAY_FRI_CLOSE_0400_V1'} : {}),
    strategy_mode: kind === 'news' ? 'BBMA_3TF_NEWS' : 'BBMA_3TF_FOUR_MOMENTS',
    source_timezone: 'Asia/Jakarta', instrument: 'XAUUSD',
    generated_at_utc: now, expires_at_utc: Math.min(now + 36 * 3600, to),
    schedule_from_utc: from, schedule_to_utc: to,
    provenance: {
      source_commit: sourceCommit, source_base_commit: PINS.source_base_commit,
      model_hashes: PINS.files_sha256, embedded_core_sha256: PINS.embedded_core_sha256,
      ephemeris: 'astronomy-engine@2.1.19', experimental_model: true,
      validated_price_predictor: false, ea_source_published: false
    }
  };
}

function complete(feed, signals) {
  signals.sort((a, b) => a.start_utc - b.start_utc || a.signal_id.localeCompare(b.signal_id, 'en'));
  feed.signals = signals;
  // IDs exclude publication time. A refresh never creates another entry identity.
  feed.revision = sha(JSON.stringify(feed));
  return feed;
}

export async function generateNews(models, calendar, now, sourceCommit) {
  assert(calendar?.source === 'OFFICIAL_BLS_BEA_FED' && Array.isArray(calendar.events), 'Official calendar required');
  assert(Number.isSafeInteger(calendar.checked_at_utc) && calendar.checked_at_utc <= now &&
    now - calendar.checked_at_utc <= 3600, 'Calendar must be freshly verified; no stale fallback');
  const from = midnight(now * 1000) / 1000 - 86400;
  const to = Math.min(from + 30 * 86400, calendar.coverage_to_utc);
  assert(calendar.coverage_from_utc <= from && to > now, 'Official calendar coverage is insufficient');
  const feed = header('news', now, from, to, sourceCommit);
  feed.provenance.calendar_checked_at_utc = calendar.checked_at_utc;
  feed.provenance.calendar_sources = calendar.sources;
  feed.provenance.unconfirmed_releases = calendar.unconfirmed_releases || [];
  feed.provenance.entry_policy = {pre: 30, post: 120, blockBefore: 5, blockAfter: 5, entrySpan: 10, minWindow: 15, otherRisk: true};
  const events = calendar.events.map(event => {
    assert(typeof event.id === 'string' && /^[A-Za-z0-9_.:-]+$/.test(event.id) &&
      typeof event.name === 'string' && Number.isSafeInteger(event.release_utc) &&
      ['BLS', 'BEA', 'FED'].includes(event.agency), 'Malformed official event');
    return {...event, ms: event.release_utc * 1000};
  });
  assert(new Set(events.map(e => e.id)).size === events.length, 'Duplicate calendar event IDs');
  const groups = new Map();
  for (const event of events) {
    if (!groups.has(event.ms)) groups.set(event.ms, []);
    groups.get(event.ms).push(event);
  }
  const signals = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const event = group[0];
    if (event.ms + 125 * 60000 <= from * 1000 || event.ms >= to * 1000) continue;
    const plan = await models.news.calculate(models.core, models.astronomy, {
      ...feed.provenance.entry_policy, id: event.id, name: event.name,
      releaseMs: event.ms, confirmed: true
    }, events);
    assert(plan.version === '1.0.0' && plan.experimental && plan.executionEnabled === false, 'Unexpected news engine');
    for (const window of plan.windows) {
      assert(window.dir === plan.focus && ['BUY', 'SELL'].includes(window.dir), 'Direction must come from original model');
      // The EA's end is its last new-entry boundary, not the continuation end.
      const start = window.start / 1000, core = window.peak / 1000, end = window.entryEnd / 1000;
      assert([start, core, end].every(Number.isSafeInteger) && start <= core && core < end, 'Invalid model window');
      if (start < from || end > to) continue;
      const date = wibDate(window.start);
      const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      if (weekday === 0 || weekday === 6) continue; // Exact EA weekend policy.
      const identity = JSON.stringify([group.map(e => e.id), window.dir, start, core, end]);
      signals.push({
        signal_id: 'news:' + sha(identity).slice(0, 40), date_wib: date, session_id: 'news',
        direction: window.dir, start_utc: start, core_utc: core, end_utc: end,
        source_event_ids: group.map(e => e.id), release_utc: event.release_utc
      });
    }
  }
  return complete(feed, signals);
}

export function generateMoments(models, now, sourceCommit) {
  const fromMs = midnight(now * 1000) - 3 * DAY;
  const toMs = fromMs + 60 * DAY;
  const feed = header('moments', now, fromMs / 1000, toMs / 1000, sourceCommit);
  const month = ms => new Date(ms + WIB).toISOString().slice(0, 7);
  const first = month(fromMs - 3 * DAY), last = month(toMs + 3 * DAY);
  const phases = [];
  for (let current = first; current <= last;) {
    phases.push(...models.moments.calculate(models.astronomy, current).moments);
    const [year, number] = current.split('-').map(Number);
    current = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
  }
  const biases = models.bias.calculate(models.astronomy, phases, models.core);
  const signals = [];
  for (const phase of phases) {
    const contexts = [['event', phase.wib.date]];
    if (phase.bridge) contexts.push(['friday', phase.bridge.friday], ['monday', phase.bridge.monday]);
    for (const [context, date] of contexts) {
      const start = Date.parse(date + 'T00:00:00Z') - WIB;
      const friday = new Date(date + 'T00:00:00Z').getUTCDay() === 5;
      const end = start + DAY + (friday ? 4 * 3600000 : 0);
      if (start < fromMs || end > toMs) continue;
      const direction = biases[phase.ms]?.[context]?.state;
      assert(['BUY', 'SELL', 'NEUTRAL'].includes(direction), 'Original bias missing; do not invent a fallback');
      signals.push({
        signal_id: `moon:${phase.id}:${phase.ms}:${context}`, date_wib: date,
        moment_id: phase.id, context, direction,
        start_utc: start / 1000, core_utc: Math.floor(phase.ms / 1000), end_utc: end / 1000,
        event_time_utc_ms: phase.ms
      });
    }
  }
  return complete(feed, signals);
}

async function main() {
  const args = process.argv.slice(2), value = name => args[args.indexOf(name) + 1];
  const kind = value('--kind'), out = value('--out');
  assert(['news', 'moments'].includes(kind) && args.includes('--out'), 'Use --kind news|moments --out path [--calendar path]');
  const now = args.includes('--now') ? Number(value('--now')) : Math.floor(Date.now() / 1000);
  const commit = args.includes('--source-commit') ? value('--source-commit') : process.env.GITHUB_SHA;
  assert(typeof commit === 'string' && /^[0-9a-f]{40}$/.test(commit), 'Pass the checked-out --source-commit (or GITHUB_SHA in Actions)');
  const models = loadModels();
  const feed = kind === 'news'
    ? await generateNews(models, JSON.parse(readFileSync(value('--calendar'), 'utf8')), now, commit)
    : generateMoments(models, now, commit);
  mkdirSync(dirname(resolve(out)), {recursive: true});
  writeFileSync(out + '.tmp', JSON.stringify(feed, null, 2) + '\n', {mode: 0o600});
  renameSync(out + '.tmp', out);
  console.log(JSON.stringify({kind, signals: feed.signals.length, generated_at_utc: now,
    expires_at_utc: feed.expires_at_utc, directions_from: 'hash-pinned original website models'}));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
