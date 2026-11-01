// Write-flow recorder. Each flow drives the app against a stateful fake sheet and saves the exact
// sequence of non-read callTool calls to <outDir>/<flow>.json (plus the touched tabs afterwards in
// <flow>.sheets.json). Usage: node tests/flows.js <app.html> <outDir>
const fs = require('fs'), path = require('path');
const { launch, openApp, settle } = require('./lib.js');
const [, , appFile, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

const flows = {};
const flow = (name, fn, opts) => { flows[name] = { fn, opts }; };

// Set form fields by element id/name and fire input events
const fill = (page, sel, vals) => page.evaluate(([sel, vals]) => {
  for (const [k, v] of Object.entries(vals)) {
    const el = document.querySelector(sel.replace('%', k)); if (!el) throw new Error('no field ' + sel.replace('%', k));
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, [sel, vals]);
const submit = (page, formSel) => page.evaluate(s => document.querySelector(s).requestSubmit(), formSel);
const yes = async page => { await page.waitForSelector('#askDlg[open]', { timeout: 5000 }); await page.evaluate(() => document.getElementById('askYes').click()); };

// (a) add a book through the add dialog (plain TBR, and one that is being read so pages are logged)
flow('a-add-book', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); openBookDialog(null); });
  await fill(page, '#bookForm [name="%"]', { title: 'Brand New Book', author: 'Nia New', status: 'TBR', pages: '300', genre: 'Mystery', type: 'Novel', copies: 'Kobo', notes: 'added in test' });
  await submit(page, '#bookForm');
  await settle(page);
});
flow('a2-add-reading-book', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); openBookDialog(null); });
  await fill(page, '#bookForm [name="%"]', { title: 'Reading Right Away', author: 'Rhea Read', status: 'Reading', pages: '200', currentPage: '40', startDate: '2026-10-31' });
  await submit(page, '#bookForm');
  await settle(page);
});
// (b) status to Reading from the book card: clears tier and upNextOrder, then Up next is renumbered
flow('b-status-reading', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); showCard('9'); });
  await page.selectOption('#bookCard select', 'Reading');
  await settle(page, 800);
});
// (c) edit fields in the edit dialog and save (including a plan change that sets triaged/upNextOrder)
flow('c-edit-book', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); openBookDialog(state.allBooks.find(x => x.id === '21')); });
  await fill(page, '#bookForm [name="%"]', { title: 'Salt Road (2nd ed)', genre: 'Adventure', rating: '4', pages: '275', tier: 'Up next', notes: 'edited in test', series: 'Roads', seriesNum: '1.5' });
  await submit(page, '#bookForm');
  await settle(page, 800);
});
// (d) toggle favourite on and off
flow('d-favourite', async ({ page }) => {
  await page.evaluate(async () => { showTab('library'); await toggleFav('1'); await toggleFav('29'); });
  await settle(page);
});
// (e) log pages for a reading book (card input) and quick log without a book
flow('e-log-pages', async ({ page }) => {
  await page.evaluate(() => {
    const i = document.querySelector('input[aria-describedby="meta-1"]');
    i.value = '150'; i.dispatchEvent(new Event('input', { bubbles: true }));
    i.closest('.nb-log').querySelector('.btn-primary').click();
  });
  await settle(page, 800);
  await fill(page, '#%', { quickPages: '12' });
  await page.evaluate(() => document.getElementById('quickBtn').click());
  await settle(page, 800);
});
// (f) edit then delete a Reading Log entry (delete rolls the book's current page back)
flow('f-log-edit-delete', async ({ page }) => {
  const open = last => page.evaluate(last => {
    let el = document.querySelector('input[aria-describedby="meta-1"]');
    while (el && !el.querySelector('.recent')) el = el.parentElement;
    const b = el.querySelectorAll('.recent button'); b[last ? b.length - 1 : 0].click();
  }, last);
  const editor = act => page.evaluate(a => {
    const ed = document.querySelector('.today-list .edit');
    if (a === 'save') { const [d, p] = ed.querySelectorAll('input'); p.value = '44'; d.value = '2026-10-28'; }
    ed.querySelector(`[data-a="${a}"]`).click();
  }, act);
  await open(true); await editor('save'); await settle(page, 800);
  await open(false); await editor('del'); await yes(page); await settle(page, 800);
});
// (g) Wishlist adds: quick add, add dialog, paste list
flow('g-wish-add', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); });
  await fill(page, '#%', { wlQuick: 'Quick Title by Quinn Quick' });
  await page.evaluate(() => document.getElementById('wlQuickBtn').click());
  await settle(page, 800);
  await page.evaluate(() => openWishDlg(null));
  await fill(page, '#wd-%', { title: 'Dialog Title', author: 'Dee Dialog', series: 'Dialogs', number: '2', type: 'Comic', format: 'Issues', stage: 'To buy', price: '9.5', release: '2026-12-25', notes: 'n' });
  await page.evaluate(() => { document.getElementById('wd-gift').checked = true; });
  await submit(page, '#wishDlg form');
  await settle(page, 800);
  // the Wishlist "Paste a list" button opens the quick add dialog on its paste tab, destination Wishlist
  await page.evaluate(() => document.getElementById('wlPasteBtn').click());
  await fill(page, '#%', { pasteTa: '1. Paste One by Pat A\nPaste Two – Pat B\nPaste Three', pSeen: 'Test list' });
  await page.click('#pAll');
  await settle(page, 800);
});
// (h) "Got it": one new title and one already in Books (link only); plus a second move after the first
flow('h-wish-got-it', async ({ page }) => {
  await page.evaluate(async () => {
    showTab('library');
    await moveWishToBooks([disc.wish.find(w => w.id === 'WL0003'), disc.wish.find(w => w.id === 'WL0010')]);
    await moveWishToBooks([disc.wish.find(w => w.id === 'WL0006')]);
  });
  await settle(page, 800);
});
// (i) clear a Wishlist row (Drop), one before the blank middle row and one after
flow('i-wish-clear', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); });
  await page.evaluate(() => { dropWish(disc.wish.find(w => w.id === 'WL0007')); });
  await yes(page); await settle(page, 600);
  await page.evaluate(() => { dropWish(disc.wish.find(w => w.id === 'WL0002')); });
  await yes(page); await settle(page, 600);
  // then a field edit on a row below the cleared ones
  await page.evaluate(() => setWishFields(disc.wish.find(w => w.id === 'WL0005'), { checked: 'Available', checkedOn: '2026-10-31', wantAs: 'PDF' }));
  await settle(page, 600);
});
// (j) add a series (goes below the last used row) and edit an existing one
flow('j-series-add-edit', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); document.querySelector('[data-wv="series"]').click(); openSeriesDlg(null); });
  await fill(page, '#sd-%', { series: 'Akira', author: 'Sam Series', publisher: 'Pub', kind: 'Comic', status: 'Following', soldAs: 'Issues', notes: 'fresh' });
  await submit(page, '#seriesDlg form'); await settle(page, 800);
  await page.evaluate(() => openSeriesDlg(disc.series.find(s => s.series === 'Spawn')));
  await fill(page, '#sd-%', { status: 'Ongoing', notes: 'edited note', link: 'https://example.com/spawn' });
  await submit(page, '#seriesDlg form'); await settle(page, 800);
  await page.evaluate(() => openSeriesDlg(disc.series.find(s => s.series === 'Moon Knight')));
  await fill(page, '#sd-%', { series: 'Stardust' });
  await submit(page, '#seriesDlg form'); await settle(page, 800);
});
// (k) prune: a tracked series with no books is cleared from the Series Tracker
flow('k-series-prune', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); document.querySelector('[data-wv="series"]').click(); });
  await settle(page, 1000);
}, { mutate: s => { s['Series Tracker'].push(['Ghost Series', 'Gus Ghost', '', 'Novel', 'Ongoing', '', '', '', ''], ['Phantom Run', '', '', 'Comic', 'Following', '', '', '', '']); } });
// (l) Reading List: add (below the blank middle row), edit, remove
flow('l-list-add-remove', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="lists"]').click(); openListDlg(null, 'Classics'); });
  await fill(page, '#rl-%', { title: 'Added Classic', author: 'Cass Sic', notes: 'n1' });
  await submit(page, '#listForm'); await settle(page, 800);
  await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0002'), 'Summer Sci-Fi'));
  await fill(page, '#rl-%', { notes: 'edited', order: '5' });
  await submit(page, '#listForm'); await settle(page, 800);
  await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0003'), 'Classics'));
  await page.evaluate(() => document.getElementById('rlRemove').click());
  await yes(page); await settle(page, 800);
});
// (m) save a rating (book row + Ratings append)
flow('m-rating', async ({ page }) => {
  await page.evaluate(async () => {
    showTab('tools');
    const b = state.allBooks.find(x => x.id === '37');
    Object.assign(rate, { bookId: b.id, cat: 'Fiction', gut: 4, scores: { prose: 4 }, standout: 'the ending', flaw: 'slow middle' });
    await saveRating(b, 4.5, 4);
  });
  await settle(page);
});
// (n) save a contents table
flow('n-contents', async ({ page }) => {
  await page.evaluate(() => openContents(state.allBooks.find(x => x.id === '57')));
  await fill(page, '#%', { ctText: 'First Story 1\nSecond Story 40\nThird Story 90' });
  await page.evaluate(() => document.getElementById('ctSave').click());
  await settle(page);
});
// (o) add a quote
flow('o-quote', async ({ page }) => {
  await page.evaluate(() => openQuoteDlg(state.allBooks.find(x => x.id === '1')));
  await fill(page, '#%', { qdText: 'A quoted line.', qdWho: 'Narrator', qdPage: '77' });
  await submit(page, '#quoteForm');
  await settle(page, 800);
});
// (p) App Settings: existing key (update) and a missing key (append)
flow('p-setting', async ({ page }) => {
  await page.evaluate(() => { showTab('dashboard'); });
  await fill(page, '#%', { goalIn: '52' });
  await page.evaluate(() => document.getElementById('goalSave').click());
  await settle(page);
  await page.evaluate(() => saveSetting('someNewKey', '7'));
  await settle(page);
});
// (q) Up next reorder and plan changes through savePlan
flow('q-plan', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); document.querySelector('.lib-mode [data-mode="plan"]').click(); });
  await page.evaluate(() => moveUp(upNext()[0], 1));
  await settle(page, 800);
  await page.evaluate(() => setTier(state.allBooks.find(x => x.id === '17'), 'Up next'));
  await settle(page, 800);
  await page.evaluate(() => setTier(state.allBooks.find(x => x.id === '13'), 'Soon'));
  await settle(page, 800);
});

// (q) Quick add dialog (header "+ Add book"): one book, "Add and next" twice, paste to Books, paste to Wishlist with columns
flow('q1-quick-add-one', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); document.getElementById('addBookBtn').click(); });
  await page.fill('#qTitle', 'Quick Book One'); await page.fill('#qAuthor', 'Quinn Quick');
  await page.fill('#qSeries', 'Quick Saga'); await page.fill('#qNum', '1.5'); await page.fill('#qIsbn', '9780000000001');
  await page.click('#qCopies [data-v="Kobo"]'); await page.click('#qCopies [data-v="PDF"]'); await page.click('#qStatus [data-v="Finished"]');
  await page.click('#qaAdd');
  await settle(page, 800);
});
flow('q2-add-and-next', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); document.getElementById('addBookBtn').click(); });
  await page.click('#qCopies [data-v="Physical"]'); await page.click('#qStatus [data-v="Reading"]');
  await page.fill('#qTitle', 'Next Book A'); await page.fill('#qAuthor', 'Ann Next');
  await page.click('#qaNext'); await settle(page, 800);
  await page.fill('#qTitle', 'Next Book B'); await page.fill('#qSeries', 'Nexts'); await page.fill('#qNum', '2');
  await page.press('#qTitle', 'Enter'); await settle(page, 800);
});
flow('q3-paste-books', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); document.getElementById('addBookBtn').click(); });
  await page.click('#qSeg [data-q="paste"]');
  await page.fill('#pasteTa', 'Hollow Water – Idris Vane (Tidewrack #4)\nThe Winter Archive by Odile Marchetti\nLetters from Lisbon\tLucía Ferrer\tLisbon Letters\t2');
  await page.click('#pAll');
  await settle(page, 800);
});
flow('q4-paste-wish-columns', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); document.getElementById('wlPasteBtn').click(); });
  await page.fill('#pasteTa', 'Column One\tCol Author\tCol Series\t3\nColumn Two - Cy Col (Pairs, #1)');
  await page.click('#pAll');
  await settle(page, 800);
});


// (r0) Copies toggle chips in the full edit form: add Physical to a Kobo book; add Kobo to a book with unrecognised text (kept)
const setBook = (id, o) => s => { const h = s.Books[0], r = s.Books.find((x, i) => i && x[h.indexOf('id')] === id); for (const [k, v] of Object.entries(o)) r[h.indexOf(k)] = v; };
flow('r0-copies-chips', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); openBookDialog(state.allBooks.find(x => x.id === '17')); });
  await page.click('#bookForm [data-v="Physical"]');
  await submit(page, '#bookForm'); await settle(page, 800);
  await page.evaluate(() => openBookDialog(state.allBooks.find(x => x.id === '21')));
  await page.click('#bookForm [data-v="Kobo"]');
  await submit(page, '#bookForm'); await settle(page, 800);
}, { mutate: setBook('21', { copies: 'Library copy' }) });

// Fill details: stubbed Google Books and Open Library answers (the build network blocks both)
const GB = { items: [
  { volumeInfo: { title: 'Paper Towns Revisited', authors: ['Cleo Park'], publishedDate: '2018-05-01', pageCount: 312, publisher: 'GB Pub', categories: ['Fiction / Thrillers / General'],
    description: '<p>A <b>quiet</b> town &amp; its   secrets.</p><br>Second line.', industryIdentifiers: [{ type: 'ISBN_10', identifier: '1234567890' }, { type: 'ISBN_13', identifier: '9781234567897' }] } },
  { volumeInfo: { title: 'Paper Towns Revisited (Large Print)', authors: ['Cleo Park'], publishedDate: '2020', pageCount: 500, publisher: 'Big Print' } }] };
const OLS = { docs: [
  { key: '/works/OL1W', title: 'Paper Towns Revisited', author_name: ['Cleo Park'], first_publish_year: 2016, number_of_pages_median: 300, publisher: ['OL Pub', 'Other'], isbn: ['1234567890', '9781234567897'],
    subject: ['Mystery fiction', 'Small towns', 'Detective', 'Secrets', 'Friendship', 'Suspense', 'Murder', 'Fiction', 'Ninth one'] },
  { key: '/works/OL2W', title: 'Paper Towns Revisited II', author_name: ['Cleo Park'], first_publish_year: 2019 }] };
// the fake sheet's rows are shared between flows in one run, so each flow sets the fields it needs
const BLANK9 = { pages: '', synopsis: '', year: '', publisher: '', isbn: '', theme1: '', theme2: '', theme3: '' };
const stubLookups = async page => {
  await page.route('https://www.googleapis.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(GB), headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://openlibrary.org/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(/search\.json/.test(r.request().url()) ? OLS : { description: { type: '/type/text', value: 'OL description of the work.' } }) }));
};
const lookupDone = page => page.waitForFunction(() => !fd.busy && fd.gb && fd.gb.cands && fd.ol && fd.ol.cands, null, { timeout: 15000 });
const pending = page => page.evaluate(() => JSON.stringify(fdPending(state.allBooks.find(x => x.id === fd.cur))));
// (r1) blank pages / synopsis / year: the pre-ticked values save (pages, synopsis, publisher, isbn from Google Books; year from Open Library)
flow('r1-fill-preticked', async ({ page }) => {
  await stubLookups(page);
  await page.evaluate(() => { showTab('toolbox', 'fill'); });
  await page.click('.fd-row[data-id="9"]'); await lookupDone(page);
  await page.waitForFunction(() => fdSel('ol') && fdSel('ol').synopsis !== undefined);
  await page.click('#fdSave'); await settle(page, 800);
}, { mutate: setBook('9', BLANK9) });
// (r2) untick the synopsis and tap a suggestion chip (goes into the first empty slot, Theme 1); save
flow('r2-fill-untick-chip', async ({ page }) => {
  await stubLookups(page);
  await page.evaluate(() => { showTab('toolbox', 'fill'); });
  await page.click('.fd-row[data-id="9"]'); await lookupDone(page);
  await page.waitForFunction(() => fdSel('ol') && fdSel('ol').synopsis !== undefined);
  await page.click('#fd-synopsis-gb');
  await page.click('.fd-chips [data-tag="Thrillers"]');
  await page.click('#fdSave'); await settle(page, 800);
}, { mutate: setBook('9', BLANK9) });
// (r3) every field already filled: nothing is pre-ticked, so Save writes nothing; ticking Google Books' pages writes just pages
flow('r3-fill-nothing-ticked', async ({ page }) => {
  await stubLookups(page);
  await page.evaluate(() => openFillFor(state.allBooks.find(x => x.id === '9')));
  await lookupDone(page);
  await page.click('#fdSave'); await settle(page, 400);
  await page.click('#fd-pages-gb'); await page.click('#fdSave'); await settle(page, 800);
}, { mutate: setBook('9', { pages: '280', synopsis: 'Has one', year: '2015', publisher: 'Mine', isbn: '9780000000002', genre: 'Mystery', theme1: 'a', theme2: 'b', theme3: 'c' }) });

// (r) Series view: a missing slot opens the existing Add to Wishlist dialog, prefilled; saving uses the normal Wishlist add path
flow('r-series-missing-to-wishlist', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="series"]').click(); });
  await page.waitForSelector('#seList .se-row');
  await page.evaluate(() => { const row = [...document.querySelectorAll('#seList .se-row')].find(r => /Spawn/.test(r.textContent)); [...row.querySelectorAll('.slot.missing')].find(b => b.textContent === '#3').click(); });
  await page.waitForSelector('#wishDlg[open]');
  await submit(page, '#wishDlg form');
  await settle(page, 800);
});

(async () => {
  const browser = await launch();
  const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
  const summary = [];
  for (const [name, { fn, opts }] of Object.entries(flows)) {
    if (only && !only.has(name)) continue;
    const app = await openApp(browser, appFile, { width: 1280, ...(opts || {}), keepLoadWrites: name === 'k-series-prune' });
    let failure = '';
    try { await fn(app); } catch (e) { failure = e.message.split('\n')[0].slice(0, 200); }
    const tabs = [...new Set(app.writes.map(w => String(w.input.range).match(/^(?:'([^']+)'|([^!]+))!/)).filter(Boolean).map(m => m[1] || m[2]))];
    const touched = Object.fromEntries(tabs.map(t => [t, app.sheets[t]]));
    fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(app.writes, null, 1));
    fs.writeFileSync(path.join(outDir, name + '.sheets.json'), JSON.stringify(touched, null, 1));
    fs.writeFileSync(path.join(outDir, name + '.errors.json'), JSON.stringify({ failure, errors: app.errors }, null, 1));
    summary.push(`${name}: ${app.writes.length} writes${failure ? ' FAILED: ' + failure : ''}${app.errors.length ? ' (' + app.errors.length + ' page errors)' : ''}`);
    await app.close();
  }
  console.log(summary.join('\n'));
  await browser.close();
})();
