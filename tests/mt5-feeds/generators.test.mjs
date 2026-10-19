import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {loadModels, generateMoments, generateNews, wibDate} from '../../scripts/mt5-feeds/generate.mjs';

const models = loadModels(), now = Date.parse('2026-10-19T17:00:00Z') / 1000;
const commit = 'f5daccf2ae805146ca3352de7efe6e6a9189a69b';
const calendar = {
  source: 'OFFICIAL_BLS_BEA_FED', checked_at_utc: now,
  coverage_from_utc: now - 3 * 86400, coverage_to_utc: now + 25 * 86400,
  sources: [{agency: 'FED', url: 'https://www.federalreserve.gov/newsevents/2026-october.htm'}],
  // Historical primary-calendar times are fixtures; no fixture is a publication input.
  events: [
    {id: 'fomc-20261028', name: 'FOMC Statement', agency: 'FED', release_utc: Date.parse('2026-10-28T18:00:00Z') / 1000},
    {id: 'fed-pc-20261028', name: 'FOMC Press Conference', agency: 'FED', release_utc: Date.parse('2026-10-28T18:30:00Z') / 1000}
  ]
};

test('lunar phase timestamps, directional bias and Friday windows match the original engines', () => {
  const feed = generateMoments(models, now, commit);
  assert.ok(feed.signals.length > 0);
  for (const signal of feed.signals) {
    const month = wibDate(signal.event_time_utc_ms).slice(0, 7);
    const actual = models.moments.calculate(models.astronomy, month).moments.find(m => m.ms === signal.event_time_utc_ms);
    assert.ok(actual);
    const bias = models.bias.calculate(models.astronomy, [actual], models.core)[actual.ms][signal.context];
    assert.equal(signal.direction, bias.state);
    assert.equal(signal.core_utc, Math.floor(actual.ms / 1000));
    const local = new Date(signal.start_utc * 1000 + 25200000);
    assert.equal(local.getUTCHours(), 0);
    assert.equal(signal.end_utc - signal.start_utc, local.getUTCDay() === 5 ? 100800 : 86400);
    if (signal.context === 'friday') assert.equal(signal.date_wib, actual.bridge.friday);
    if (signal.context === 'monday') assert.equal(signal.date_wib, actual.bridge.monday);
  }
});

test('refresh changes publication headers without changing signal IDs or contents', () => {
  const first = generateMoments(models, now, commit), next = generateMoments(models, now + 300, commit);
  assert.deepEqual(first.signals, next.signals);
  assert.notEqual(first.revision, next.revision);
});

test('news windows preserve original direction, model peak and initial-entry end', async () => {
  const feed = await generateNews(models, calendar, now, commit);
  const events = calendar.events.map(e => ({...e, ms: e.release_utc * 1000}));
  const original = [];
  for (const e of events) {
    const plan = await models.news.calculate(models.core, models.astronomy, {
      ...feed.provenance.entry_policy, id: e.id, name: e.name, releaseMs: e.ms, confirmed: true
    }, events);
    original.push(...plan.windows.map(w => [w.dir, w.start / 1000, w.peak / 1000, w.entryEnd / 1000]));
  }
  assert.deepEqual(feed.signals.map(s => [s.direction, s.start_utc, s.core_utc, s.end_utc]), original);
  const refreshed = await generateNews(models, {...calendar, checked_at_utc: now + 60}, now + 60, commit);
  assert.deepEqual(feed.signals, refreshed.signals);
});

test('official calendar transport does not change strategy, windows or signal identities', async () => {
  const direct = await generateNews(models, calendar, now, commit);
  const nyfed = await generateNews(models, {...calendar, source: 'OFFICIAL_NYFED_BEA_FED'}, now, commit);
  assert.deepEqual(nyfed.signals, direct.signals);
});

test('missing/stale calendars fail; no BUY or SELL fallback is fabricated', async () => {
  await assert.rejects(generateNews(models, null, now, commit), /Official calendar/);
  await assert.rejects(generateNews(models, {...calendar, checked_at_utc: now - 3601}, now, commit), /freshly/);
  const empty = await generateNews(models, {...calendar, events: []}, now, commit);
  assert.deepEqual(empty.signals, []);
});

test('model drift is rejected even if the module version string has not changed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mt5-model-pin-test-'));
  try {
    mkdirSync(join(directory, 'assets'));
    for (const path of ['index.html', 'assets/astro-news-v1.js', 'assets/triple-cycle-core.js', 'assets/astro-moment-bias.js']) {
      copyFileSync(resolve(path), join(directory, path));
    }
    const path = join(directory, 'assets/astro-moment-bias.js');
    writeFileSync(path, readFileSync(path, 'utf8') + '\n// unreviewed edit\n');
    assert.throws(() => loadModels(directory), /Unreviewed model change/);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
