// Shared fakes for the headless tests: a fake Supabase (auth, PostgREST tables per schema, Realtime) and a fake Google Sheets API.
// Nothing here touches a real Google or Supabase server. Used by tests/supabase.js and tests/copyback.js.
const SBU = 'https://apeflgdzclpxiktaxyfk.supabase.co';

// ---- the converters and the table map come straight from app.html, so seeds use the app's own types ----
function appFns(APP) {
  const src = APP.slice(APP.indexOf('const sbCols ='), APP.indexOf('/* ---------- sbDb:'));
  return new Function(src + '; return { SBT, sbToCell, cellToSb };')();
}
const RT_TABLE = { 'Books': 'books', 'Reading Log': 'reading_log', 'App Settings': 'settings', 'Ratings': 'ratings', 'Contents': 'contents', 'Wishlist': 'wishlist',
  'Series Tracker': 'series_tracker', 'Reading Lists': 'reading_lists', 'Wishlist archive': 'wishlist_archive', 'Quotes': 'quotes' };
const UNIQUE = { books: ['id'], wishlist: ['id'], series_tracker: ['series'], reading_lists: ['id'], settings: ['key'], wishlist_archive: ['id'] };
const DEFAULTS = { books: { favourite: false, loaned: false }, wishlist: { gift: false } };

const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (email = 'me@example.com') => 'x.' + b64u({ email, sub: 'u1' }) + '.y';
const GOOD = jwt(), EXPIRED = 'EXPIRED_TOKEN', FRESH = jwt() + 'f';

// ---- fake Supabase ----
// A fresh in-memory database (one array per table) plus the counters the routes use.
function sbWorld() {
  const w = { db: {}, calls: [], nextId: 1, refreshes: 0, logouts: 0, forced401: 0, otp: [], pwTries: [], pwSet: null, refreshFail: 0, race: 0, rt: null };
  Object.values(RT_TABLE).forEach(t => { w.db[t] = []; });
  w.insert = (t, o) => { const row = { row_id: w.nextId++, user_id: 'u1', ...(DEFAULTS[t] || {}), ...o }; w.db[t].push(row); return row; };
  return w;
}
const FILTER_SKIP = new Set(['select', 'order', 'limit', 'offset']);
function applyFilters(rows, q) {
  for (const [k, v] of q.entries()) {
    if (FILTER_SKIP.has(k)) continue;
    const dot = v.indexOf('.'), op = v.slice(0, dot), val = v.slice(dot + 1);
    rows = rows.filter(r => {
      const x = r[k]; if (x == null) return false;
      const a = typeof x === 'number' ? x : String(x), b = typeof x === 'number' ? Number(val) : val;
      return op === 'eq' ? a === b : op === 'gt' ? a > b : op === 'lt' ? a < b : op === 'gte' ? a >= b : op === 'lte' ? a <= b : true;
    });
  }
  return rows;
}
function applyOrder(rows, q) {
  const o = q.get('order'); if (!o) return rows;
  const keys = o.split(',').map(s => { const [c, d] = s.split('.'); return [c, d === 'desc' ? -1 : 1]; });
  return [...rows].sort((a, b) => { for (const [c, d] of keys) { if (a[c] < b[c]) return -d; if (a[c] > b[c]) return d; } return 0; });
}

// Realtime: accept the join, record what the page sends, and let a test push a change
async function routeRealtime(page, w) {
  w.rt = { socks: [], joins: [], tokens: [], push(rec) { this.socks.forEach(ws => ws.send(JSON.stringify({ topic: 'realtime:books', event: 'postgres_changes', payload: { data: rec }, ref: null }))); } };
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, ws => {
    w.rt.socks.push(ws); w.rt.url = ws.url();
    ws.onMessage(m => { let o; try { o = JSON.parse(m); } catch (e) { return; }
      if (o.event === 'phx_join') { w.rt.joins.push(o.payload); ws.send(JSON.stringify({ topic: o.topic, event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [] } }, ref: o.ref })); }
      else if (o.event === 'access_token') w.rt.tokens.push(o.payload.access_token);
      else if (o.event === 'heartbeat') ws.send(JSON.stringify({ topic: 'phoenix', event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: o.ref })); });
    ws.onClose(() => { w.rt.socks = w.rt.socks.filter(x => x !== ws); });
  });
}
async function sbRoute(r, w) {
  const req = r.request(), u = new URL(req.url()), method = req.method(), h = req.headers();
  const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
  const body = () => { try { return JSON.parse(req.postData()); } catch (e) { return null; } };
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
    const b = body(); w.pwTries.push(b);
    return b.password === 'correct horse battery staple' && b.email === 'me@example.com' ? json({ access_token: GOOD, refresh_token: 'rtP', expires_in: 3600, token_type: 'bearer' }) : json({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
  }
  if (u.pathname === '/auth/v1/user' && method === 'PUT') { w.pwSet = { auth: h.authorization, apikey: h.apikey, body: body() }; return json({ id: 'u1', email: 'me@example.com' }); }
  if (u.pathname === '/auth/v1/token') {
    w.refreshes++;
    if (w.refreshDelay) await new Promise(ok => setTimeout(ok, w.refreshDelay));
    if (w.refreshFail) return json({ error: 'invalid_grant', error_description: 'Invalid Refresh Token' }, w.refreshFail);
    return json({ access_token: FRESH, refresh_token: 'rt2', expires_in: 3600 });
  }
  if (u.pathname === '/auth/v1/logout') { w.logouts++; return r.fulfill({ status: 204, body: '' }); }
  if (u.pathname === '/auth/v1/otp') { w.otp.push({ url: req.url(), body: body() }); return json({}); }
  const m = u.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (!m || !w.db[m[1]]) return json({ message: 'no such table' }, 404);
  const t = m[1], q = u.searchParams;
  const call = { method, table: t, query: u.search, path: m[1] + u.search, body: body(), headers: h };
  w.calls.push(call);
  if (h.authorization === 'Bearer ' + EXPIRED) { w.forced401++; call.status = 401; return json({ message: 'JWT expired' }, 401); }
  if (h['accept-profile'] !== 'books' && h['content-profile'] !== 'books') { call.status = 406; return json({ message: 'wrong schema' }, 406); }
  const wantRep = (h.prefer || '').includes('return=representation');
  const unique = (row, skip) => (UNIQUE[t] || []).some(c => w.db[t].some(x => x !== skip && x[c] === row[c]));
  if (method === 'GET') {
    let rows = applyOrder(applyFilters(w.db[t], q), q);
    const off = Number(q.get('offset') || 0), lim = Math.min(Number(q.get('limit') || 1000), 1000);
    rows = rows.slice(off, off + lim);
    const sel = q.get('select');
    if (sel && sel !== '*') { const cols = sel.split(','); rows = rows.map(x => Object.fromEntries(cols.map(c => [c, x[c]]))); }
    call.status = 200; return json(rows);
  }
  if (method === 'POST') {
    let items = body(); items = Array.isArray(items) ? items : [items];
    if (w.race && t === 'books') { w.race--; const top = Math.max(0, ...w.db.books.map(x => x.id)); w.insert('books', { id: top + 4, title: 'Added on another device', author: 'Other Dev', status: 'TBR' }); }
    for (const it of items) if (unique(it)) { call.status = 409; return json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409); }
    const done = items.map(it => w.insert(t, it)); call.status = 201;
    return wantRep ? json(done, 201) : r.fulfill({ status: 201, body: '' });
  }
  if (method === 'PATCH') {
    const hit = applyFilters(w.db[t], q), b = body();
    for (const x of hit) { const merged = { ...x, ...b }; if (unique(merged, x)) { call.status = 409; return json({ message: 'duplicate key' }, 409); } }
    hit.forEach(x => Object.assign(x, b)); call.status = wantRep ? 200 : 204;
    return wantRep ? json(hit) : r.fulfill({ status: 204, body: '' });
  }
  if (method === 'DELETE') {
    const hit = applyFilters(w.db[t], q); w.db[t] = w.db[t].filter(x => !hit.includes(x)); call.status = wantRep ? 200 : 204;
    return wantRep ? json(hit) : r.fulfill({ status: 204, body: '' });
  }
  return json({}, 405);
}


// ---- fake Google Sheets API (spreadsheets by id, tabs with grid data), recording every call ----
const colN = s => { let n = 0; for (const c of s) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
function parseA1(r) {
  const m = String(r).match(/^(?:'((?:[^']|'')+)'|([^!']+))!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
  if (!m) return null;
  return { tab: (m[1] || m[2]).replace(/''/g, "'"), c0: colN(m[3]), r0: m[4] ? Number(m[4]) : 1, c1: m[5] ? colN(m[5]) : colN(m[3]), r1: m[6] ? Number(m[6]) : (m[4] ? Number(m[4]) : 1e9) };
}
// What USER_ENTERED does to a value, reduced to what a reader sees back: a leading ' is dropped, numbers and booleans become their text, formulas show blank
const entered = v => v == null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(v) : /^'/.test(v) ? v.slice(1) : /^=/.test(v) ? '' : v;
// sheets: { [spreadsheetId]: [{ sheetId, title, hidden, rowCount, data: [[...], ...] }] }
function makeSheetsApi(sheets) {
  const api = { sheets, calls: [], nextSid: 1000 };
  const tab = (id, t) => (sheets[id] || []).find(x => x.title === t);
  api.writes = () => api.calls.filter(c => c.method !== 'GET');
  api.route = async r => {
    const req = r.request(), u = new URL(req.url()), method = req.method();
    const m = decodeURIComponent(u.pathname).match(/^\/v4\/spreadsheets\/([^/:]+)(.*)$/);
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    if (!m || !sheets[m[1]]) return json({ error: { message: 'no such spreadsheet' } }, 404);
    const id = m[1], p = m[2], call = { id, method, p, query: u.search, body, auth: req.headers().authorization }; api.calls.push(call);
    if (req.headers().authorization !== 'Bearer x') return json({ error: { message: 'bad token' } }, 401);
    if (p === '' && method === 'GET') return json({ sheets: sheets[id].map(t => ({ properties: { sheetId: t.sheetId, title: t.title, hidden: !!t.hidden, gridProperties: { rowCount: t.rowCount } } })) });
    const put = (rg, vals) => { const a = parseA1(rg), t = a && tab(id, a.tab); if (!t) throw new Error('no tab for ' + rg);
      vals.forEach((rv, i) => { const ri = a.r0 - 1 + i; if (ri >= t.rowCount) throw new Error('beyond grid ' + rg); while (t.data.length <= ri) t.data.push([]); rv.forEach((v, j) => { const row = t.data[ri]; while (row.length <= a.c0 + j) row.push(''); row[a.c0 + j] = entered(v); }); }); };
    try {
      if (p.startsWith('/values/') && method === 'GET') {
        const a = parseA1(p.slice(8)), t = a && tab(id, a.tab); if (!t) return json({ error: { message: 'Unable to parse range: ' + p.slice(8) } }, 400);
        const rows = t.data.slice(a.r0 - 1, a.r1).map(row => { const x = row.slice(a.c0, a.c1 + 1); while (x.length && x[x.length - 1] === '') x.pop(); return x; });
        while (rows.length && !rows[rows.length - 1].length) rows.pop();
        return json({ range: p.slice(8), majorDimension: 'ROWS', values: rows });
      }
      if (p === '/values:batchUpdate' && method === 'POST') { body.data.forEach(x => put(x.range, x.values)); return json({ totalUpdatedRanges: body.data.length }); }
      if (p.startsWith('/values/') && method === 'PUT') { put(p.slice(8), body.values); return json({}); }
      if (p === ':batchUpdate' && method === 'POST') {
        const replies = [];
        for (const q of body.requests) {
          const byId = sid => sheets[id].find(x => x.sheetId === sid);
          if (q.duplicateSheet) { const src = byId(q.duplicateSheet.sourceSheetId), t = { sheetId: api.nextSid++, title: q.duplicateSheet.newSheetName, hidden: false, rowCount: src.rowCount, data: JSON.parse(JSON.stringify(src.data)) };
            if (sheets[id].some(x => x.title === t.title)) throw new Error('sheet name taken: ' + t.title);
            sheets[id].push(t); replies.push({ duplicateSheet: { properties: { sheetId: t.sheetId, title: t.title } } }); continue; }
          if (q.updateSheetProperties) Object.assign(byId(q.updateSheetProperties.properties.sheetId), { hidden: !!q.updateSheetProperties.properties.hidden });
          if (q.appendDimension) byId(q.appendDimension.sheetId).rowCount += q.appendDimension.length;
          if (q.deleteSheet) sheets[id].splice(sheets[id].indexOf(byId(q.deleteSheet.sheetId)), 1);
          if (q.deleteDimension) byId(q.deleteDimension.range.sheetId).data.splice(q.deleteDimension.range.startIndex, 1);
          replies.push({});
        }
        return json({ replies });
      }
      return json({ error: { message: 'not handled: ' + method + ' ' + p } }, 404);
    } catch (e) { return json({ error: { message: String(e.message) } }, 400); }
  };
  return api;
}

module.exports = { SBU, appFns, RT_TABLE, UNIQUE, DEFAULTS, jwt, GOOD, EXPIRED, FRESH, sbWorld, sbRoute, routeRealtime, applyFilters, applyOrder, makeSheetsApi, parseA1, entered };
