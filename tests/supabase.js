// Supabase mode, headless: fake auth, fake PostgREST (in-memory tables per schema) and fake Realtime, all through page.route
// plus a WebSocket stub. Nothing here touches a real Google or Supabase server. Synthetic data from tests/data.js.
// Usage: node tests/supabase.js <outDir>      (prints PASS/FAIL lines; exits 1 on any FAIL)
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { makeSheets } = require('./data.js');
const { makeStore, FIXED } = require('./lib.js');
const OUT = process.argv[2] || path.join(__dirname, 'out', 'sb');
fs.mkdirSync(OUT, { recursive: true });
const APP = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const HTML = '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n' + APP;
const F = require('./fakes.js');
const { SBU, RT_TABLE, GOOD, EXPIRED, FRESH, sbRoute, sbWorld, routeRealtime } = F;
const ORIGIN = 'https://library.test';
const TODAY = FIXED.slice(0, 10);

// ---- the converters and the table map come straight from app.html, so the seed uses the app's own types ----

const log = [], errors = [];
const check = (name, ok, extra) => log.push((ok ? 'PASS ' : 'FAIL ') + name + (!ok && extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 400) : ''));
let sheetsHits = 0;

// ---- fake world (the database, routes and Realtime stub are in tests/fakes.js) ----
const { SBT, sbToCell, cellToSb } = F.appFns(APP);
function world(opts = {}) {
  const w = sbWorld();
  if (!opts.empty) {   // seed from the synthetic Sheet data, converted with the app's own column types
    const sheets = makeSheets();
    for (const [tab, [table, cols]] of Object.entries(SBT)) {
      const rows = sheets[tab === 'Quotes' ? 'QUOTES' : tab] || [];
      const header = (rows[0] || []).map(String).map(h => tab === 'App Settings' && h === 'key' ? 'setting' : h);
      for (const r of rows.slice(1)) {
        if (!r.some(v => String(v ?? '').trim())) continue;
        const o = {};
        cols.forEach(([h, c, t]) => { if (t === 'calc') return; const i = header.indexOf(h); o[c] = cellToSb(t, i >= 0 ? r[i] : ''); });
        w.insert(table, o);
      }
    }
  }
  return w;
}

async function install(page, w) {
  await page.route('**/*', async r => {
    const req = r.request(), url = req.url(), u = new URL(url);
    if (url.includes('chart.umd.js')) return r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(c,cfg){this.cfg=cfg;this.data=cfg&&cfg.data;};Chart.prototype.destroy=function(){};Chart.prototype.update=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}},tooltip:{}}};' });
    if (u.origin === ORIGIN) return r.fulfill({ contentType: 'text/html', body: HTML });
    if (/accounts\.google\.com/.test(u.host)) return r.fulfill({ contentType: 'text/javascript', body: '' });
    if (/sheets\.googleapis\.com/.test(u.host)) { sheetsHits++; w.sheetsHit = (w.sheetsHit || 0) + 1; return r.fulfill({ status: 500, body: '{}' }); }
    if (u.origin === SBU) return sbRoute(r, w);
    if (url.startsWith('data:') || url.startsWith('about:')) return r.continue();
    return r.abort();
  });
  await routeRealtime(page, w);
}

// ---- scenario runner ----
async function scenario(browser, name, { init = {}, session = 'live', vp = { width: 1280, height: 900 }, url = ORIGIN + '/', world: wopts, setup, claude, run }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(name + ': ' + m.text()); });
  const w = world(wopts); if (setup) setup(w);
  await page.clock.install({ time: new Date(FIXED) });
  await install(page, w);
  if (claude) { w.writes = []; const call = makeStore(makeSheets(), w.writes); await page.exposeFunction('__call', (tool, input) => call(tool, input)); }
  const sess = { live: { at: GOOD, rt: 'rt1', exp: 'NOW+1h', email: 'me@example.com' }, expired: { at: EXPIRED, rt: 'rt1', exp: 'NOW-1s', email: 'me@example.com' }, stale401: { at: EXPIRED, rt: 'rt1', exp: 'NOW+1h', email: 'me@example.com' } }[session];
  await page.addInitScript(([init, sess, claude]) => {
    if (claude) window.claude = { use: async () => ({ callTool: async (server, tool, input) => ({ payload: await window.__call(tool, input) }) }) };
    if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
    try { localStorage.clear(); } catch (e) {}
    Object.entries(init).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
    if (sess) localStorage.setItem('jcm-sb-session', JSON.stringify({ ...sess, exp: Date.now() + (sess.exp === 'NOW+1h' ? 3600e3 : -1000) }));
    { let x = 12345; Math.random = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
  }, [init, session ? sess : null, !!claude]);
  try { await page.goto(url); await run(page, w); } catch (e) { check(name + ' ran without throwing', false, String(e.message).slice(0, 300)); }
  check(name + ': no requests to sheets.googleapis.com', !w.sheetsHit, w.sheetsHit);
  await ctx.close();
}
const SB_CFG = { mbl_config: { backend: 'supabase' } };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.state === 'live' && /^Supabase ·/.test(document.getElementById('statusText').textContent) && state.libLoaded && disc.loaded, null, { timeout: 10000 });
const saved = async (page, ms = 500) => { await page.waitForFunction(() => !state.busy && !planQ.pending && !wishQ.pending && !wl.moving && !pruning, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(ms); };
const writesSince = (w, n) => w.calls.slice(n).filter(c => c.method !== 'GET');
const keysOf = o => Object.keys(o || {}).sort().join(',');
const fill = (page, sel, vals) => page.evaluate(([sel, vals]) => {
  for (const [k, v] of Object.entries(vals)) { const el = document.querySelector(sel.replace('%', k)); if (!el) throw new Error('no field ' + sel.replace('%', k)); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
}, [sel, vals]);
const submit = (page, sel) => page.evaluate(s => document.querySelector(s).requestSubmit(), sel);
const yes = async page => { await page.waitForSelector('#askDlg[open]', { timeout: 5000 }); await page.evaluate(() => document.getElementById('askYes').click()); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name + ' ran without throwing', false, String(e.stack).split('\n').slice(0, 4).join(' | ')); } };

(async () => {
  const browser = await pw.chromium.launch();

  // ===== converters (pure functions) =====
  check('cellToSb: strips the leading quote', cellToSb('text', "'1984") === '1984' && cellToSb('text', "'") === '');
  check('cellToSb: numbers with commas, blanks, junk', cellToSb('num', '1,116') === 1116 && cellToSb('num', '') === null && cellToSb('num', 'abc') === null && cellToSb('num', 4.5) === 4.5 && cellToSb('num', "'12") === 12 && cellToSb('num', '$9.50') === 9.5);
  check('cellToSb: int truncates; date keeps yyyy-mm-dd or null', cellToSb('int', '2021') === 2021 && cellToSb('int', '1.9') === 1 && cellToSb('date', '2026-10-31') === '2026-10-31' && cellToSb('date', '') === null && cellToSb('date', 'soon') === null && cellToSb('date', '2026-10-31 10:00') === '2026-10-31');
  check('cellToSb: Yes/blank and TRUE/FALSE', cellToSb('bool', 'Yes') === true && cellToSb('bool', '') === false && cellToSb('tf', 'TRUE') === true && cellToSb('tf', 'FALSE') === false && cellToSb('tf', '') === false);
  check('sbToCell: back to Sheet strings', sbToCell('num', 1116) === '1116' && sbToCell('num', null) === '' && sbToCell('num', 4.5) === '4.5' && sbToCell('date', '2026-10-31') === '2026-10-31' && sbToCell('date', null) === '' && sbToCell('bool', true) === 'Yes' && sbToCell('bool', false) === '' && sbToCell('tf', false) === 'FALSE' && sbToCell('tf', true) === 'TRUE' && sbToCell('text', null) === '' && sbToCell('int', 37) === '37');
  const headerFacts = { Books: 36, 'Reading Log': 8, 'App Settings': 3, Ratings: 10, Contents: 4, Wishlist: 22, 'Series Tracker': 9, 'Reading Lists': 7, 'Wishlist archive': 16, Quotes: 7 };
  check('SBT: ten tabs with the right number of columns', Object.entries(headerFacts).every(([t, n]) => SBT[t] && SBT[t][1].length === n), Object.entries(SBT).map(([t, v]) => [t, v[1].length]));
  check('SBT: Books order starts title,author and ends notes,id; calc columns are remain and %', SBT.Books[1][0][0] === 'title' && SBT.Books[1][35][0] === 'id' && SBT.Books[1].filter(c => c[2] === 'calc').map(c => c[0]).join() === 'remain,%');

  // ===== 1. load + every write path, one signed-in session =====
  await scenario(browser, 'main', { init: SB_CFG, setup: w => { w.db.series_tracker.forEach(r => { if (r.kind === 'Comic') r.kind = 'Comic run'; }); }, run: async (page, w) => {
    await live(page);
    const first = w.calls.filter(c => c.method === 'GET');
    check('load: status starts "Supabase ·"', (await page.locator('#statusText').innerText()).startsWith('Supabase ·'), await page.locator('#statusText').innerText());
    check('load: every request carries apikey, bearer and the books schema', w.calls.every(c => c.headers.apikey && c.headers.authorization === 'Bearer ' + GOOD && c.headers['accept-profile'] === 'books'));
    check('load: books pages 1000 at a time in row_id order', first.some(c => c.path === 'books?select=*&order=row_id&limit=1000&offset=0'), first.map(c => c.path));
    const st = await page.evaluate(() => ({ books: state.allBooks.length, entries: state.entries.length, b1: state.allBooks.find(b => b.id === '1'), wish: disc.wish.length, series: disc.series.length, lists: disc.lists.length, quotes: disc.quotes.length, set: state.settings, shown: document.querySelectorAll('#libShelves .spine, #libSecs .row, .nb').length }));
    check('load: shows the 16 books, the log, Wishlist, series, lists, quotes', st.books === 16 && st.entries > 30 && st.wish === 10 && st.series === 2 && st.lists === 3 && st.quotes === 2, st);
    check('load: remain and % are worked out on read (120 of 340)', st.b1.remain === '220' && st.b1['%'] === '35' && st.b1.currentPage === '120' && st.b1.favourite === '' && st.b1.rating === '', st.b1);
    check('load: settings read (daily goal 60)', st.set.dailyGoalPages === 60 && st.set.yearBookGoal === 40, st.set);
    check('load: Toolbox has "Data & sign-in" on the live site', await page.evaluate(() => !document.getElementById('dataPg').hidden));
    await page.waitForFunction(() => document.querySelector('#status .dot[data-sync]'), null, { timeout: 5000 }).catch(() => {});
    const j = w.rt.joins[0] || {};
    check('realtime: joins realtime:books with the signed-in token, schema books only', w.rt.joins.length === 1 && j.access_token === GOOD && JSON.stringify(j.config.postgres_changes) === JSON.stringify([{ event: '*', schema: 'books' }]) && /^wss:/.test(w.rt.url), [j, w.rt.url]);
    check('realtime: the status dot shows live sync', !!(await page.$('#status .dot[data-sync]')));
    const rowOf = (t, id) => w.db[t].find(r => r.id === id);

    let loggedPages = 0;
    await step('log pages', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { const i = document.querySelector('input[aria-describedby="meta-1"]'); i.value = '150'; i.dispatchEvent(new Event('input', { bubbles: true })); i.closest('.nb-log').querySelector('.btn-primary').click(); });
      await saved(page, 700);
      const ws = writesSince(w, n), lg = ws.find(c => c.method === 'POST' && c.table === 'reading_log'), bk = ws.find(c => c.method === 'PATCH' && c.table === 'books');
      check('log pages: one log row inserted with typed columns', !!lg && !Array.isArray(lg.body) && lg.body.date === TODAY && lg.body.pages > 0 && lg.body.book_id === 1 && lg.body.title === 'The Long Tide' && lg.body.page_reached === 150 && lg.body.source === 'app' && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(lg.body.logged_at) && !('user_id' in lg.body) && !('row_id' in lg.body), lg && lg.body);
      loggedPages = lg ? lg.body.pages : 0;
      check('log pages: Prefer return=representation on the log insert', lg && /return=representation/.test(lg.headers.prefer));
      check('log pages: the book\'s currentPage patched, only that column', !!bk && keysOf(bk.body) === 'current_page' && bk.body.current_page === 150 && rowOf('books', 1) && rowOf('books', 1).current_page === 150, bk && [bk.query, bk.body]);
      check('log pages: nothing else written', ws.length === 2, ws.map(c => c.method + ' ' + c.table));
      const m = w.calls.length;
      const r = await page.evaluate(async () => [await DB().bookPage('1', 100), await DB().bookPage('1', 150)]);
      check('log pages: moves forward only (lower and equal pages write nothing)', r[0] === false && r[1] === false && writesSince(w, m).length === 0, r);
      const r2 = await page.evaluate(async () => DB().bookPage('1', 160));
      check('log pages: a higher page does write', r2 === true && rowOf('books', 1).current_page === 160);
      await page.evaluate(async () => DB().bookPage('1', 150)); w.db.books.find(b => b.id === 1).current_page = 150;
      const e = await page.evaluate(lp => { const x = state.entries.find(y => y.bookId === '1' && y.pages === lp); return x && x._row; }, loggedPages);
      check('log pages: new entry has a row marker for later edits', e >= 2, e);
    });

    await step('edit a book', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { showTab('library'); openBookDialog(state.allBooks.find(x => x.id === '21')); });
      await fill(page, '#bookForm [name="%"]', { title: 'Salt Road (2nd ed)', genre: 'Fantasy', rating: '4', pages: '275', notes: 'edited in test', series: 'Roads', seriesNum: '1.5' });
      await submit(page, '#bookForm'); await saved(page, 800);
      const ps = writesSince(w, n).filter(c => c.table === 'books');
      const p = ps.find(c => c.method === 'PATCH' && /id=eq\.21$/.test(c.query));
      check('edit book: PATCH by id=eq.21 with return=representation', !!p && /return=representation/.test(p.headers.prefer), ps.map(c => c.method + ' ' + c.query));
      check('edit book: only the changed columns, typed', !!p && keysOf(p.body) === 'genre,notes,pages,rating,series,series_num,title' && p.body.rating === 4 && p.body.pages === 275 && p.body.series_num === 1.5 && p.body.title === 'Salt Road (2nd ed)', p && p.body);
      check('edit book: never sends remain, %, id, user_id or row_id', ps.every(c => !c.body || ['remain', '%', 'id', 'user_id', 'row_id'].every(k => !(k in c.body))));
      check('edit book: stored in the table', rowOf('books', 21).series === 'Roads' && rowOf('books', 21).pages === 275);
      const bad = await page.evaluate(() => DB().bookUpdate('9999', { notes: 'x' }).then(() => 'ok', e => e.message));
      check('edit book: a missing id throws the Sheet message', bad === "ID 9999 isn't in Books any more", bad);
    });

    await step('add a book', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { showTab('library'); openBookDialog(null); });
      await fill(page, '#bookForm [name="%"]', { title: 'Brand New Book', author: 'Nia New', status: 'TBR', pages: '300', genre: 'Mystery', type: 'Novel', copies: 'Kobo', notes: 'added in test' });
      await submit(page, '#bookForm'); await saved(page, 800);
      const cs = w.calls.slice(n), top = cs.find(c => c.method === 'GET' && c.path === 'books?select=id&order=id.desc&limit=1'), p = cs.find(c => c.method === 'POST' && c.table === 'books');
      check('add book: reads the highest id just before inserting', !!top && cs.indexOf(top) < cs.indexOf(p), cs.map(c => c.method + ' ' + c.path));
      check('add book: id is highest + 4 (61 -> 65), typed columns, every column sent', !!p && Array.isArray(p.body) && p.body.length === 1 && p.body[0].id === 65 && p.body[0].title === 'Brand New Book' && p.body[0].pages === 300 && p.body[0].favourite === false && p.body[0].rating === null && p.body[0].added === TODAY && !('remain' in p.body[0]) && !('user_id' in p.body[0]), p && p.body);
      check('add book: the app lists it with that id', await page.evaluate(() => state.allBooks.some(b => b.title === 'Brand New Book' && b.id === '65')));
      // another device takes the id first: 409, re-read, one retry
      w.race = 1; const m = w.calls.length;
      const id2 = await page.evaluate(async () => (await addBook({ title: 'Race Book', author: 'Rae Ace', status: 'TBR' })).id);
      const posts = w.calls.slice(m).filter(c => c.method === 'POST' && c.table === 'books');
      check('add book: on a 409 it re-reads and retries once with the next id', posts.length === 2 && posts[0].status === 409 && posts[1].status === 201 && posts[0].body[0].id === 69 && posts[1].body[0].id === 73 && id2 === '73', posts.map(c => [c.status, c.body[0].id]));
      check('add book: the other device\'s book is untouched', w.db.books.filter(b => b.id === 69).length === 1 && w.db.books.find(b => b.id === 69).title === 'Added on another device');
      w.race = 0;
      const m2 = w.calls.length;
      const many = await page.evaluate(async () => { const r = await DB().booksAddMany([{ title: 'Many A', status: 'TBR', currentPage: '0' }, { title: 'Many B', status: 'TBR' }]); return r; });
      const mp = w.calls.slice(m2).filter(c => c.method === 'POST' && c.table === 'books');
      check('add many: one POST of both rows, ids +4 each, r0 null', mp.length === 1 && mp[0].body.length === 2 && many.ids.join() === '77,81' && many.r0 === null && many.header.length === 36, [many, mp.map(c => c.body.map(b => b.id))]);
    });

    await step('finish a book', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { showTab('library'); showCard('5'); });
      await page.selectOption('#bookCard select', 'Finished'); await saved(page, 800);
      const ps = writesSince(w, n).filter(c => c.method === 'PATCH' && c.table === 'books');
      check('finish: status Finished is patched on id=eq.5 (finish date set, no calc columns)', ps.length >= 1 && ps.every(c => /id=eq\.5$/.test(c.query) && !('remain' in c.body) && !('%' in c.body)) && ps.some(c => c.body.status === 'Finished') && rowOf('books', 5).status === 'Finished' && rowOf('books', 5).finish_date === TODAY, ps.map(c => c.body));
    });

    await step('wishlist add, edit, remove', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); });
      await fill(page, '#%', { wlQuick: 'Quick Title by Quinn Quick' });
      await page.evaluate(() => document.getElementById('wlQuickBtn').click()); await saved(page, 800);
      let p = writesSince(w, n).find(c => c.method === 'POST' && c.table === 'wishlist');
      check('wishlist add: POST with next WL id (WL0011), Inbox, gift false', !!p && p.body.length === 1 && p.body[0].id === 'WL0011' && p.body[0].title === 'Quick Title' && p.body[0].author === 'Quinn Quick' && p.body[0].stage === 'Inbox' && p.body[0].gift === false && p.body[0].added === TODAY && p.body[0].price === '', p && p.body);
      const m = w.calls.length;
      await page.evaluate(() => openWishDlg(null));
      await fill(page, '#wd-%', { title: 'Dialog Title', author: 'Dee Dialog', series: 'Dialogs', number: '2', type: 'Comic', format: 'Issues', stage: 'To buy', price: '9.5', release: '2026-12-25', notes: 'n' });
      await page.evaluate(() => { document.getElementById('wd-gift').checked = true; });
      await submit(page, '#wishDlg form'); await saved(page, 800);
      p = writesSince(w, m).find(c => c.method === 'POST' && c.table === 'wishlist');
      check('wishlist add dialog: free-text number and price, gift typed (number "2", price "9.5", gift true, id WL0012)', !!p && p.body[0].id === 'WL0012' && p.body[0].number === '2' && p.body[0].price === '9.5' && p.body[0].gift === true && p.body[0].release === '2026-12-25' && p.body[0].stage === 'To buy', p && p.body);
      const e0 = w.calls.length;
      await page.evaluate(() => setWishFields(disc.wish.find(x => x.id === 'WL0005'), { checked: 'Available', checkedOn: '2026-10-31', wantAs: 'PDF' })); await saved(page, 600);
      const pe = writesSince(w, e0);
      check('wishlist edit: one PATCH by id with only the changed columns', pe.length === 1 && pe[0].method === 'PATCH' && pe[0].query.startsWith('?id=eq.WL0005') && keysOf(pe[0].body) === 'checked,checked_on,want_as' && pe[0].body.checked_on === '2026-10-31', pe.map(c => [c.query, c.body]));
      const d0 = w.calls.length;
      await page.evaluate(() => { dropWish(disc.wish.find(x => x.id === 'WL0007')); }); await yes(page); await saved(page, 600);
      const pd = writesSince(w, d0);
      check('wishlist remove: the row is deleted (not blanked)', pd.length === 1 && pd[0].method === 'DELETE' && pd[0].query.startsWith('?id=eq.WL0007') && !w.db.wishlist.some(x => x.id === 'WL0007'), pd.map(c => [c.method, c.query]));
      check('wishlist remove: gone from the page too', await page.evaluate(() => !disc.wish.some(x => x.id === 'WL0007')));
    });

    await step('got it', async () => {
      const n = w.calls.length, booksBefore = w.db.books.length;
      await page.evaluate(async () => { showTab('library'); await moveWishToBooks([disc.wish.find(x => x.id === 'WL0003'), disc.wish.find(x => x.id === 'WL0010')]); });
      await saved(page, 800);
      const ws = writesSince(w, n), seq = ws.map(c => c.method + ' ' + c.table);
      check('got it: Books insert, then archive insert, then wishlist deletes', seq.join() === 'POST books,POST wishlist_archive,DELETE wishlist,DELETE wishlist', seq);
      const nb = ws[0].body, ar = ws[1].body;
      check('got it: one new TBR book (the other title was already in Books)', nb.length === 1 && nb[0].title === 'Kobo Find' && nb[0].status === 'TBR' && nb[0].copies === 'Kobo' && nb[0].current_page === 0 && w.db.books.length === booksBefore + 1, nb);
      check('got it: archive rows keep the Wishlist id and the new book id', ar.length === 2 && ar.map(r => r.id).sort().join() === 'WL0003,WL0010' && ar.find(r => r.id === 'WL0003').title === 'Kobo Find' && ar.find(r => r.id === 'WL0003').book_id === nb[0].id && ar.find(r => r.id === 'WL0010').book_id === 57 && ar.find(r => r.id === 'WL0003').status === 'Downloaded', ar);
      check('got it: both Wishlist rows deleted', !w.db.wishlist.some(x => x.id === 'WL0003' || x.id === 'WL0010') && w.db.wishlist_archive.length === 2);
    });

    await step('series', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); document.querySelector('[data-wv="series"]').click(); openSeriesDlg(null); });
      await fill(page, '#sd-%', { series: 'Akira', author: 'Sam Series', publisher: 'Pub', kind: 'Comic run', status: 'Ongoing', soldAs: 'Issues', notes: 'fresh' });
      await submit(page, '#seriesDlg form'); await saved(page, 800);
      const ws = writesSince(w, n), p = ws.find(c => c.method === 'POST' && c.table === 'series_tracker');
      check('series new: POST with series Akira, released null', !!p && p.body.series === 'Akira' && p.body.released === null && p.body.sold_as === 'Issues' && p.body.status === 'Ongoing' && p.body.kind === 'Comic run', p && p.body);
      const m = w.calls.length, spawn = w.db.series_tracker.find(r => r.series === 'Spawn');
      await page.evaluate(() => openSeriesDlg(disc.series.find(s => s.series === 'Spawn')));
      await fill(page, '#sd-%', { status: 'Complete', notes: 'edited note', link: 'https://example.com/spawn' });
      await submit(page, '#seriesDlg form'); await saved(page, 800);
      const pe = writesSince(w, m).filter(c => c.table === 'series_tracker');
      check('series edit: one PATCH by row_id with only the changed columns', pe.length === 1 && pe[0].method === 'PATCH' && pe[0].query === `?row_id=eq.${spawn.row_id}` && keysOf(pe[0].body) === 'link,notes,status', pe.map(c => [c.method, c.query, c.body]));
      const m2 = w.calls.length;
      await page.evaluate(() => openSeriesDlg(disc.series.find(s => s.series === 'Moon Knight')));
      await fill(page, '#sd-%', { series: 'Stardust' });
      await submit(page, '#seriesDlg form'); await saved(page, 800);
      const pr = writesSince(w, m2).filter(c => c.table === 'series_tracker');
      check('series rename: matched by the OLD name, PATCH series only', pr.length === 1 && pr[0].method === 'PATCH' && keysOf(pr[0].body) === 'series' && pr[0].body.series === 'Stardust' && w.db.series_tracker.some(r => r.series === 'Stardust') && !w.db.series_tracker.some(r => r.series === 'Moon Knight'), pr.map(c => [c.method, c.query, c.body]));
      const dupe = await page.evaluate(() => DB().seriesSave({ series: 'Akira', author: '', publisher: '', kind: '', status: '', released: '', soldAs: '', link: '', notes: '' }, 'Akira').then(r => r, e => e.message));
      check('series: saving an existing name edits it (isNew false, same row number)', dupe && dupe.isNew === false && typeof dupe.row === 'number', dupe);
    });

    await step('reading list', async () => {
      const n = w.calls.length;
      await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="lists"]').click(); openListDlg(null, 'Classics'); });
      await fill(page, '#rl-%', { title: 'Added Classic', author: 'Cass Sic', notes: 'n1' });
      await submit(page, '#listForm'); await saved(page, 800);
      const p = writesSince(w, n).find(c => c.method === 'POST' && c.table === 'reading_lists');
      check('list add: POST with next RL id (RL0004) and list name', !!p && p.body.id === 'RL0004' && p.body.list === 'Classics' && p.body.title === 'Added Classic' && p.body.sort_order === 2 && /return=representation/.test(p.headers.prefer), p && p.body);
      const m = w.calls.length;
      await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0002'), 'Summer Sci-Fi'));
      await fill(page, '#rl-%', { notes: 'edited', order: '5' });
      await submit(page, '#listForm'); await saved(page, 800);
      const pe = writesSince(w, m);
      check('list edit: PATCH by id with notes and sort_order only', pe.length === 1 && pe[0].method === 'PATCH' && pe[0].query.startsWith('?id=eq.RL0002') && keysOf(pe[0].body) === 'notes,sort_order' && pe[0].body.sort_order === 5, pe.map(c => [c.query, c.body]));
      const m2 = w.calls.length;
      await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0003'), 'Classics'));
      await page.evaluate(() => document.getElementById('rlRemove').click()); await yes(page); await saved(page, 800);
      const pd = writesSince(w, m2);
      check('list remove: DELETE by id, row gone', pd.length === 1 && pd[0].method === 'DELETE' && pd[0].query.startsWith('?id=eq.RL0003') && !w.db.reading_lists.some(x => x.id === 'RL0003'), pd.map(c => [c.method, c.query]));
    });

    await step('settings', async () => {
      const n = w.calls.length, row = w.db.settings.find(r => r.key === 'yearBookGoal');
      await page.evaluate(() => { showTab('dashboard'); }); await fill(page, '#%', { goalIn: '52' });
      await page.evaluate(() => document.getElementById('goalSave').click()); await saved(page, 800);
      const pu = writesSince(w, n);
      check('setting update: PATCH the key\'s row, value only', pu.length === 1 && pu[0].method === 'PATCH' && pu[0].query === `?row_id=eq.${row.row_id}` && JSON.stringify(pu[0].body) === '{"value":"52"}', pu.map(c => [c.method, c.query, c.body]));
      const m = w.calls.length;
      await page.evaluate(() => saveSetting('someNewKey', '7')); await saved(page, 500);
      const pi = writesSince(w, m);
      check('setting insert: POST key and value', pi.length === 1 && pi[0].method === 'POST' && pi[0].table === 'settings' && JSON.stringify(pi[0].body) === '{"key":"someNewKey","value":"7"}', pi.map(c => [c.method, c.body]));
    });

    await step('rating, contents, quote', async () => {
      const n = w.calls.length;
      await page.evaluate(async () => { showTab('tools'); const b = state.allBooks.find(x => x.id === '37'); Object.assign(rate, { bookId: b.id, cat: 'Fiction', gut: 4, scores: { prose: 4 }, standout: 'the ending', flaw: 'slow middle' }); await saveRating(b, 4.5, 4); });
      await saved(page);
      const ws = writesSince(w, n), pr = ws.find(c => c.table === 'ratings'), pb = ws.find(c => c.table === 'books');
      check('rating: Books rating patched', !!pb && pb.method === 'PATCH' && /id=eq\.37$/.test(pb.query) && JSON.stringify(pb.body) === '{"rating":4.5}', pb && pb.body);
      check('rating: Ratings row inserted, typed', !!pr && pr.body.date === TODAY && pr.body.book_id === 37 && pr.body.title === 'Harbour Lights' && pr.body.category === 'Fiction' && pr.body.gut === 4 && pr.body.standout === 'the ending' && pr.body.fatal_flaw === 'slow middle' && pr.body.suggested === 4 && pr.body.final === 4.5, pr && pr.body);
      const m = w.calls.length;
      await page.evaluate(() => openContents(state.allBooks.find(x => x.id === '57')));
      await fill(page, '#%', { ctText: 'First Story 1\nSecond Story 40\nThird Story 90' });
      await page.evaluate(() => document.getElementById('ctSave').click()); await saved(page);
      const pc = writesSince(w, m).find(c => c.table === 'contents');
      check('contents: three rows, book 57, same saved_at, start pages numeric', !!pc && pc.body.length === 3 && pc.body.every(r => r.book_id === 57 && r.saved_at === pc.body[0].saved_at && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(r.saved_at)) && pc.body.map(r => r.start_page).join() === '1,40,90' && pc.body[1].story === 'Second Story', pc && pc.body);
      const m2 = w.calls.length;
      await page.evaluate(() => openQuoteDlg(state.allBooks.find(x => x.id === '1')));
      await fill(page, '#%', { qdText: 'A quoted line.', qdWho: 'Narrator', qdPage: '77' });
      await submit(page, '#quoteForm'); await saved(page, 800);
      const pq = writesSince(w, m2).find(c => c.table === 'quotes');
      check('quote: inserted with from_title, character, author, book_id, page, added', !!pq && pq.body.quote === 'A quoted line.' && pq.body.from_title === 'The Long Tide' && pq.body.character === 'Narrator' && pq.body.author === 'Ada Marlowe' && pq.body.book_id === 1 && pq.body.page === 77 && pq.body.added === TODAY, pq && pq.body);
      check('quote: shows in the page without a sheet', await page.evaluate(() => disc.quotes.some(q => q.text === 'A quoted line.')));
    });

    await step('log entry edit and delete', async () => {
      const btn = 'document.createElement("button")';
      const n = w.calls.length;
      const stale = await page.evaluate(lp => !!state.entries.find(x => x.bookId === '1' && x.pages === lp), loggedPages);
      check('log delete: the entry is in the log', stale);
      // edit: date and pages
      await page.evaluate(async lp => { const e = state.entries.find(x => x.bookId === '1' && x.pages === lp); await editEntry(e, { date: '2026-10-30', pages: 44 }, document.createElement('button')); }, loggedPages);
      const ws = writesSince(w, n), gets = w.calls.slice(n).filter(c => c.method === 'GET' && c.table === 'reading_log');
      const lr = w.db.reading_log.filter(r => r.book_id === 1 && r.page_reached === 150).pop();
      check('log edit: re-reads the row by row_id, then PATCHes date and pages', gets.length >= 1 && /^\?row_id=eq\.\d+&select=\*$/.test(gets[0].query) && ws.length === 1 && ws[0].method === 'PATCH' && ws[0].query === `?row_id=eq.${lr.row_id}` && JSON.stringify(ws[0].body) === '{"date":"2026-10-30","pages":44}', [gets.map(c => c.query), ws.map(c => [c.query, c.body])]);
      // delete: soft
      const m = w.calls.length, count = w.db.reading_log.length;
      await page.evaluate(async () => { const e = state.entries.find(x => x.bookId === '1' && x.pages === 44); await editEntry(e, { del: true }, document.createElement('button')); });
      const wd = writesSince(w, m);
      check('log delete: soft delete (pages 0, source deleted); row stays', wd.some(c => c.table === 'reading_log' && c.method === 'PATCH' && JSON.stringify(c.body) === '{"pages":0,"source":"deleted"}') && !wd.some(c => c.method === 'DELETE') && w.db.reading_log.length === count && lr.pages === 0 && lr.source === 'deleted', wd.map(c => [c.method, c.table, c.body]));
      check('log delete: the book\'s page rolled back (150 - 44)', wd.some(c => c.table === 'books' && c.method === 'PATCH' && c.body.current_page === 106), wd.map(c => [c.table, c.body]));
      // stale: changed elsewhere
      const e2 = await page.evaluate(async () => { const e = state.entries.find(x => x.pages > 0 && x.bookId === '5'); return e && { row: e._row, pages: e.pages }; });
      const r5 = w.db.reading_log.filter(r => r.book_id === 5).pop(); r5.pages = r5.pages + 1;
      const m2 = w.calls.length;
      await page.evaluate(async () => { const e = state.entries.filter(x => x.bookId === '5').pop(); await editEntry(e, { del: true }, document.createElement('button')); });
      check('log edit: a row changed elsewhere writes nothing and says so', !writesSince(w, m2).some(c => c.table === 'reading_log') && /changed in the sheet/.test(await page.locator('#notice').innerText()), writesSince(w, m2).map(c => c.table));
    });
    check('main: no write sent user_id or row_id', w.calls.filter(c => c.method !== 'GET' && c.body).every(c => [].concat(c.body).every(b => !('user_id' in b) && !('row_id' in b))));
  } });

  // ===== prune =====
  await scenario(browser, 'prune', { init: SB_CFG, setup: w => { w.insert('series_tracker', { series: 'Ghost Series', author: 'Gus Ghost', kind: 'Novel', status: 'Ongoing' }); w.insert('series_tracker', { series: 'Phantom Run', kind: 'Comic', status: 'Following' }); }, run: async (page, w) => {
    await live(page);
    await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); document.querySelector('[data-wv="series"]').click(); });
    await saved(page, 1200);
    const ds = w.calls.filter(c => c.method === 'DELETE' && c.table === 'series_tracker');
    check('prune: tracked series with no books are deleted, others kept', ds.length === 2 && ['Ghost Series', 'Phantom Run'].every(s => !w.db.series_tracker.some(r => r.series === s)) && w.db.series_tracker.some(r => r.series === 'Spawn'), [ds.map(c => c.query), w.db.series_tracker.map(r => r.series)]);
    check('prune: tells the user', /Removed 2 empty series/.test(await page.locator('#notice').innerText()), await page.locator('#notice').innerText());
  } });

  // ===== tokens =====
  await scenario(browser, 'expired', { init: SB_CFG, session: 'expired', run: async (page, w) => {
    await live(page);
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('jcm-sb-session')));
    check('expired token: exactly one refresh, then success', w.refreshes === 1 && w.forced401 === 0, [w.refreshes, w.forced401]);
    check('expired token: new token stored and every data call used it', s.at === FRESH && s.rt === 'rt2' && w.calls.length > 0 && w.calls.every(c => c.headers.authorization === 'Bearer ' + FRESH), s);
  } });
  await scenario(browser, 'server-401', { init: SB_CFG, session: 'stale401', run: async (page, w) => {
    await live(page);
    check('401 from the server: one forced refresh, retried and loaded', w.refreshes === 1 && w.forced401 >= 1 && (await page.evaluate(() => state.allBooks.length)) === 16 && w.calls.some(c => c.headers.authorization === 'Bearer ' + FRESH), [w.refreshes, w.forced401]);
  } });
  await scenario(browser, 'refresh-400', { init: SB_CFG, session: 'expired', setup: w => { w.refreshFail = 400; }, run: async (page, w) => {
    await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error', null, { timeout: 8000 });
    check('refresh 400: signed-out prompt (notice, Connect button, status)', /sign-in has expired/.test(await page.locator('#notice').innerText()) && (await page.locator('#refreshBtn').innerText()) === 'Connect' && (await page.locator('#statusText').innerText()) === 'Signed out of Supabase', await page.locator('#notice').innerText());
    check('refresh 400: stored session cleared, no data calls', !(await page.evaluate(() => localStorage.getItem('jcm-sb-session'))) && w.calls.length === 0 && w.refreshes === 1);
    await page.click('#refreshBtn'); await page.waitForSelector('#dataDlg[open]');
    check('refresh 400: Connect opens the sign-in dialog', /Sign in to Supabase below/.test(await page.locator('#dataMsg').innerText()) && await page.locator('#sbPw').isVisible());
  } });
  await scenario(browser, 'concurrent-refresh', { init: SB_CFG, run: async (page, w) => {
    await live(page); w.refreshes = 0; w.refreshDelay = 300;
    const r = await page.evaluate(() => Promise.all([sb.token(true), sb.token(true)]));
    check('two concurrent token(true) calls make exactly one refresh request', w.refreshes === 1 && r[0] === FRESH && r[1] === FRESH, [w.refreshes, r]);
  } });

  // ===== sign-in dialog =====
  await scenario(browser, 'password', { init: SB_CFG, session: null, run: async (page, w) => {
    await page.waitForSelector('#dataDlg[open]');
    check('signed out at start: dialog opens with "Sign in to Supabase below."', (await page.locator('#dataMsg').innerText()) === 'Sign in to Supabase below.' && (await page.locator('#refreshBtn').innerText()) === 'Connect' && w.calls.length === 0);
    check('signed out: sign-in rows shown, set-password and sign-out hidden', await page.locator('#sbPw').isVisible() && await page.locator('#sbEmail').isVisible() && !(await page.locator('#sbNewPw').isVisible()) && !(await page.locator('#sbOut').isVisible()));
    check('dialog: has the empty #sbTools slot', await page.evaluate(() => { const t = document.getElementById('sbTools'); return !!t && t.children.length === 0; }));
    await page.click('#sbPwIn'); check('password: asks for the email first', (await page.locator('#sbMsg').innerText()).includes('Type your email'));
    await page.fill('#sbEmail', 'me@example.com'); await page.click('#sbPwIn'); check('password: then the password', (await page.locator('#sbMsg').innerText()).includes('Type your password'));
    await page.fill('#sbPw', 'nope'); await page.click('#sbPwIn'); await page.waitForFunction(() => document.getElementById('sbMsg').textContent.includes('Couldn'));
    check('password: wrong password explained, still signed out', (await page.locator('#sbMsg').innerText()).includes("didn't match") && !(await page.evaluate(() => localStorage.getItem('jcm-sb-session'))));
    await page.fill('#sbPw', 'correct horse battery staple'); await page.click('#sbPwIn');
    await page.waitForFunction(() => !!localStorage.getItem('jcm-sb-session'), null, { timeout: 5000 });
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('jcm-sb-session')));
    check('password sign-in stores jcm-sb-session (token, refresh token, email, expiry)', s.at === GOOD && s.rt === 'rtP' && s.email === 'me@example.com' && s.exp > 0, s);
    check('password: the password is not kept in the browser', !(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes('correct horse') && (await page.inputValue('#sbPw')) === '');
    await live(page);
    check('password: data then loads from Supabase', (await page.evaluate(() => state.allBooks.length)) === 16 && (await page.locator('#refreshBtn').innerText()) === 'Refresh');
    check('password: signed-in line, set-password and sign-out shown', (await page.locator('#sbState').innerText()).includes('signed in as me@example.com') && await page.locator('#sbNewPw').isVisible() && await page.locator('#sbOut').isVisible() && !(await page.locator('#sbPw').isVisible()));
    await page.fill('#sbNewPw', 'short'); await page.click('#sbSetPw');
    check('set password: under 12 characters refused locally', (await page.locator('#sbMsg').innerText()).includes('at least 12') && !w.pwSet);
    await page.fill('#sbNewPw', 'four random words here'); await page.press('#sbNewPw', 'Enter');
    await page.waitForFunction(() => document.getElementById('sbMsg').textContent.includes('Password set'));
    check('set password: PUT with the session token; Enter did not close the dialog', !!w.pwSet && w.pwSet.auth === 'Bearer ' + GOOD && w.pwSet.body.password === 'four random words here' && await page.isVisible('#dataDlg[open]'), w.pwSet);
    await page.click('#sbOut'); await page.waitForFunction(() => !localStorage.getItem('jcm-sb-session') && document.getElementById('statusText').textContent === 'Signed out of Supabase', null, { timeout: 5000 }); await page.waitForTimeout(200);
    check('sign out: calls logout, clears the session, shows the signed-out prompt', w.logouts === 1 && (await page.locator('#refreshBtn').innerText()) === 'Connect' && (await page.locator('#statusText').innerText()) === 'Signed out of Supabase' && w.rt.socks.length === 0 && await page.locator('#sbPw').isVisible());
    check('sign out: the dialog says it signs out every jcm-book-library app', /every jcm-book-library app on this device/.test(await page.evaluate(() => document.getElementById('dataDlg').textContent)));
    await page.fill('#sbEmail', 'me@example.com'); await page.click('#sbMail');
    await page.waitForFunction(() => document.getElementById('sbMsg').textContent.includes('Check your email'));
    const o = w.otp[0], ou = o && new URL(o.url);
    check('email link: one request, create_user false, redirect to this page', w.otp.length === 1 && o.body.email === 'me@example.com' && o.body.create_user === false && ou.searchParams.get('redirect_to') === ORIGIN + '/', o);
  } });
  await scenario(browser, 'redirect', { init: SB_CFG, session: null, url: ORIGIN + `/#access_token=${GOOD}&refresh_token=rtX&expires_in=3600&token_type=bearer`, run: async (page, w) => {
    await live(page);
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('jcm-sb-session')));
    check('email link return: session saved, hash removed, data loads', s.at === GOOD && s.rt === 'rtX' && s.email === 'me@example.com' && !(await page.evaluate(() => location.hash)) && (await page.evaluate(() => state.allBooks.length)) === 16, s);
  } });

  // ===== switching with Save & connect =====
  await scenario(browser, 'save-connect', { init: { mbl_config: { backend: 'sheets', clientId: 'abc.apps.googleusercontent.com' } }, run: async (page, w) => {
    await page.waitForSelector('#notice:not([hidden])');
    check('sheet mode on the live site: Google flow untouched (Connect prompt), no Supabase calls', /Google/.test(await page.locator('#notice').innerText()) && w.calls.length === 0 && (await page.locator('#refreshBtn').innerText()) === 'Connect');
    await page.click('#toolboxBtn'); await page.click('#dataBtn'); await page.waitForSelector('#dataDlg[open]');
    check('Toolbox: "Data & sign-in" opens the dialog on the current setting', (await page.inputValue('#dSource')) === 'sheets');
    await page.selectOption('#dSource', 'supabase'); await page.click('#dataSave');
    await live(page);
    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('mbl_config')));
    check('Save & connect to Supabase: backend saved (client id kept), data loaded from Supabase', cfg.backend === 'supabase' && cfg.clientId === 'abc.apps.googleusercontent.com' && w.calls.length > 0 && !(await page.isVisible('#dataDlg[open]')), cfg);
    await page.click('#toolboxBtn'); await page.click('#dataBtn'); await page.waitForSelector('#dataDlg[open]');
    await page.selectOption('#dSource', 'sheets'); await page.click('#dataSave');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('mbl_config')).backend === 'sheets' && /Not connected|Signed out/.test(document.getElementById('statusText').textContent), null, { timeout: 5000 });
    const n = w.calls.length; await page.waitForTimeout(300);
    check('Save & connect back to the Sheet: backend saved, live sync stopped, no more Supabase calls', w.rt.socks.length === 0 && !(await page.$('#status .dot[data-sync]')) && w.calls.length === n && (await page.evaluate(() => DB() === sheetDb)));
  } });
  await scenario(browser, 'save-connect-signed-out', { init: { mbl_config: { backend: 'sheets', clientId: 'abc.apps.googleusercontent.com' } }, session: null, run: async (page, w) => {
    await page.waitForSelector('#notice:not([hidden])'); await page.click('#toolboxBtn'); await page.click('#dataBtn');
    await page.selectOption('#dSource', 'supabase'); await page.click('#dataSave');
    check('Save & connect to Supabase while signed out: asks to sign in first, nothing saved', /Sign in to Supabase first/.test(await page.locator('#dataMsg').innerText()) && (await page.evaluate(() => JSON.parse(localStorage.getItem('mbl_config')).backend)) === 'sheets');
  } });

  // ===== stale sign-in guard =====
  await scenario(browser, 'zero-books', { init: SB_CFG, world: { empty: true }, run: async (page, w) => {
    await page.waitForFunction(() => /^Supabase ·/.test(document.getElementById('statusText').textContent), null, { timeout: 8000 });
    check('0 books: the stale sign-in notice', (await page.locator('#notice').innerText()) === "Supabase returned no books. If you've copied your Sheet already, sign out of Supabase and sign in again.", await page.locator('#notice').innerText());
  } });

  // ===== realtime =====
  await scenario(browser, 'realtime', { init: SB_CFG, run: async (page, w) => {
    await live(page); await page.waitForFunction(() => document.querySelector('#status .dot[data-sync]'), null, { timeout: 5000 });
    w.insert('books', { id: 200, title: 'From My Phone', author: 'Pat Phone', status: 'TBR' });
    const g0 = w.calls.filter(c => c.method === 'GET' && c.table === 'books').length;
    w.rt.push({ table: 'books', type: 'INSERT', schema: 'books' });
    await page.waitForFunction(() => state.allBooks.some(b => b.title === 'From My Phone'), null, { timeout: 6000 }).catch(() => {});
    check('realtime: a postgres_changes message reloads and shows the other device\'s book', await page.evaluate(() => state.allBooks.some(b => b.title === 'From My Phone')) && w.calls.filter(c => c.method === 'GET' && c.table === 'books').length > g0);
    await page.evaluate(() => saveSetting('someKey', '1')); await saved(page, 300);
    const g1 = w.calls.filter(c => c.method === 'GET').length;
    w.rt.push({ table: 'settings', type: 'INSERT' }); await page.waitForTimeout(1500);
    check('realtime: the echo of our own save is ignored', w.calls.filter(c => c.method === 'GET').length === g1);
  } });

  // ===== layout at 390px =====
  for (const [label, session] of [['signed-in', 'live'], ['signed-out', null]]) {
    await scenario(browser, 'layout-390-' + label, { init: SB_CFG, session, vp: { width: 390, height: 800 }, run: async (page, w) => {
      if (session) await live(page); else await page.waitForSelector('#dataDlg[open]');
      if (session) { await page.click('#toolboxBtn'); await page.click('#dataBtn'); await page.waitForSelector('#dataDlg[open]'); }
      await page.fill('#sbEmail', 'a.very.long.email.address.for.testing@example.com').catch(() => {});
      await page.evaluate(() => { document.getElementById('sbMsg').textContent = 'Check your email and click the sign-in link. Open it on this device, in this browser: it brings you back here signed in.'; });
      const m = await page.evaluate(() => { const d = document.getElementById('dataDlg'), r = d.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, dsw: d.scrollWidth, dcw: d.clientWidth, l: r.left, r: r.right }; });
      check(`390px ${label}: no sideways scroll with the dialog open`, m.sw <= m.iw && m.dsw <= m.dcw && m.l >= 0 && m.r <= m.iw, m);
      await page.screenshot({ path: path.join(OUT, `dialog-390-${label}.png`) });
    } });
  }

  // ===== claude.ai artifact: read-only =====
  await scenario(browser, 'artifact', { init: {}, session: null, claude: true, run: async (page, w) => {
    // window.claude is stubbed and window.__TEST_WRITES__ is not set, so this is the read-only claude.ai copy
    await page.waitForFunction(() => state.live && state.libLoaded, null, { timeout: 10000 });
    check('artifact: reads still work', (await page.evaluate(() => state.allBooks.length)) === 16);
    check('artifact: persistent read-only notice after load', (await page.locator('#notice').innerText()) === 'This copy is read-only. Use the live site: https://jcm-book-library.github.io/my-book-library/');
    const res = await page.evaluate(async () => {
      const calls = { bookUpdate: ['1', { notes: 'x' }], bookPage: ['1', 200], bookAdd: [{ title: 't' }], booksAddMany: [[{ title: 't' }]], logAdd: [[]], logEdit: [{ _row: 2 }, { del: true }], ratingAdd: [[]], contentsAdd: ['1', [], 's'], quoteAdd: [[]],
        settingSave: ['k', 'v'], wishUpdate: ['WL0001', {}], wishClear: ['WL0001'], wishAdd: [[{ title: 't' }]], archiveAdd: [[]], seriesSave: [{ series: 's' }, 's'], seriesClear: ['s'], listUpdate: ['RL0001', {}], listAdd: [{}], listClear: ['RL0001'] };
      const out = {};
      for (const [k, a] of Object.entries(calls)) out[k] = await DB()[k](...a).then(() => 'wrote', e => e && e.code + '|' + e.message);
      return out;
    });
    const MSG = 'tool_error|This copy is read-only. Use the live site: https://jcm-book-library.github.io/my-book-library/';
    check('artifact: every write method throws the read-only error', Object.values(res).every(v => v === MSG) && Object.keys(res).length === 19, res);
    check('artifact: no write reached the sheet', w.writes.length === 0, w.writes.length);
    const logged = await page.evaluate(async () => { const b = document.createElement('button'); return logEntry({ pages: 5, bookId: '1', title: 'x', pageReached: 125 }, b); });
    check('artifact: logging pages shows the read-only message and writes nothing', logged !== true && w.writes.length === 0 && /read-only/.test(await page.locator('#notice').innerText()));
    check('artifact: no Data & sign-in item', await page.evaluate(() => document.getElementById('dataPg').hidden));
  } });

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  fs.writeFileSync(path.join(OUT, 'result.txt'), log.join('\n'));
  console.log(log.join('\n'));
  const pass = log.filter(l => l.startsWith('PASS')).length, fail = log.filter(l => l.startsWith('FAIL')).length;
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
