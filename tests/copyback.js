// Data tools in "Data & sign-in", headless: Copy Sheet -> Supabase, Check, and Copy Supabase -> Sheet (the weekly backup).
// A fake Google Sheets API (two spreadsheets, every write recorded) and a fake Supabase, both through page.route. Nothing here
// touches a real Google or Supabase server; the data is synthetic.
// Usage: node tests/copyback.js <outDir>      (prints PASS/FAIL lines; exits 1 on any FAIL)
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const F = require('./fakes.js');
const { FIXED } = require('./lib.js');
const OUT = process.argv[2] || path.join(__dirname, 'out', 'cb');
fs.mkdirSync(OUT, { recursive: true });
const APP = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const HTML = '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n' + APP;
const ORIGIN = 'https://library.test', TODAY = FIXED.slice(0, 10);
const SHEET_ID = APP.match(/const SHEET_ID = '([^']+)'/)[1], QUOTES_ID = APP.match(/const QUOTES_ID = '([^']+)'/)[1];
const { SBT, sbToCell, cellToSb } = F.appFns(APP);
const TABS = Object.keys(SBT);
const log = [], errors = [];
const check = (name, ok, extra) => log.push((ok ? 'PASS ' : 'FAIL ') + name + (!ok && extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 500) : ''));

// ---------- the synthetic Sheet ----------
// Fixture rows are objects keyed by the Supabase-side header names, holding what the Sheet shows (strings); null is a cleared (blank) row.
const SHEET_HDR = {   // header spellings that differ from SBT, or a different column order
  'Reading Lists': ['id', 'list', 'order', 'title', 'author', 'notes', 'bookId'],
  'App Settings': ['key', 'value', 'note'],
  'Contents': ['bookId', 'stamp', 'story', 'start'],
  'Ratings': ['date', 'bookId', 'title', 'category', 'gut', 'criteria', 'standout', 'flaw', 'suggested', 'final']
};
const ALIAS = { key: 'setting', stamp: 'savedAt', start: 'startPage', flaw: 'fatalFlaw' };
const hdrOf = tab => SHEET_HDR[tab] || SBT[tab][1].map(c => c[0]);
const rowOf = (tab, o) => hdrOf(tab).map(h => o[ALIAS[h] || h] ?? '');
function fixture() {
  const book = o => ({ type: 'Novel', format: 'Book', copies: 'Kobo', ...o });
  return {
    'Books': [
      book({ id: '1', title: 'The Long Tide', author: 'Ada Marlowe', status: 'Reading', favourite: 'Yes', currentPage: '120', pages: '1,116', remain: '996', '%': '11', startDate: '2026-10-20', year: '2021', copies: 'Kobo | Physical' }),
      book({ id: '5', title: 'Dust of Stars', author: 'Ben Okafor', status: 'Reading', currentPage: '60', pages: '500', remain: '440', '%': '12', startDate: '2026-10-25', series: 'Stardust', seriesNum: '1' }),
      null,
      book({ id: '9', title: 'Harbour Lights', author: 'Ivy Chen', status: 'Finished', rating: '4.5', favourite: 'Yes', currentPage: '320', pages: '320', remain: '0', '%': '100', startDate: '2026-10-01', finishDate: '2026-10-12', loaned: '2026-10-05', loanee: 'Sam' }),
      book({ id: '13', title: '1984', author: 'George Orwell', status: 'TBR', pages: '328', tier: 'Up next', upNextOrder: '1', added: '2026-08-10', notes: 'Line one' }),
      book({ id: '17', title: 'Quiet Engines', author: 'Eli Ramos', status: 'TBR', pages: '300', tier: 'Soon', why: "Friend's pick" })
    ],
    'Reading Log': [
      { date: '2026-10-27', pages: '25', bookId: '1', title: 'The Long Tide', pageReached: '100', loggedAt: '2026-10-27 20:00', source: 'app', minutes: '30' },
      { date: '2026-10-28', pages: '30', bookId: '1', title: 'The Long Tide', pageReached: '130', loggedAt: '2026-10-28 20:10', source: 'app', minutes: '35' },
      { date: '2026-10-29', pages: '0', bookId: '5', title: 'Dust of Stars', pageReached: '60', loggedAt: '2026-10-29 21:00', source: 'deleted' },
      null,
      { date: '2026-10-30', pages: '40', bookId: '5', title: 'Dust of Stars', pageReached: '60', loggedAt: '2026-10-30 19:30', source: 'app', minutes: '45' },
      { date: '2026-10-30', pages: '12', bookId: '1', title: 'The Long Tide', pageReached: '120', loggedAt: '2026-10-30 22:05', source: 'app' },
      { date: '2026-10-31', pages: '8', bookId: '5', title: 'Dust of Stars', pageReached: '68', loggedAt: '2026-10-31 07:45', source: 'app', minutes: '10' }
    ],
    'App Settings': [
      { setting: 'streakStartDate', value: '2026-09-01', note: 'when the streak starts' }, { setting: 'streakMinPages', value: '10' },
      { setting: 'dailyGoalPages', value: '60', note: 'pages a day' }, { setting: 'yearBookGoal', value: '40' }
    ],
    'Ratings': [
      { date: '2026-10-12', bookId: '9', title: 'Harbour Lights', category: 'Novel', gut: '4', criteria: 'Prose 4 | Plot 4', standout: 'The ending', fatalFlaw: 'Slow middle', suggested: '4.2', final: '4.5' },
      { date: '2026-09-20', bookId: '13', title: '1984', category: 'Novel', gut: '5', criteria: 'Prose 5', standout: '', fatalFlaw: '', suggested: '4.8', final: '5' }
    ],
    'Contents': [
      { bookId: '5', savedAt: '2026-10-20 10:00:00', story: 'First story', startPage: '1' }, { bookId: '5', savedAt: '2026-10-20 10:00:00', story: 'Second story', startPage: '40' },
      { bookId: '5', savedAt: '2026-10-20 10:00:00', story: 'Third story', startPage: '1,010' }
    ],
    'Wishlist': [
      { id: 'WL0001', added: '2026-10-20', title: 'Inbox Book One', author: 'Zed Author', type: 'Novel', format: 'Book', stage: 'Inbox', gift: 'FALSE' },
      { id: 'WL0002', added: '2026-10-21', title: 'Buy Me Deluxe', author: 'Uma Pen', type: 'Comic', format: 'Deluxe', stage: 'To buy', price: '45', release: '2026-12-01', gift: 'TRUE', number: '2' },
      null,
      { id: 'WL0003', added: '2026-10-01', title: 'Kobo Find', author: 'Xan Writer', type: 'Novel', format: 'Book', stage: 'To download', wantAs: 'Kobo', checked: 'Available', checkedOn: '2026-10-25', gift: 'FALSE' },
      { id: 'WL0004', added: '2026-10-02', title: 'PDF Issue Run', author: 'Will Scribe', series: 'Spawn', number: '12', type: 'Comic', format: 'Issues', stage: 'To download', wantAs: 'PDF', gift: 'false' }
    ],
    'Series Tracker': [
      { series: 'Spawn', author: 'Todd McFarlane', publisher: 'Image', kind: 'Comic', status: 'Following', soldAs: 'Issues', notes: 'note a' }, null,
      { series: 'Moon Knight', author: 'Marv Writer', publisher: 'Marvel', kind: 'Comic', status: 'Ongoing', released: '12', soldAs: 'Box Set' }
    ],
    'Reading Lists': [
      { list: 'Summer Sci-Fi', order: '1', title: 'Dust of Stars', author: 'Ben Okafor', id: 'RL0001', bookId: '5' }, { list: 'Summer Sci-Fi', order: '2', title: 'Quiet Engines', author: 'Eli Ramos', id: 'RL0002' },
      { list: 'Classics', order: '1', title: 'Moby Unlisted', author: 'Herman M', notes: 'someday', id: 'RL0003' }
    ],
    'Wishlist archive': [
      { Title: 'Saga Vol 3', Author: 'Brian Vaughan', Status: 'Bought', Type: 'Comic', Format: 'Graphic novel', ETA: '2026-09-01', Cost: '30', id: 'WL0090', Series: 'Saga', bookId: '57' },
      { Title: 'Old Find', Author: 'Q Writer', Status: 'Downloaded', Type: 'Novel', Format: 'Book', id: 'WL0091', Notes: 'Moved 2026-08-01', Pages: '300' }
    ],
    'Quotes': [
      { quote: 'A line to remember.', from: 'The Long Tide', character: 'Ada', by: 'Ada Marlowe', bookId: '1', page: '33', added: '2026-10-10' },
      { quote: 'Another quote.', from: 'Saga', character: 'Alana', by: 'BKV', bookId: '57', page: '5' }
    ]
  };
}
// fixture objects use SBT header names ('Reading_List' is 'Reading List' there)
const fixKey = (tab, o) => o;
function sheetTabs(fx, spreadsheet) {
  const names = spreadsheet === 'quotes' ? ['Quotes'] : TABS.filter(t => t !== 'Quotes'), out = []; let sid = 1;
  for (const tab of names) {
    const data = [hdrOf(tab), ...fx[tab].map(o => o ? rowOf(tab, fixKey(tab, o)) : [])];
    out.push({ sheetId: sid++, title: tab === 'Quotes' ? 'QUOTES' : tab, hidden: false, rowCount: tab === 'Reading Log' ? data.length + 1 : data.length + 40, data });
  }
  if (spreadsheet !== 'quotes') {   // tabs that belong to other things: never to be read or touched
    out.push({ sheetId: 500, title: 'Brain tester', hidden: false, rowCount: 50, data: [['Date', 'Pages', 'Mood', 'Meds'], ['2026-10-30', '12', 'sensitive', 'sensitive']] });
    out.push({ sheetId: 501, title: 'Wishlist backup 2026-01-01', hidden: true, rowCount: 50, data: [['id', 'old'], ['WL0000', 'kept']] });
  }
  return out;
}
function seedDb(w, fx) {
  for (const tab of TABS) { const [table, cols] = SBT[tab];
    for (const o of fx[tab].filter(Boolean)) { const row = {}; cols.forEach(([h, c, t]) => { if (t !== 'calc') row[c] = cellToSb(t, o[h] ?? ''); }); w.insert(table, row); } }
}
function makeWorld({ edit, sbEdit, empty } = {}) {
  const fx = fixture(); if (edit) edit(fx);
  const w = F.sbWorld(); w.fx = fx;
  w.sheetsApi = F.makeSheetsApi({ [SHEET_ID]: sheetTabs(fx, 'main'), [QUOTES_ID]: sheetTabs(fx, 'quotes') });
  if (!empty) seedDb(w, fixture());
  if (sbEdit) sbEdit(w);
  return w;
}
const tabOf = (w, tab) => w.sheetsApi.sheets[tab === 'Quotes' ? QUOTES_ID : SHEET_ID].find(x => x.title === (tab === 'Quotes' ? 'QUOTES' : tab));
const sbWrites = w => w.calls.filter(c => c.method !== 'GET');
const dbSet = (w, table, pred, patch) => w.db[table].filter(pred).forEach(r => Object.assign(r, patch));
const dbDel = (w, table, pred) => { w.db[table] = w.db[table].filter(r => !pred(r)); };

// ---------- an independent comparison of the Sheet and the fake Supabase, done here in node ----------
function nodeCompare(w) {
  const bad = [];
  for (const tab of TABS) {
    const [table, cols] = SBT[tab], t = tabOf(w, tab), hdr = t.data[0].map(h => ALIAS[String(h).trim()] || String(h).trim());
    const rows = t.data.slice(1).filter(r => r.some(v => String(v ?? '').trim()));
    let s = rows.map(r => cols.map(([h, , ty]) => ty === 'calc' ? null : cellToSb(ty, r[hdr.indexOf(h)] ?? ''))).map(x => JSON.stringify(x));
    let d = w.db[table].map(r => cols.map(([h, c, ty]) => ty === 'calc' ? null : cellToSb(ty, sbToCell(ty, r[c])))).map(x => JSON.stringify(x));
    if (['Books', 'Wishlist', 'Reading Lists', 'Wishlist archive', 'Series Tracker', 'App Settings'].includes(tab)) { s = s.sort(); d = d.sort(); }
    if (s.length !== d.length) bad.push(`${tab}: Sheet ${s.length}, Supabase ${d.length}`);
    else { const i = s.findIndex((x, k) => x !== d[k]); if (i >= 0) bad.push(`${tab}: ${s[i]} vs ${d[i]}`); }
  }
  return bad;
}

// ---------- the browser ----------
const GIS = 'window.google={accounts:{oauth2:{initTokenClient:function(cfg){return {requestAccessToken:function(){window.__gisAsked=(window.__gisAsked||0)+1;}};}}}};';
async function install(page, w) {
  await page.route('**/*', async r => {
    const url = r.request().url(), u = new URL(url);
    if (url.includes('chart.umd.js')) return r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(c,cfg){this.cfg=cfg;this.data=cfg&&cfg.data;};Chart.prototype.destroy=function(){};Chart.prototype.update=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}},tooltip:{}}};' });
    if (u.origin === ORIGIN) return r.fulfill({ contentType: 'text/html', body: HTML });
    if (/accounts\.google\.com/.test(u.host)) return r.fulfill({ contentType: 'text/javascript', body: GIS });
    if (/sheets\.googleapis\.com/.test(u.host)) return w.sheetsApi.route(r);
    if (u.origin === F.SBU) return F.sbRoute(r, w);
    if (url.startsWith('data:') || url.startsWith('about:')) return r.continue();
    return r.abort();
  });
  await F.routeRealtime(page, w);
}
async function scenario(browser, name, { mode = 'sheet', vp = { width: 1280, height: 900 }, google = true, build = {}, sheetCopy = true, noBackend = false, run }) {
  const w = makeWorld(build);
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' }), page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(name + ': ' + m.text()); });
  await page.clock.install({ time: new Date(FIXED) });
  await install(page, w);
  await page.addInitScript(([mode, google, sheetCopy, noBackend]) => {
    if (sheetCopy) window.__TEST_SHEET_COPY__ = true;   // the hidden Sheet -> Supabase copy, still tested
    if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('mbl_config', JSON.stringify(noBackend ? { clientId: 'abc.apps.googleusercontent.com' } : { backend: mode === 'sb' ? 'supabase' : 'sheets', clientId: 'abc.apps.googleusercontent.com' }));
    localStorage.setItem('jcm-sb-session', JSON.stringify({ at: 'x.' + btoa(JSON.stringify({ email: 'me@example.com', sub: 'u1' })).replace(/=+$/, '') + '.y', rt: 'rt1', exp: Date.now() + 3600e3, email: 'me@example.com' }));
    if (google) localStorage.setItem('jm-google-token', JSON.stringify({ t: 'x', exp: Date.now() + 3600e3 }));
    { let x = 12345; Math.random = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
  }, [mode, google, sheetCopy, noBackend]);
  try {
    await page.goto(ORIGIN + '/');
    if (google || mode === 'sb') await page.waitForFunction(m => document.getElementById('status').dataset.state === 'live' && state.libLoaded && (m === 'sb' ? /^Supabase ·/ : /^Live from your sheet/).test(document.getElementById('statusText').textContent), mode, { timeout: 12000 });
    else await page.waitForTimeout(500);
    await page.evaluate(() => openDataDlg(''));
    await page.waitForSelector('#dataDlg[open]');
    await run(page, w);
  } catch (e) { check(name + ' ran without throwing', false, String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')); }
  await ctx.close();
}
const idle = page => page.waitForFunction(() => !tl.busy, null, { timeout: 30000 });
const press = async (page, sel) => { await page.click(sel); await idle(page); return page.locator('#toolMsg').innerText(); };
const btnText = (page, sel) => page.locator(sel).innerText();
const cfgOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('mbl_config') || '{}'));
const liveSb = page => page.waitForFunction(() => document.getElementById('status').dataset.state === 'live' && /^Supabase ·/.test(document.getElementById('statusText').textContent) && state.libLoaded, null, { timeout: 12000 });
const dataRanges = api => api.writes().filter(c => c.p === '/values:batchUpdate').flatMap(c => c.body.data.map(d => ({ id: c.id, ...d })));
const reqs = api => api.writes().filter(c => c.p === ':batchUpdate').flatMap(c => c.body.requests.map(q => ({ id: c.id, ...q })));
const get = (w, tab, row, col) => (tabOf(w, tab).data[row - 1] || [])[col];

(async () => {
  const browser = await pw.chromium.launch();

  // ===== (a)(b) Copy Sheet -> Supabase: all ten tabs =====
  await scenario(browser, 'to-supabase', { mode: 'sheet',
    build: { sbEdit: w => { Object.keys(w.db).forEach(t => { w.db[t].length = 0; }); w.insert('books', { id: 99, title: 'Stale book' }); w.insert('settings', { key: 'stale1', value: 'x' }); w.insert('settings', { key: 'stale2', value: 'y' }); } },
    run: async (page, w) => {
      const api = w.sheetsApi;
      check('Sheet mode shows the two Sheet buttons', (await btnText(page, '#sbCopy')) === 'Copy Sheet → Supabase' && (await btnText(page, '#sbCheck')) === 'Check Sheet and Supabase match');
      const m1 = await press(page, '#sbCopy');
      check('first press asks "Replace Supabase copy?" with the current row count', /^Replace Supabase copy\?/.test(m1) && /Supabase has 3 rows now/.test(m1) && (await btnText(page, '#sbCopy')) === 'Replace Supabase copy?', m1);
      check('first press changes nothing', sbWrites(w).length === 0 && w.db.books.length === 1 && api.writes().length === 0);
      const before = w.calls.length;
      const m2 = await press(page, '#sbCopy');
      check('(a) says what was copied and that it matches', /^Copied 33 rows and checked them: Supabase matches your Sheet\. This device now uses Supabase\./.test(m2), m2);
      const ids = t => w.db[t].map(r => r.id);
      check('(a) Books: 5 rows, blank row skipped, Sheet order kept', JSON.stringify(ids('books')) === '[1,5,9,13,17]' && !ids('books').includes(99), ids('books'));
      const b1 = w.db.books[0], b4 = w.db.books[2];
      check('(a) Books: 1,116 -> 1116, Yes -> true, dates, int year, text kept', b1.pages === 1116 && b1.favourite === true && b1.current_page === 120 && b1.start_date === '2026-10-20' && b1.year === 2021 && b1.copies === 'Kobo | Physical' && w.db.books[1].favourite === false && b4.rating === 4.5 && b4.loaned === '2026-10-05' && w.db.books[3].title === '1984', [b1, b4]);
      check('(a) Reading Log: 6 rows in Sheet order, loggedAt kept, ids as numbers', w.db.reading_log.length === 6 && w.db.reading_log.map(r => r.date).join() === '2026-10-27,2026-10-28,2026-10-29,2026-10-30,2026-10-30,2026-10-31' && w.db.reading_log[0].book_id === 1 && w.db.reading_log[0].logged_at === '2026-10-27 20:00' && w.db.reading_log[2].source === 'deleted' && w.db.reading_log[4].minutes === null, w.db.reading_log[4]);
      check('(a) Wishlist: TRUE/FALSE -> boolean, blank row skipped', w.db.wishlist.map(r => r.id + ':' + r.gift).join() === 'WL0001:false,WL0002:true,WL0003:false,WL0004:false' && w.db.wishlist[1].price === '45' && w.db.wishlist[1].release === '2026-12-01' && w.db.wishlist[1].number === '2', w.db.wishlist.map(r => [r.id, r.gift]));
      check('(a) App Settings: key header accepted, values as text, note kept', w.db.settings.length === 4 && w.db.settings[0].key === 'streakStartDate' && w.db.settings[0].note === 'when the streak starts' && w.db.settings[2].value === '60', w.db.settings);
      check('(a) Ratings and Contents: Sheet header spellings (flaw, stamp, start) mapped', w.db.ratings[0].fatal_flaw === 'Slow middle' && w.db.ratings[0].suggested === 4.2 && w.db.contents.length === 3 && w.db.contents[0].saved_at === '2026-10-20 10:00:00' && w.db.contents[2].start_page === 1010 && w.db.contents[0].book_id === 5, [w.db.ratings[0], w.db.contents[2]]);
      check('(a) Series Tracker, Reading Lists (id column first), archive, Quotes', w.db.series_tracker.map(r => r.series).join() === 'Spawn,Moon Knight' && w.db.series_tracker[1].released === 12 && w.db.reading_lists.map(r => r.id + ':' + r.sort_order).join() === 'RL0001:1,RL0002:2,RL0003:1' && w.db.reading_lists[0].book_id === 5 && w.db.wishlist_archive.length === 2 && w.db.wishlist_archive[1].pages === 300 && w.db.quotes.length === 2 && w.db.quotes[1].page === 5 && w.db.quotes[1].added === null, [w.db.reading_lists, w.db.quotes]);
      check('(a) row_id order follows the Sheet order in every table', Object.values(w.db).every(rows => rows.every((r, i) => i === 0 || r.row_id > rows[i - 1].row_id)));
      const posts = w.calls.slice(before).filter(c => c.method === 'POST');
      check('(a) bodies carry stored columns only: no user_id, row_id or calc columns', posts.length >= 10 && posts.every(c => Array.isArray(c.body) && c.body.every(o => !('user_id' in o) && !('row_id' in o) && !('remain' in o) && !('%' in o))), posts.map(c => c.table));
      check('(a) each table: DELETE row_id=gt.0 first, then POST', TABS.every(t => { const tb = SBT[t][0], i = w.calls.findIndex((c, k) => k >= before && c.table === tb && c.method === 'DELETE'), j = w.calls.findIndex((c, k) => k >= before && c.table === tb && c.method === 'POST'); return i >= 0 && j > i && w.calls[i].query === '?row_id=gt.0'; }));
      check('(a) read back: every table is read after the writes', TABS.every(t => w.calls.slice(before).filter(c => c.table === SBT[t][0]).slice(-1)[0].method === 'GET'));
      check('(a) the old Supabase rows are gone', !w.db.settings.some(r => r.key.startsWith('stale')));
      check('(a) device switched: backend saved, loading from Supabase', (await cfgOf(page)).backend === 'supabase' && (await page.evaluate(() => state.sb)) === true && (await page.locator('#dSource').inputValue()) === 'supabase');
      await liveSb(page);
      check('(a) the app then shows Supabase data', (await page.evaluate(() => state.allBooks.length)) === 5 && (await btnText(page, '#sbCopy')) === 'Copy Supabase → Sheet (weekly backup)' && (await btnText(page, '#sbCheck')) === 'Check');
      check('(a) the message stays after the switch', /Copied 33 rows/.test(await page.locator('#toolMsg').innerText()));
      check('(b) not one write to the Sheet', api.writes().length === 0, api.writes().map(c => c.method + ' ' + c.p));
      check('(b) only the ten tabs were read (never Brain tester or backups)', api.calls.filter(c => c.p.startsWith('/values/')).every(c => /^'?(Books|Reading Log|App Settings|Ratings|Contents|Wishlist|Series Tracker|Reading Lists|Wishlist archive|QUOTES)'?!A1:/.test(c.p.slice(8))), api.calls.map(c => c.p).filter(p => /Brain|backup/.test(p)));
      check('(a) the full ranges are read: Books A1:AZ5000, Quotes A1:G5000 in its own spreadsheet', api.calls.some(c => c.id === SHEET_ID && c.p === '/values/Books!A1:AZ5000') && api.calls.some(c => c.id === QUOTES_ID && c.p === '/values/QUOTES!A1:G5000') && api.calls.some(c => c.p === "/values/'App Settings'!A1:C50") && api.calls.some(c => c.p === "/values/'Wishlist archive'!A1:P5000"));
    } });

  // chunks of 500 in Sheet order
  await scenario(browser, 'chunks', { mode: 'sheet', build: { edit: fx => { fx['Reading Log'] = Array.from({ length: 1100 }, (_, i) => ({ date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), pages: String(i + 1), bookId: '1', title: 'T', loggedAt: '', source: 'app' })); } }, run: async (page, w) => {
    await press(page, '#sbCopy'); const m = await press(page, '#sbCopy');
    const posts = w.calls.filter(c => c.method === 'POST' && c.table === 'reading_log');
    check('(a) 1,100 Reading Log rows go up in chunks of 500, in order', posts.map(c => c.body.length).join() === '500,500,100' && w.db.reading_log.length === 1100 && w.db.reading_log.every((r, i) => r.pages === i + 1) && /Copied/.test(m), [posts.map(c => c.body.length), m.slice(0, 200)]);
  } });

  // ===== (c) refusals: nothing written anywhere =====
  const refusals = [
    ['duplicate Books id', fx => { fx.Books[3].id = '1'; }, /Books, row 5, id: appears twice \(also in row 2\) “1”/],
    ['duplicate Wishlist id', fx => { fx.Wishlist[4].id = 'WL0003'; }, /Wishlist, row 6, id: appears twice \(also in row 5\) “WL0003”/],
    ['Oct in a date column', fx => { fx.Books[1].startDate = 'Oct'; }, /Books, row 3, startDate: isn't a valid date \(needs yyyy-mm-dd\) “Oct”/],
    ['unknown Sheet column', fx => { fx._extra = true; }, /The Sheet has a column mood in Books that Supabase doesn't have yet/],
    ['missing Sheet column', fx => { fx._drop = true; }, /The Sheet's Books tab has no isbn column/],
    ['blank Wishlist id on a non-blank row', fx => { fx.Wishlist[1].id = ''; }, /Wishlist, row 3, id: is blank/],
    ['Books id that is not a whole number', fx => { fx.Books[4].id = '12.5'; }, /Books, row 6, id: isn't a whole number “12.5”/],
    ['Reading Log row without a date', fx => { fx['Reading Log'][1].date = ''; }, /Reading Log, row 3, date: isn't a valid date \(needs yyyy-mm-dd\) \(blank\)/],
    ['text in a number column', fx => { fx.Books[1].pages = 'about 45'; }, /Books, row 3, pages: isn't a valid number “about 45”/],
    ['Reading Log loggedAt that is not a date and time', fx => { fx['Reading Log'][0].loggedAt = 'last night'; }, /Reading Log, row 2, loggedAt: isn't a date and time/]
  ];
  for (const [label, edit, re] of refusals) {
    await scenario(browser, 'refuse-' + label, { mode: 'sheet', build: { edit, sbEdit: w => { w.db.books.length = 0; w.insert('books', { id: 99, title: 'Keep me' }); } }, run: async (page, w) => {
      if (label === 'unknown Sheet column') { tabOf(w, 'Books').data[0].push('mood'); }
      if (label === 'missing Sheet column') { const t = tabOf(w, 'Books'), i = t.data[0].indexOf('isbn'); t.data.forEach(r => r.splice(i, 1)); }
      await press(page, '#sbCopy'); const m = await press(page, '#sbCopy');
      check(`(c) refuses: ${label}`, re.test(m), m);
      check(`(c) ${label}: nothing written to Supabase or the Sheet, device not switched`, sbWrites(w).length === 0 && w.db.books.length === 1 && w.db.books[0].id === 99 && w.sheetsApi.writes().length === 0 && (await cfgOf(page)).backend === 'sheets');
    } });
  }
  await scenario(browser, 'refuse-many', { mode: 'sheet', build: { edit: fx => { fx['Reading Log'] = Array.from({ length: 25 }, (_, i) => ({ date: 'Oct ' + i, pages: '5', bookId: '1', title: 'T', source: 'app' })); } }, run: async (page, w) => {
    await press(page, '#sbCopy'); const m = await press(page, '#sbCopy');
    check('(c) lists up to 20 problems, then says how many more', m.split('\n').filter(l => /^Reading Log, row/.test(l)).length === 20 && /…and 5 more/.test(m) && sbWrites(w).length === 0, m.slice(0, 300));
  } });

  // ===== (d) Check =====
  // Switched over: no saved choice means Supabase; in Sheet mode the copy to Supabase is hidden and does nothing
  await scenario(browser, 'switched-over-default', { mode: 'sb', noBackend: true, sheetCopy: false, run: async (page, w) => {
    check('switch-over: a device with no saved choice loads from Supabase', (await page.evaluate(() => useSb() && state.sb)) === true && /^Supabase ·/.test(await page.locator('#statusText').innerText()));
  } });
  await scenario(browser, 'switched-over-sheet-mode', { mode: 'sheet', sheetCopy: false, run: async (page, w) => {
    check('switch-over: Copy Sheet → Supabase is hidden in Sheet mode', await page.locator('#sbCopy').isHidden());
    check('switch-over: Sheet mode says the Sheet is the archive', /the Sheet is the archive/.test(await page.locator('#toolMsg').innerText()));
    await page.evaluate(() => toolCopy()); await page.waitForTimeout(300);
    check('switch-over: calling the copy anyway writes nothing to Supabase', sbWrites(w).length === 0);
    check('switch-over: Check is still there', await page.locator('#sbCheck').isVisible());
  } });
  await scenario(browser, 'check', { mode: 'sheet', run: async (page, w) => {
    const api = w.sheetsApi, m1 = await press(page, '#sbCheck');
    check('(d) a match is reported tab by tab', /^Supabase and your Sheet match on every tab\./.test(m1) && /Books: 5 rows in the Sheet, 5 rows in Supabase: matches/.test(m1) && /Quotes: 2 rows in the Sheet, 2 rows in Supabase: matches/.test(m1) && /Reading Log: 6 rows in the Sheet, 6 rows in Supabase: matches/.test(m1), m1);
    check('(d) it ends by naming the source in use', /You're using the Sheet on this device\. If that's the up-to-date one, copy from it to the other\.$/.test(m1), m1);
    check('(d) 1,116 vs 1116 and Yes vs true are not differences', !/differ/.test(m1));
    // edits: a Sheet-only book, two differing cells, a Wishlist row on each side only
    const t = tabOf(w, 'Books'); t.data.push(rowOfBook({ id: '21', title: 'Sheet Only', author: 'S O', status: 'TBR' }));
    dbSet(w, 'books', r => r.id === 5, { status: 'Paused', rating: 4 });
    dbDel(w, 'wishlist', r => r.id === 'WL0003'); w.insert('wishlist', { id: 'WL0099', title: 'Supabase Only', gift: false });
    dbSet(w, 'reading_log', (r, i) => r.date === '2026-10-28', { pages: 31 });
    const m2 = await press(page, '#sbCheck');
    check('(d) differences are counted in plain words', /Books: 6 rows in the Sheet, 5 rows in Supabase: 1 only in the Sheet, 2 cells differ/.test(m2) && /Wishlist: 4 rows in the Sheet, 4 rows in Supabase: 1 only in the Sheet, 1 only in Supabase/.test(m2) && /Reading Log: 6 rows in the Sheet, 6 rows in Supabase: 1 cell differs/.test(m2) && /^They differ:/.test(m2), m2);
    check('(d) examples are given', /Only in the Sheet: row 8 \(id 21\)/.test(m2) && /id 5\), status: Sheet “Reading”, Supabase “Paused”/.test(m2) && /rating: Sheet \(blank\), Supabase “4”/.test(m2) && /Only in Supabase: id WL0099/.test(m2) && /row 3, pages: Sheet “30”, Supabase “31”/.test(m2), m2);
    check('(d) Check is read-only', api.writes().length === 0 && sbWrites(w).length === 0);
    check('(d) the Sheet is only read from, never the other tabs', api.calls.every(c => !/Brain|backup/.test(c.p)));
    const bad = await page.evaluate(() => ({ disabled: document.getElementById('sbCheck').disabled }));
    check('buttons are enabled again once a tool has finished', bad.disabled === false);
  } });
  await scenario(browser, 'check-sb-empty', { mode: 'sb', build: { empty: true }, run: async (page, w) => {
    check('Supabase mode shows Copy Supabase → Sheet (weekly backup) and Check', (await btnText(page, '#sbCopy')) === 'Copy Supabase → Sheet (weekly backup)' && (await btnText(page, '#sbCheck')) === 'Check');
    const m = await press(page, '#sbCheck');
    check('(d) Supabase mode: names Supabase as the one in use', /You're using Supabase on this device\./.test(m) && /Books: 5 rows in the Sheet, 0 rows in Supabase: 5 only in the Sheet/.test(m), m);
    check('(d) zero rows in every table: stale sign-in hint', /If you've copied already, sign out of Supabase and sign in again\./.test(m), m);
  } });
  await scenario(browser, 'check-unknown-column', { mode: 'sheet', run: async (page, w) => {
    tabOf(w, 'Wishlist').data[0].push('mood');
    const m = await press(page, '#sbCheck');
    check('(d) Check also refuses a Sheet column Supabase lacks', /The Sheet has a column mood in Wishlist that Supabase doesn't have yet/.test(m), m);
  } });

  // ===== needs a Google sign-in =====
  for (const mode of ['sheet', 'sb']) await scenario(browser, 'no-google-' + mode, { mode, google: false, run: async (page, w) => {
    const m1 = await press(page, '#sbCheck'), m2 = await press(page, '#sbCopy');
    await page.waitForFunction(() => window.__gisAsked >= 2, null, { timeout: 5000 }).catch(() => {});
    check(`no Google sign-in (${mode} mode): both buttons say what is needed and start the sign-in`, /Connect to Google first/.test(m1) && /Connect to Google first/.test(m2) && (await page.evaluate(() => window.__gisAsked)) === 2, [m1, m2]);
    check(`no Google sign-in (${mode} mode): nothing sent to the Sheet or written to Supabase`, w.sheetsApi.calls.length === 0 && sbWrites(w).length === 0);
  } });
  await scenario(browser, 'sb-signed-in-only', { mode: 'sb', run: async (page, w) => {
    await page.evaluate(() => { localStorage.removeItem('jcm-sb-session'); drawSb(); });
    check('signed out of Supabase: no tools are shown', (await page.evaluate(() => document.getElementById('sbTools').children.length)) === 0);
  } });

  // ===== Copy Supabase -> Sheet =====
  const copyBackEdits = w => {
    dbSet(w, 'books', r => r.id === 5, { status: 'Finished', rating: 4 });                       // 2 cells
    dbSet(w, 'books', r => r.id === 1, { current_page: 150 });                                    // 1 cell
    w.insert('books', { id: 21, title: 'New Book', author: 'N B', status: 'TBR', pages: 200, added: '2026-10-30', favourite: false, copies: 'Kobo', loaned: null });
    dbSet(w, 'wishlist', r => r.id === 'WL0002', { stage: 'Waiting' });                          // 1 cell
    dbDel(w, 'wishlist', r => r.id === 'WL0003');                                                // cleared
    w.insert('wishlist', { id: 'WL0099', added: '2026-10-31', title: 'New Wish', author: 'W W', stage: 'Inbox', gift: false, notes: '=SUM(1)' });
    dbSet(w, 'reading_log', r => r.date === '2026-10-28', { pages: 35 });                        // 1 cell
    w.insert('reading_log', { date: '2026-11-01', pages: 20, book_id: 1, title: 'The Long Tide', page_reached: 150, logged_at: '2026-11-01 08:00', source: 'app', minutes: 25 });
    w.insert('reading_log', { date: '2026-11-02', pages: 15, book_id: 5, title: 'Dust of Stars', page_reached: 83, logged_at: '2026-11-02 08:00', source: 'app', minutes: null });
    dbSet(w, 'settings', r => r.key === 'dailyGoalPages', { value: '80' });                       // 1 cell
    w.insert('quotes', { quote: 'A new line.', from_title: 'The Long Tide', character: '', author: 'Ada Marlowe', book_id: 1, page: 51, added: '2026-11-01' });
  };
  await scenario(browser, 'copy-back', { mode: 'sb', build: { sbEdit: copyBackEdits }, run: async (page, w) => {
    const api = w.sheetsApi, snapOf = () => Object.fromEntries(Object.entries(api.sheets).map(([id, ts]) => [id, Object.fromEntries(ts.map(t => [t.title, JSON.stringify(t.data)]))])), orig = snapOf();
    const m1 = await press(page, '#sbCopy');
    const wantLines = ['Books: 3 cells changed, 1 row added', 'Reading Log: 1 cell changed, 2 rows added', 'App Settings: 1 cell changed', 'Wishlist: 1 cell changed, 1 row added, 1 row cleared', 'Quotes: 1 row added'];
    check('(e) preview counts are right', /^This will change your Sheet:/.test(m1) && wantLines.every(l => m1.split('\n').includes(l)), m1);
    check('(e) tabs that match are left out of the preview', !/Ratings|Contents|Series Tracker|Reading Lists|Wishlist archive/.test(m1), m1);
    check('(e) the preview writes nothing', api.writes().length === 0 && sbWrites(w).length === 0 && (await btnText(page, '#sbCopy')) === 'Write these to the Sheet', api.writes().length);
    const m2 = await press(page, '#sbCopy');
    const dups = api.calls.map((c, i) => c.p === ':batchUpdate' && c.body.requests.some(q => q.duplicateSheet) ? i : -1).filter(i => i >= 0);
    const firstValue = api.calls.findIndex(c => c.p === '/values:batchUpdate');
    check('(f) every backup is made before the first value write', dups.length >= 2 && firstValue > Math.max(...dups), [dups, firstValue]);
    const sheetNames = api.sheets[SHEET_ID].map(t => t.title);
    const changed = ['Books', 'Reading Log', 'App Settings', 'Wishlist'];
    check('(f) one backup per changed tab, named <Tab> backup yyyy-mm-dd, and none for the others', changed.every(t => sheetNames.includes(`${t} backup ${TODAY}`)) && sheetNames.filter(n => / backup /.test(n)).length === 5 && !sheetNames.some(n => /^(Ratings|Contents|Series Tracker|Reading Lists|Wishlist archive) backup/.test(n)), sheetNames);
    check('(f) Quotes is backed up in its own spreadsheet', api.sheets[QUOTES_ID].some(t => t.title === `QUOTES backup ${TODAY}`) && api.sheets[QUOTES_ID].length === 2);
    const backups = [...api.sheets[SHEET_ID], ...api.sheets[QUOTES_ID]].filter(t => / backup /.test(t.title) && !/2026-01-01/.test(t.title));
    check('(f) backups are hidden', backups.length === 5 && backups.every(t => t.hidden === true), backups.map(t => [t.title, t.hidden]));
    check('(f) each backup holds the tab as it was before the write', changed.every(t => JSON.stringify(api.sheets[SHEET_ID].find(x => x.title === `${t} backup ${TODAY}`).data) === orig[SHEET_ID][t])
      && JSON.stringify(api.sheets[QUOTES_ID].find(x => x.title === `QUOTES backup ${TODAY}`).data) === orig[QUOTES_ID].QUOTES);
    check('(f) nothing is deleted: no deleteSheet, no deleteDimension; the old backup is still there', reqs(api).every(q => !q.deleteSheet && !q.deleteDimension && !q.deleteRange) && sheetNames.includes('Wishlist backup 2026-01-01') && JSON.stringify(api.sheets[SHEET_ID].find(t => t.title === 'Wishlist backup 2026-01-01').data) === orig[SHEET_ID]['Wishlist backup 2026-01-01']);
    const ranges = dataRanges(api), single = ranges.filter(r => !/:/.test(r.range));
    const newBookFormula = r => /^Books![IJ]8$/.test(r.range);
    const cellRanges = single.filter(r => !newBookFormula(r)).map(r => r.range).sort();
    check('(g) only the changed cells are written, one range each', JSON.stringify(cellRanges) === JSON.stringify(["'App Settings'!B4", "'Reading Log'!B3", 'Books!C3', 'Books!D3', 'Books!G2', 'Wishlist!J3'].sort()), cellRanges);
    check('(g) values are written the way the Sheet path writes them', [["'App Settings'!B4", '80'], ["'Reading Log'!B3", 35], ['Books!C3', "'Finished"], ['Books!D3', 4], ['Books!G2', 150], ['Wishlist!J3', "'Waiting"]].every(([rg, v]) => (ranges.find(r => r.range === rg) || { values: [[]] }).values[0][0] === v), ranges.filter(r => !/:/.test(r.range)));
    check('(g) remain and % columns are never written for a changed cell', ranges.every(r => !/^Books![IJ]\d+$/.test(r.range) || newBookFormula(r)));
    check('every write is USER_ENTERED, in chunks of at most 500 ranges', api.writes().filter(c => c.p === '/values:batchUpdate').every(c => c.body.valueInputOption === 'USER_ENTERED' && c.body.data.length <= 500));
    const nb = ranges.find(r => r.range === 'Books!A8:AJ8');
    check('(h) the new Books row lands below the last used row (row 8)', !!nb && nb.values.length === 1 && nb.values[0].length === 36 && nb.values[0][0] === "'New Book" && nb.values[0][2] === "'TBR" && nb.values[0][7] === 200 && nb.values[0][35] === "'21" && nb.values[0][4] === '' && nb.values[0][28] === '2026-10-30' && get(w, 'Books', 8, 0) === 'New Book', nb);
    check('(h) and gets both formulas, as a newly added book does', ranges.some(r => r.range === 'Books!I8' && r.values[0][0] === '=IF(N(H8)>0,H8-G8,"")') && ranges.some(r => r.range === 'Books!J8' && r.values[0][0] === '=IF(N(H8)>0,G8/H8*100,"")'));
    check('(h) new rows are written to an explicit range, never appended', !api.calls.some(c => /:append/.test(c.p)) && ranges.some(r => r.range === "'Reading Log'!A9:H10") && ranges.some(r => r.range === 'Wishlist!A7:V7') && ranges.some(r => r.id === QUOTES_ID && r.range === 'QUOTES!A4:G4'), ranges.map(r => r.range));
    const rl = ranges.find(r => r.range === "'Reading Log'!A9:H10");
    check('(h) Reading Log rows: date plain, pages as numbers, ids and titles as text, loggedAt plain', JSON.stringify(rl.values) === JSON.stringify([['2026-11-01', 20, "'1", "'The Long Tide", 150, '2026-11-01 08:00', 'app', 25], ['2026-11-02', 15, "'5", "'Dust of Stars", 83, '2026-11-02 08:00', 'app', '']]), rl.values);
    check('(h) the sheet had too few rows, so one row was added to the Reading Log tab', reqs(api).filter(q => q.appendDimension).length === 1 && reqs(api).find(q => q.appendDimension).appendDimension.length === 1 && tabOf(w, 'Reading Log').rowCount === 10);
    const wr = ranges.find(r => r.range === 'Wishlist!A7:V7');
    check('(h) Wishlist row written like wishAdd: id and added plain, text quoted, formula-looking text kept as text', wr.values[0][0] === 'WL0099' && wr.values[0][1] === '2026-10-31' && wr.values[0][2] === "'New Wish" && wr.values[0][19] === 'FALSE' && wr.values[0][20] === "'=SUM(1)" && get(w, 'Wishlist', 7, 20) === '=SUM(1)', wr.values);
    const rm = ranges.find(r => r.range === 'Wishlist!A5:V5');
    check('(i) a Wishlist removal blanks the row, with no row-delete request', !!rm && rm.values[0].length === 22 && rm.values[0].every(v => v === '') && (tabOf(w, 'Wishlist').data[4] || []).every(v => v === '') && tabOf(w, 'Wishlist').data.length === 7 && reqs(api).every(q => !q.deleteDimension), rm);
    check('(m) read-back reports a match', /^The Sheet now matches Supabase \(12 changes written and checked\)\./.test(m2), m2);
    check('(m) and a separate comparison agrees', nodeCompare(w).length === 0, nodeCompare(w));
    check('(m) the message names the backups it made and says they are kept', /Backed up first \(hidden tabs, kept for you to delete\): Books backup 2026-10-31, Reading Log backup 2026-10-31, App Settings backup 2026-10-31, Wishlist backup 2026-10-31, QUOTES backup 2026-10-31\./.test(m2) || (changed.every(t => m2.includes(`${t} backup ${TODAY}`)) && /QUOTES backup/.test(m2)), m2);
    // (n) nothing outside the ten tabs and the new backups
    const okTabs = new Set(['Books', 'Reading Log', 'App Settings', 'Ratings', 'Contents', 'Wishlist', 'Series Tracker', 'Reading Lists', 'Wishlist archive', 'QUOTES']);
    const tabName = rg => rg.replace(/!.*$/, '').replace(/^'|'$/g, '');
    check('(n) every write range is on one of the ten tabs', ranges.length > 0 && ranges.every(r => okTabs.has(tabName(r.range)) || / backup /.test(tabName(r.range))), ranges.map(r => r.range).filter(r => !okTabs.has(tabName(r))));
    const idsOK = new Set(api.sheets[SHEET_ID].filter(t => okTabs.has(t.title) || (/ backup /.test(t.title) && !/2026-01-01/.test(t.title))).map(t => t.sheetId));
    const idsQ = new Set(api.sheets[QUOTES_ID].map(t => t.sheetId));
    check('(n) every structural request (duplicate, hide, add rows) targets a ten tab or a new backup', reqs(api).every(q => { const x = q.duplicateSheet ? q.duplicateSheet.sourceSheetId : q.updateSheetProperties ? q.updateSheetProperties.properties.sheetId : q.appendDimension ? q.appendDimension.sheetId : -1; return (q.id === QUOTES_ID ? idsQ : idsOK).has(x) && x !== 500 && x !== 501; }), reqs(api));
    check('(n) only the two spreadsheets are used', api.calls.every(c => c.id === SHEET_ID || c.id === QUOTES_ID));
    check('(n) Brain tester is never read or written, and keeps its data', api.calls.every(c => !/Brain/.test(c.p) && !/Brain/.test(JSON.stringify(c.body || {}))) && JSON.stringify(api.sheets[SHEET_ID].find(t => t.title === 'Brain tester').data) === orig[SHEET_ID]['Brain tester']);
    check('(n) tabs that matched are untouched', ['Ratings', 'Contents', 'Series Tracker', 'Reading Lists', 'Wishlist archive'].every(t => JSON.stringify(api.sheets[SHEET_ID].find(x => x.title === t).data) === orig[SHEET_ID][t]));
    check('nothing was written to Supabase by the copy back', sbWrites(w).length === 0);
    // a second copy on the same day: the backup name gets (2) and the first backup is left alone
    const firstBackup = JSON.stringify(api.sheets[SHEET_ID].find(t => t.title === `App Settings backup ${TODAY}`).data);
    dbSet(w, 'settings', r => r.key === 'yearBookGoal', { value: '41' });
    await press(page, '#sbCopy'); const m3 = await press(page, '#sbCopy');
    check('(f) a second copy the same day backs up as "(2)" and leaves the first backup alone', api.sheets[SHEET_ID].some(t => t.title === `App Settings backup ${TODAY} (2)` && t.hidden) && JSON.stringify(api.sheets[SHEET_ID].find(t => t.title === `App Settings backup ${TODAY}`).data) === firstBackup && /matches Supabase \(1 change written/.test(m3), m3);
    const m4 = await press(page, '#sbCopy');
    check('when the Sheet already matches there is nothing to copy', /^Your Sheet already matches Supabase\. Nothing to copy\./.test(m4) && (await btnText(page, '#sbCopy')) === 'Copy Supabase → Sheet (weekly backup)', m4);
  } });

  // A book deleted for good in Supabase (Toolbox > Removed books) is cleared in the Sheet: the row stays, empty, and the remain / % formula columns are never written
  await scenario(browser, 'copy-back-books-removed', { mode: 'sb', build: { sbEdit: w => { dbDel(w, 'books', r => r.id === 9); dbSet(w, 'settings', r => r.key === 'yearBookGoal', { value: '41' }); } }, run: async (page, w) => {
    const api = w.sheetsApi, rows0 = tabOf(w, 'Books').data.length, m = await press(page, '#sbCopy');
    check('(j) a book deleted in Supabase shows in the preview as a cleared Sheet row, listed by title', /Books: 1 row cleared/.test(m) && /In the Sheet but not in the app, will be cleared: Harbour Lights/.test(m) && !/missing from Supabase/.test(m), m);
    await page.click('#sbCopy'); await page.waitForSelector('#askDlg[open]');
    check('(j) a second press asks "Clear these 1 book from the Sheet backup?"', (await page.locator('#askMsg').innerText()) === 'Clear these 1 book from the Sheet backup?');
    await page.evaluate(() => document.getElementById('askNo').click()); await page.waitForFunction(() => /Cancelled/.test((document.getElementById('toolMsg') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {}); await idle(page);
    check('(j) Cancel copies nothing: no Sheet writes, no backups', api.writes().length === 0 && /Cancelled\. Nothing was copied\./.test(await page.locator('#toolMsg').innerText()), api.writes().length);
    await press(page, '#sbCopy');
    await page.click('#sbCopy'); await page.waitForSelector('#askDlg[open]'); await page.evaluate(() => document.getElementById('askYes').click()); await page.waitForTimeout(300); await idle(page);
    const ranges = dataRanges(api).filter(r => /^Books!/.test(r.range));
    check('(j) the Sheet row is cleared in two ranges around the formula columns (A5:H5, K5:AJ5); remain / % (I, J) are never written', JSON.stringify(ranges.map(r => r.range).sort()) === JSON.stringify(['Books!A5:H5', 'Books!K5:AJ5']) && ranges.every(r => r.values.length === 1 && r.values[0].every(v => v === '')), ranges.map(r => r.range));
    const t = tabOf(w, 'Books');
    check('(j) the row is not deleted or shifted: the Books tab keeps its row count and the id 9 row is blank', t.data.length === rows0 && String(t.data[4][35] ?? '') === '' && reqs(api).every(q => !q.deleteDimension && !q.deleteRange) && !t.data[4].some((v, i) => i !== 8 && i !== 9 && String(v ?? '').trim()), t.data.length);
    t.data[4][8] = ''; t.data[4][9] = '';   // the formulas in a real Sheet show blank on an empty row (the fixture holds plain values there)
    check('(j) after the clear, a second copy finds nothing left to do', /already matches|nothing to copy/i.test(await press(page, '#sbCopy')));
  } });
  // Copy Sheet -> Supabase ignores a cleared (blank) Sheet row
  await scenario(browser, 'copy-books-cleared-row', { mode: 'sheet', run: async (page, w) => {
    const t = tabOf(w, 'Books'); for (let c = 0; c < t.data[4].length; c++) t.data[4][c] = '';   // blank, as the formulas show on an empty row
    await press(page, '#sbCopy'); await press(page, '#sbCopy');
    check('(a2) a cleared Books row in the Sheet is skipped by Copy Sheet -> Supabase (4 books, none with id 9)', w.db.books.length === 4 && !w.db.books.some(r => r.id === 9), w.db.books.map(r => r.id));
  } });
  await scenario(browser, 'copy-back-fewer', { mode: 'sb', build: { sbEdit: w => { w.db.reading_log.pop(); dbSet(w, 'settings', r => r.key === 'yearBookGoal', { value: '41' }); } }, run: async (page, w) => {
    const m = await press(page, '#sbCopy');
    check('(k) fewer Reading Log rows in Supabase than the Sheet is refused', /Reading Log: Supabase has 5 rows but the Sheet has 6 rows\. This tab only ever grows, so nothing was written\./.test(m), m);
    check('(k) nothing written', w.sheetsApi.writes().length === 0);
  } });
  await scenario(browser, 'copy-back-duplicate-key', { mode: 'sb', build: { edit: fx => { fx.Wishlist[4].id = 'WL0001'; } }, run: async (page, w) => {
    const m = await press(page, '#sbCopy');
    check('a duplicate key in the Sheet stops the copy back too', /Wishlist: id WL0001 is in the Sheet twice \(row 6\)/.test(m) && w.sheetsApi.writes().length === 0, m);
  } });
  await scenario(browser, 'copy-back-changed', { mode: 'sb', build: { sbEdit: w => { dbSet(w, 'wishlist', r => r.id === 'WL0002', { stage: 'Waiting' }); } }, run: async (page, w) => {
    const api = w.sheetsApi, m1 = await press(page, '#sbCopy');
    check('(l) preview first', /Wishlist: 1 cell changed/.test(m1));
    tabOf(w, 'Wishlist').data.splice(1, 0, ['WL0000', '2026-10-30', 'Typed by hand']);      // someone adds a row in the Sheet
    const m2 = await press(page, '#sbCopy');
    check('(l) a Sheet changed between the preview and the write aborts', /the Sheet changed since the check, press Copy again/.test(m2), m2);
    check('(l) with nothing written: no backups, no values', api.writes().length === 0, api.writes().map(c => c.p));
    check('(l) and the button is back to its start', (await btnText(page, '#sbCopy')) === 'Copy Supabase → Sheet (weekly backup)');
  } });
  await scenario(browser, 'copy-back-sheet-edit-cell', { mode: 'sb', build: { sbEdit: w => { dbSet(w, 'wishlist', r => r.id === 'WL0002', { stage: 'Waiting' }); } }, run: async (page, w) => {
    await press(page, '#sbCopy');
    tabOf(w, 'Wishlist').data[1][2] = 'Edited in the Sheet after the preview';
    const m2 = await press(page, '#sbCopy');
    check('(l) an edit to any cell of a changed tab in between aborts too', /the Sheet changed since the check/.test(m2) && w.sheetsApi.writes().length === 0, m2);
  } });

  // ===== (o) screens at 390px, both modes =====
  for (const mode of ['sheet', 'sb']) await scenario(browser, 'layout-390-' + mode, { mode, vp: { width: 390, height: 800 }, build: { sbEdit: w => { dbSet(w, 'books', r => r.id === 5, { status: 'Paused' }); w.insert('wishlist', { id: 'WL0099', title: 'A very long title that goes on and on and on' }); } }, run: async (page, w) => {
    const metric = () => page.evaluate(() => { const d = document.getElementById('dataDlg'), r = d.getBoundingClientRect(), t = document.getElementById('sbTools').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, dsw: d.scrollWidth, dcw: d.clientWidth, l: r.left, r: r.right, tl: t.left, tr: t.right }; });
    const ok = m => m.sw <= m.iw && m.dsw <= m.dcw && m.l >= 0 && m.r <= m.iw && m.tl >= m.l && m.tr <= m.r;
    let m = await metric();
    check(`(o) 390px ${mode} mode: buttons fit, no sideways scroll`, ok(m), m);
    await press(page, '#sbCheck');
    await page.evaluate(() => { const e = document.getElementById('toolMsg'); e.textContent += '\nA_very_long_unbroken_line_of_text_that_has_no_spaces_in_it_at_all_to_test_wrapping_in_a_narrow_dialog_1234567890'; });
    m = await metric(); check(`(o) 390px ${mode} mode: after a Check with a long message`, ok(m), m);
    await page.screenshot({ path: path.join(OUT, `tools-390-${mode}-check.png`) });
    await press(page, '#sbCopy');
    m = await metric(); check(`(o) 390px ${mode} mode: after the first press of Copy`, ok(m), m);
    await page.screenshot({ path: path.join(OUT, `tools-390-${mode}-copy.png`) });
  } });

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  fs.writeFileSync(path.join(OUT, 'result.txt'), log.join('\n'));
  console.log(log.join('\n'));
  const pass = log.filter(l => l.startsWith('PASS')).length, fail = log.filter(l => l.startsWith('FAIL')).length;
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

function rowOfBook(o) { return rowOf('Books', o); }
