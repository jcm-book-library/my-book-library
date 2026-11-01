// Shared test harness: headless browser, frozen clock, seeded Math.random, and a stateful stub of
// window.claude that behaves like a small Google Sheet (reads, writes and appends with updatedRange).
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { makeSheets } = require('./data.js');

const colN = s => { let n = 0; for (const c of s) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
const colL = i => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
function parseRange(range) {
  const m = String(range).match(/^(?:'([^']+)'|([^!']+))!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (!m) return null;
  const c0 = colN(m[3]), r0 = +m[4] - 1;
  return { tab: m[1] || m[2], c0, r0, c1: m[5] ? colN(m[5]) : c0, r1: m[6] ? +m[6] - 1 : r0 };
}
const cellText = v => { if (typeof v === 'string' && v[0] === "'") return v.slice(1); return v == null ? '' : String(v); };

// A fake sheet store. Returns the payload for each tool and records non-read calls.
function makeStore(sheets, writes) {
  return function call(tool, input) {
    if (tool === 'get_values') {
      const p = parseRange(input.range); if (!p) return { values: [] };
      const rows = sheets[p.tab] || [];
      const out = rows.slice(p.r0, p.r1 + 1).map(r => { const x = r.slice(p.c0, p.c1 + 1); while (x.length && x[x.length - 1] === '') x.pop(); return x; });
      while (out.length && !out[out.length - 1].length) out.pop();
      return { values: out };
    }
    writes.push({ tool, input });
    if (tool === 'update_values') {
      const p = parseRange(input.range); const rows = sheets[p.tab] || (sheets[p.tab] = []);
      input.values.forEach((vr, i) => {
        while (rows.length <= p.r0 + i) rows.push([]);
        vr.forEach((v, j) => { const r = rows[p.r0 + i]; while (r.length <= p.c0 + j) r.push(''); r[p.c0 + j] = cellText(v); });
      });
      return { updatedRange: input.range, updatedCells: input.values.reduce((a, r) => a + r.length, 0) };
    }
    if (tool === 'append_values') {
      const p = parseRange(input.range); const tab = p.tab; const rows = sheets[tab] || (sheets[tab] = []);
      const first = rows.length + 1, w = Math.max(...input.values.map(r => r.length));
      for (const vr of input.values) rows.push(vr.map(cellText));
      const last = rows.length;
      const q = /\s/.test(tab) ? `'${tab}'` : tab;
      return { updates: { updatedRange: `${q}!A${first}:${colL(w - 1)}${last}`, updatedRows: input.values.length } };
    }
    return {};
  };
}

const FIXED = '2026-10-31T10:00:00';
async function launch() { return pw.chromium.launch(); }

// opts: { width, height, mutate(sheets), keepLoadWrites }
// Returns { page, sheets, writes, errors, close }.
async function openApp(browser, appFile, opts = {}) {
  const width = opts.width || 1280;
  const sheets = makeSheets();
  if (opts.mutate) opts.mutate(sheets);
  const writes = [], errors = [];
  const call = makeStore(sheets, writes);
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(FIXED) });
  await page.clock.setFixedTime(new Date(FIXED));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('chart.umd.js')) return r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(c,cfg){this.cfg=cfg;this.data=cfg&&cfg.data;};Chart.prototype.destroy=function(){};Chart.prototype.update=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}},tooltip:{}}};' });
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('about:')) return r.continue();
    return r.abort();
  });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(width + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(width + ': PAGEERR ' + e.message));
  await page.exposeFunction('__call', (tool, input) => call(tool, input));
  await page.addInitScript(() => {
    window.claude = { use: async () => ({ callTool: async (server, tool, input) => ({ payload: await window.__call(tool, input) }) }) };
    try { localStorage.clear(); } catch (e) {}
    { let x = 12345; Math.random = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
    const st = document.createElement('style');
    document.addEventListener('DOMContentLoaded', () => { st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'; document.head.appendChild(st); });
  });
  await page.goto('file://' + path.resolve(appFile));
  await page.waitForFunction(() => typeof state !== 'undefined' && state.live && state.libLoaded && typeof disc !== 'undefined' && disc.loaded, null, { timeout: 15000 }).catch(() => errors.push('not live'));
  await page.waitForTimeout(700);
  if (!opts.keepLoadWrites) writes.length = 0;
  return { page, sheets, writes, errors, close: () => ctx.close() };
}

// Wait until queued background writes have finished.
async function settle(page, ms = 500) {
  await page.waitForFunction(() => !state.busy && !planQ.pending && !wishQ.pending && !wl.moving && !pruning, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

module.exports = { launch, openApp, settle, FIXED };
