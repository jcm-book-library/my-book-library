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
  await fill(page, '#%', { wlAddT: 'Quick Title', wlAddA: 'Quinn Quick' });   // the sticky add bar, How = Inbox
  await submit(page, '#wlAddForm');
  await settle(page, 800);
  await page.evaluate(() => openWishDlg(null));
  await fill(page, '#wd-%', { title: 'Dialog Title', author: 'Dee Dialog', series: 'Dialogs', number: '2', type: 'Comic', format: 'Issues', stage: 'Buy', price: '9.5', release: '2026-12-25', notes: 'n' });
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
// Removing is the Wishlist's x / ⋯ > Remove: the row is cleared once the Undo toast has run out
const rmDone = page => page.waitForFunction(() => !wl.rm, null, { timeout: 12000 });
flow('i-wish-clear', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); });
  await page.click('#wlTabs [data-wv="Borrow"]');
  await page.click('.wl-row[data-id="WL0007"] [data-more]'); await page.click('.wl-menu [data-m="rm"]');
  await rmDone(page); await settle(page, 600);
  await page.click('#wlTabs [data-wv="Inbox"]');
  await page.click('.wl-row[data-id="WL0002"] [data-rm]');
  await rmDone(page); await settle(page, 600);
  // then a field edit on a row below the cleared ones
  await page.evaluate(() => setWishFields(disc.wish.find(w => w.id === 'WL0005'), { checked: 'Available', checkedOn: '2026-10-31', wantAs: 'PDF' }));
  await settle(page, 600);
});
// (j) add a series (goes below the last used row) and edit an existing one
flow('j-series-add-edit', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); openSeriesDlg(null); });
  await fill(page, '#sd-%', { series: 'Akira', author: 'Sam Series', publisher: 'Pub', kind: 'Comic', status: 'Following', soldAs: 'Issues', notes: 'fresh' });
  await submit(page, '#seriesDlg form'); await settle(page, 800);
  await page.evaluate(() => openSeriesDlg(disc.series.find(s => s.series === 'Spawn')));
  await fill(page, '#sd-%', { status: 'Ongoing', notes: 'edited note', link: 'https://example.com/spawn' });
  await submit(page, '#seriesDlg form'); await settle(page, 800);
  await page.evaluate(() => openSeriesDlg(disc.series.find(s => s.series === 'Moon Knight')));
  await fill(page, '#sd-%', { series: 'Stardust' });
  await submit(page, '#seriesDlg form'); await settle(page, 800);
});
// (k) no auto-prune: visiting the Wishlist never clears a tracked series, even one with no books
flow('k-series-prune', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); });
  await settle(page, 1000);
}, { mutate: s => { s['Series Tracker'].push(['Ghost Series', 'Gus Ghost', '', 'Novel', 'Ongoing', '', '', '', ''], ['Phantom Run', '', '', 'Comic', 'Following', '', '', '', '']); } });
// (l) Reading List: add one title through the paste dialog (below the blank middle row), edit the entry's list-only fields, remove
flow('l-list-add-remove', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="lists"]').click(); openListPaste('Classics'); });
  await fill(page, '#%', { 'lp-ta': 'Added Classic – Cass Sic' });
  await submit(page, '#listPasteForm'); await settle(page, 800);
  await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0002')));
  await fill(page, '#rl-%', { notes: 'edited' });
  await submit(page, '#listForm'); await settle(page, 800);
  await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0003')));
  await page.evaluate(() => document.getElementById('rlRemove').click());
  await yes(page); await settle(page, 800);
});
// The synthetic rows in data.js are shared objects that earlier flows write into, so these flows each start from a pristine copy of the sheet
const pristine = () => { const k = require.resolve('./data.js'), old = require.cache[k]; delete require.cache[k]; const m = require('./data.js').makeSheets(); require.cache[k] = old; return m; };
const fresh = extra => s => { Object.assign(s, pristine()); if (extra) extra(s); };
const listsMode = page => page.evaluate(() => { document.querySelector('.lib-mode [data-mode="lists"]').click(); });
const moreItems = s => { s['Reading Lists'].push(['Summer Sci-Fi', '3', 'Third Wave', 'Cy Zane', '', 'RL0004', '', ''], ['Summer Sci-Fi', '4', 'Fourth Dawn', 'Di Yarra', '', 'RL0005', '', '']); };
const rlTab = (s, id) => s['Reading Lists'].find(r => r[5] === id);
// (l2) New List from a pasted list: a repeated line is skipped; a title that is also a library book is just a list entry (its own status, no library write);
// one row gets a status, one is ticked for the Wishlist
flow('l2-list-paste', async ({ page, sheets, writes }) => {
  await listsMode(page);
  await page.evaluate(() => openListPaste(''));
  await fill(page, '#%', { 'lp-list': 'Fresh Picks', 'lp-ta': 'Fresh One – Fay Aldous\nDust of Stars by Ben Okafor\nFresh One - Fay Aldous' });
  must(await page.evaluate(() => document.querySelectorAll('#lpBody tr').length) === 3, 'three preview rows');
  must(await page.evaluate(() => document.getElementById('lpAdd').textContent) === 'Add 2', 'the button should say Add 2');
  must(await page.evaluate(() => document.querySelectorAll('#lpBody tr.dup').length) === 1, 'the repeated line should be marked');
  must(await page.evaluate(() => document.querySelectorAll('#lpBody input[type=checkbox]').length) === 3 && await page.evaluate(() => [...document.querySelectorAll('#lpBody input[type=checkbox]')].every(c => !c.checked)), 'every row has an unticked Wishlist box');
  must(await page.evaluate(() => [...document.querySelectorAll('#lpBody select')].map(x => x.value).join()) === 'To read,To read,To read', 'status defaults to To read');
  must(!(await page.evaluate(() => /library|Match/i.test(document.getElementById('listPasteDlg').textContent))), 'no library lookup text in the dialog');
  await page.selectOption('#lpBody tr:nth-child(2) select', 'Reading');
  await page.click('#lpBody tr:nth-child(1) input[type=checkbox]');
  await submit(page, '#listPasteForm'); await settle(page, 1000);
  const rows = sheets['Reading Lists'].filter(r => r[0] === 'Fresh Picks');
  must(rows.length === 2 && rows[0][2] === 'Fresh One' && rows[0][1] === '1' && rows[0][6] === '' && rows[0][7] === '' && rows[1][2] === 'Dust of Stars' && rows[1][1] === '2' && rows[1][6] === '' && rows[1][7] === 'Reading', 'two items in order, no library link, the second Reading: ' + JSON.stringify(rows));
  must(sheets['Wishlist'].some(r => r.includes('Fresh One') && r.includes('Fresh Picks')), 'Fresh One should be on the Wishlist, seen in Fresh Picks');
  must(!sheets['Wishlist'].some(r => r.includes('Dust of Stars')), 'an unticked row is not added to the Wishlist');
  must(writes.every(w => /Reading Lists|Wishlist/.test(String(w.input.range))) && !writes.some(w => /Books/.test(String(w.input.range))), 'only Reading Lists and Wishlist are written, never Books: ' + JSON.stringify(writes.map(w => w.input.range)));
  must(await page.evaluate(() => [...document.querySelectorAll('li[data-id] .rl-st')].filter(b => b.closest('li').querySelector('.tt').textContent === 'Dust of Stars').map(b => b.textContent).join()) !== '', 'the entry shows its own status');
}, { mutate: fresh() });
// (l2b) Pasting into an existing list adds to its end and skips what is already there
flow('l2b-list-paste-existing', async ({ page, sheets }) => {
  await listsMode(page);
  await page.evaluate(() => openListPaste('Summer Sci-Fi'));
  await fill(page, '#%', { 'lp-ta': 'Quiet Engines – Eli Ramos\nLate Entry' });
  must(await page.evaluate(() => document.getElementById('lpAdd').textContent) === 'Add 1', 'the duplicate should be skipped');
  await submit(page, '#listPasteForm'); await settle(page, 800);
  const r = sheets['Reading Lists'].find(x => x[2] === 'Late Entry');
  must(r && r[0] === 'Summer Sci-Fi' && r[1] === '3' && r[5] === 'RL0004' && r[6] === '' && r[7] === '', 'Late Entry should be number 3: ' + JSON.stringify(r));
  must(!sheets['Wishlist'].some(x => x.includes('Late Entry')), 'nothing goes to the Wishlist unless ticked');
}, { mutate: fresh() });
// (l2c) A ticked title that shares its name with a library book still goes to the Wishlist: lists never look at the library,
// and a same-titled item is only "already there" when it is on the Wishlist with the same (or a blank) author.
flow('l2c-list-paste-wish-same-title', async ({ page, sheets, writes }) => {
  await listsMode(page);
  await page.evaluate(() => openListPaste(''));
  await fill(page, '#%', { 'lp-list': 'Comics', 'lp-ta': 'Dust of Stars – Kim Comicson' });
  await page.click('#lpBody tr:nth-child(1) input[type=checkbox]');
  await submit(page, '#listPasteForm'); await settle(page, 1000);
  must(sheets['Reading Lists'].some(r => r[0] === 'Comics' && r[2] === 'Dust of Stars'), 'the entry is on the Comics list');
  must(sheets['Wishlist'].some(r => r.includes('Dust of Stars') && r.includes('Kim Comicson') && r.includes('Comics')), 'the ticked title is on the Wishlist even though a library book has the same title');
  must(!writes.some(w => /Books/.test(String(w.input.range))), 'Books is never written');
}, { mutate: fresh() });
// (l3) Reorder: arrow keys on the handle, then one real pointer drag. Only changed order cells are written
flow('l3-list-reorder', async ({ page, sheets, writes }) => {
  await listsMode(page);
  await page.focus('li[data-id="RL0004"] .drag');
  await page.keyboard.press('ArrowUp'); await settle(page, 600);
  must(writes.length === 2 && writes.every(w => /Reading Lists/.test(w.input.range) && /!B\d+$/.test(w.input.range)), 'two order cells only: ' + JSON.stringify(writes.map(w => w.input)));
  must(rlTab(sheets, 'RL0004')[1] === '2' && rlTab(sheets, 'RL0002')[1] === '3' && rlTab(sheets, 'RL0001')[1] === '1' && rlTab(sheets, 'RL0005')[1] === '4', 'orders after ArrowUp');
  must(await page.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Move Third Wave', 'focus stays on the moved handle');
  const h = await page.locator('li[data-id="RL0001"] .drag').boundingBox(), t = await page.locator('li[data-id="RL0005"]').boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 20, { steps: 3 });
  await page.mouse.move(h.x + h.width / 2, t.y + t.height - 4, { steps: 8 });
  must(await page.evaluate(() => !!document.querySelector('.rl-ol li.lifted') && !!document.querySelector('.rl-ol li.drop-below')), 'lifted row and a drop mark while dragging');
  await page.mouse.up(); await settle(page, 800);
  const order = ['RL0004', 'RL0002', 'RL0005', 'RL0001'].map(id => rlTab(sheets, id)[1]).join();
  must(order === '1,2,3,4', 'after the drag the list reads 1..4 in the new order: ' + order);
  must(await page.evaluate(() => [...document.querySelectorAll('li[data-id]')].map(x => x.dataset.id).join()) === 'RL0004,RL0002,RL0005,RL0001', 'rows re-rendered in the new order');
}, { mutate: fresh(moreItems) });
// (l3b) While a search filters the list there are no drag handles
flow('l3b-list-search-no-handles', async ({ page, writes }) => {
  await listsMode(page);
  must(await page.evaluate(() => document.querySelectorAll('.rl-ol .drag').length) > 0, 'handles show with no search');
  await fill(page, '#%', { libSearch: 'engines' }); await settle(page, 400);
  must(await page.evaluate(() => document.querySelectorAll('.rl-ol .drag').length) === 0, 'no handles while searching');
  must(writes.length === 0, 'no writes');
}, { mutate: fresh() });
// (l4) Rename a list, then rename another onto it (asks, then merges to the end)
flow('l4-list-rename-merge', async ({ page, sheets }) => {
  await listsMode(page);
  await page.evaluate(() => openRename('Summer Sci-Fi'));
  await fill(page, '#%', { 'rn-name': '' });
  await submit(page, '#rlRenameForm');
  must(/needed/.test(await page.evaluate(() => document.getElementById('rnMsg').textContent)), 'an empty name is refused');
  await fill(page, '#%', { 'rn-name': 'Space Summer' });
  await submit(page, '#rlRenameForm'); await settle(page, 800);
  must(rlTab(sheets, 'RL0001')[0] === 'Space Summer' && rlTab(sheets, 'RL0002')[0] === 'Space Summer' && rlTab(sheets, 'RL0001')[1] === '1', 'both items renamed, numbers untouched');
  await page.evaluate(() => openRename('Classics'));
  await fill(page, '#%', { 'rn-name': 'space summer' });
  await submit(page, '#rlRenameForm'); await yes(page); await settle(page, 800);
  const m = rlTab(sheets, 'RL0003');
  must(m[0] === 'Space Summer' && m[1] === '3', 'merged item goes to the end of the other list: ' + JSON.stringify(m));
}, { mutate: fresh() });
// (l5) Delete a list: asks first, then clears each of its rows (only Reading Lists cells)
flow('l5-list-delete', async ({ page, sheets, writes }) => {
  await listsMode(page);
  await page.evaluate(() => document.querySelector('#rlBoxes .rl-add .btn:nth-child(3)').click());
  must(/Delete the list “Summer Sci-Fi” and its 2 entries\? Books in your library aren't changed\./.test(await page.evaluate(() => document.getElementById('askMsg').textContent)), 'confirm text');
  await yes(page); await settle(page, 900);
  must(!rlTab(sheets, 'RL0001') && !rlTab(sheets, 'RL0002') && rlTab(sheets, 'RL0003'), 'Summer Sci-Fi rows cleared, Classics kept');
  must(writes.length === 2 && writes.every(w => /Reading Lists/.test(w.input.range)), 'two row clears, nothing else: ' + JSON.stringify(writes.map(w => w.input.range)));
}, { mutate: fresh() });
// (l6) Entry dialog: move an item to another list (goes to the end of it)
flow('l6-list-entry-move', async ({ page, sheets }) => {
  await listsMode(page);
  await page.evaluate(() => openListDlg(disc.lists.find(x => x.id === 'RL0002')));
  await fill(page, '#rl-%', { list: 'Classics', notes: 'moved' });
  await submit(page, '#listForm'); await settle(page, 800);
  const r = rlTab(sheets, 'RL0002');
  must(r[0] === 'Classics' && r[1] === '2' && r[4] === 'moved', 'moved to the end of Classics: ' + JSON.stringify(r));
}, { mutate: fresh() });
// (l7) Status pill: tapping cycles To read > Reading > Read > To read and writes only the status cell; progress and Next in List follow it.
// The entries have the same titles as library books and bookIds, and still show their own status.
flow('l7-list-status-pill', async ({ page, sheets, writes }) => {
  await listsMode(page);
  const pill = id => page.evaluate(i => document.querySelector(`li[data-id="${i}"] .rl-st`).textContent, id);
  must(await pill('RL0001') === 'To read' && await pill('RL0002') === 'To read', 'both start as To read, whatever the library holds');
  must(writes.length === 0, 'showing the lists writes nothing');
  await page.click('li[data-id="RL0001"] .rl-st'); await settle(page, 600);
  must(await pill('RL0001') === 'Reading' && rlTab(sheets, 'RL0001')[7] === 'Reading', 'first tap: Reading');
  await page.click('li[data-id="RL0001"] .rl-st'); await settle(page, 600);
  must(await pill('RL0001') === 'Read' && rlTab(sheets, 'RL0001')[7] === 'Read', 'second tap: Read');
  must(/^1 of 2/.test(await page.evaluate(() => document.querySelector('[data-rl="Summer Sci-Fi"] .cnt').textContent)) && /Quiet Engines/.test(await page.evaluate(() => document.querySelector('[data-rl="Summer Sci-Fi"] .sub').textContent)), 'progress counts Read, next is the first not Read');
  await page.click('li[data-id="RL0002"] .rl-st'); await page.click('li[data-id="RL0002"] .rl-st'); await settle(page, 800);
  must(/all finished/.test(await page.evaluate(() => document.querySelector('[data-rl="Summer Sci-Fi"] .sub').textContent)), 'all Read: all finished');
  await page.click('li[data-id="RL0001"] .rl-st'); await settle(page, 600);
  must(await pill('RL0001') === 'To read' && rlTab(sheets, 'RL0001')[7] === 'To read', 'third tap: back to To read');
  must(writes.length === 5 && writes.every(w => /Reading Lists/.test(w.input.range) && /!H\d+$/.test(w.input.range)), 'status cells only: ' + JSON.stringify(writes.map(w => w.input.range)));
  must(rlTab(sheets, 'RL0001')[6] === '5', 'the old bookId value is left alone');
  await page.click('li[data-id="RL0001"] .tt'); await settle(page, 300);
  must(writes.length === 5 && await page.evaluate(() => state.lib.mode) === 'lists', 'the title is not a link into the library');
}, { mutate: fresh() });
// (l8) Edit opens the List Entry dialog (not the Books editor): title, author, status, notes, list. Only the list entry is written.
flow('l8-list-edit-entry', async ({ page, sheets, writes }) => {
  await listsMode(page);
  must(!(await page.$('li[data-id="RL0002"] .acts button:has-text("Entry")')) && !(await page.$('li[data-id="RL0003"] .acts button:has-text("Add to Library")')), 'one Edit button per row, no Add to Library');
  await page.click('li[data-id="RL0002"] .acts button:has-text("Edit")');
  await page.waitForSelector('#listDlg[open]');
  must(!(await page.$('#bookDlg[open]')) && await page.evaluate(() => document.getElementById('rl-title').value + '|' + document.getElementById('rl-status').value) === 'Quiet Engines|To read', 'the List Entry dialog with its own status');
  await fill(page, '#%', { 'rl-title': 'Quiet Engines II', 'rl-status': 'Reading', 'rl-notes': 'from the list' });
  await submit(page, '#listForm'); await settle(page, 900);
  const r = rlTab(sheets, 'RL0002');
  must(r[2] === 'Quiet Engines II' && r[4] === 'from the list' && r[7] === 'Reading' && r[6] === '', 'the entry is saved: ' + JSON.stringify(r));
  must(writes.length === 3 && writes.every(w => /Reading Lists/.test(w.input.range)), 'three Reading Lists cells only: ' + JSON.stringify(writes.map(w => w.input.range)));
  await page.evaluate(() => { document.querySelector('.lib-mode [data-mode="books"]').click(); });
  must(await page.evaluate(() => !document.getElementById('libShelves').textContent.includes('Your Shelves') && !shelfDefs.some(d => d.grp === 'lists')), 'the Library shelves have no reading-list shelves');
}, { mutate: fresh() });
// (l9) The Reading Lists tab has no status header yet: lists show as To read, a tap says what to add and writes nothing, a paste of To read rows works
flow('l9-list-no-status-header', async ({ page, sheets, writes }) => {
  await listsMode(page);
  must(await page.evaluate(() => [...document.querySelectorAll('.rl-st')].every(b => b.textContent === 'To read')) && writes.length === 0, 'reading works with the column missing');
  await page.click('li[data-id="RL0001"] .rl-st'); await settle(page, 800);
  must(/Add a 'status' header to the Reading Lists tab first\./.test(await page.evaluate(() => document.getElementById('notice').textContent)), 'the message names the header');
  must(writes.length === 0 && await page.evaluate(() => document.querySelector('li[data-id="RL0001"] .rl-st').textContent) === 'To read', 'nothing written and the pill is back to To read');
  await page.evaluate(() => openListPaste('Classics'));
  await fill(page, '#%', { 'lp-ta': 'Plain Add – P A' });
  await submit(page, '#listPasteForm'); await settle(page, 800);
  must(writes.length === 1 && sheets['Reading Lists'].some(r => r[2] === 'Plain Add' && r.length === 7), 'a To read paste still works, no column added');
  await page.evaluate(() => openListPaste('Classics'));
  await fill(page, '#%', { 'lp-ta': 'Reading Add' });
  await page.selectOption('#lpBody tr:nth-child(1) select', 'Reading');
  await submit(page, '#listPasteForm'); await settle(page, 800);
  must(/Add a 'status' header/.test(await page.evaluate(() => document.getElementById('lpErr').textContent)) && writes.length === 1, 'a Reading row is refused with the same message, nothing written');
}, { mutate: fresh(s => { s['Reading Lists'] = s['Reading Lists'].map(r => r.slice(0, 7)); }) });
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

// ===== Remove (TBR / Paused / DNF), Undo, Restore, Delete for good =====
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const ids = (page, which) => page.evaluate(w => state[w].map(b => b.id).join(','), which);
// (s1) the plan's x on an Up next book: status Removed with tier and upNextOrder cleared, then Up next is renumbered; the book is gone from every list
flow('s1-remove-up-next', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); document.querySelector('.lib-mode [data-mode="plan"]').click(); });
  await page.click('#upList li[data-id="9"] button[aria-label="Remove Paper Towns Revisited"]');
  await settle(page, 800);
  must(!(await ids(page, 'allBooks')).split(',').includes('9') && (await ids(page, 'removedBooks')) === '9', 'book 9 should be in removedBooks only');
  must(await page.evaluate(() => upNext().map(b => b.id + ':' + b.upNextOrder).join()) === '13:1', 'Up next not renumbered');
  must(await page.evaluate(() => !document.getElementById('undoBar').hidden && /Removed “Paper Towns Revisited”/.test(document.getElementById('undoBar').textContent)), 'undo bar missing');
}, { mutate: fresh() });
// (s2) the Library list's x on a Paused book (no plan fields to clear)
flow('s2-remove-list-paused', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); state.lib.sec.Paused = true; renderLibrary(); });
  await page.click('#libSecs [data-rm="45"]');
  await settle(page, 800);
  must((await ids(page, 'removedBooks')) === '45' && !(await ids(page, 'allBooks')).split(',').includes('45'), 'book 45 should be removed');
}, { mutate: fresh() });
// (s3) "Remove" in the floating book card of a DNF book
flow('s3-remove-card-dnf', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); showCard('49'); });
  await page.click('#bookCard [data-a="remove"]');
  await settle(page, 800);
  must((await ids(page, 'removedBooks')) === '49' && await page.evaluate(() => document.getElementById('bookCard').hidden), 'book 49 should be removed and the card closed');
}, { mutate: fresh() });
// (s3b) a Reading or Finished book has no remove button
flow('s3b-no-remove-for-others', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); showCard('1'); });
  must(await page.evaluate(() => !document.querySelector('#bookCard [data-a="remove"]') && !document.querySelector('#libSecs [data-rm="1"], #libSecs [data-rm="33"]')), 'Reading/Finished books must not show a remove button');
}, { mutate: fresh() });
// (s4) remove an Up next book, then Undo: the old status, tier and Up next number are written back and Up next is renumbered again
flow('s4-remove-undo', async ({ page }) => {
  await page.evaluate(() => { showTab('library'); document.querySelector('.lib-mode [data-mode="plan"]').click(); });
  await page.click('#upList li[data-id="9"] button.rm');
  await settle(page, 800);
  await page.click('#undoBtn');
  await settle(page, 800);
  must((await ids(page, 'removedBooks')) === '' && await page.evaluate(() => upNext().map(b => b.id + ':' + b.upNextOrder).join()) === '9:1,13:2', 'undo should restore book 9 as Up next #1');
  must(await page.evaluate(() => document.getElementById('undoBar').hidden), 'undo bar should be gone');
}, { mutate: fresh() });
// (s5) Toolbox > Removed books: Restore (default TBR), then Restore another one as Paused with the segmented choice
flow('s5-restore-from-toolbox', async ({ page }) => {
  await page.evaluate(() => showTab('toolbox', 'removed'));
  must(await page.evaluate(() => document.querySelectorAll('#rmBox li').length) === 2, 'two removed books should be listed');
  await page.click('#rmBox li[data-id="45"] [data-a="restore"]');
  await settle(page, 800);
  await page.click('#rmBox li[data-id="49"] .seg button:nth-child(2)');
  await page.click('#rmBox li[data-id="49"] [data-a="restore"]');
  await settle(page, 800);
  must(await page.evaluate(() => state.allBooks.find(b => b.id === '45').status + '/' + state.allBooks.find(b => b.id === '49').status) === 'TBR/Paused' && (await ids(page, 'removedBooks')) === '', 'restored statuses wrong');
}, { mutate: fresh(s => { setBook('45', { status: 'Removed' })(s); setBook('49', { status: 'Removed' })(s); }) });
// (s6) Delete for good: asks first (Cancel writes nothing), then clears that one Books row, never the remain / % formula columns
flow('s6-delete-for-good', async ({ page }) => {
  await page.evaluate(() => showTab('toolbox', 'removed'));
  await page.click('#rmBox li[data-id="45"] [data-a="delete"]');
  await page.waitForSelector('#askDlg[open]');
  must(await page.evaluate(() => document.getElementById('askMsg').textContent) === 'Delete “Slow Orbit” for good? This can\'t be undone.', 'ask text');
  await page.evaluate(() => document.getElementById('askNo').click());
  await settle(page, 300);
  must((await ids(page, 'removedBooks')) === '45', 'cancel must keep the book');
  await page.click('#rmBox li[data-id="45"] [data-a="delete"]');
  await yes(page);
  await settle(page, 800);
  must((await ids(page, 'removedBooks')) === '', 'book should be gone from the list');
}, { mutate: fresh(setBook('45', { status: 'Removed' })) });
// (s7) a removed book keeps its id: with the highest id (61) removed, the next new book still gets 65, not 61
flow('s7-new-id-after-removed', async ({ page }) => {
  must(!(await ids(page, 'allBooks')).split(',').includes('61') && (await ids(page, 'removedBooks')) === '61', 'removed book 61 should be split out on load: ' + await ids(page, 'allBooks') + ' / ' + await ids(page, 'removedBooks'));
  await page.evaluate(() => { showTab('library'); openBookDialog(null); });
  await fill(page, '#bookForm [name="%"]', { title: 'After Removed', author: 'Ida After', status: 'TBR', pages: '100' });
  await submit(page, '#bookForm');
  await settle(page);
  must(await page.evaluate(() => state.allBooks[state.allBooks.length - 1].id) === '65', 'new id should be 65');
}, { mutate: fresh(setBook('61', { status: 'Removed' })) });
// (s8) delete the highest id (61) for good: bookIdFloor=61 is saved first (App Settings), so the next new book gets 65, not the freed 61
flow('s8-delete-highest-then-add', async ({ page }) => {
  await page.evaluate(() => showTab('toolbox', 'removed'));
  await page.click('#rmBox li[data-id="61"] [data-a="delete"]'); await yes(page); await settle(page, 800);
  await page.evaluate(() => { showTab('library'); openBookDialog(null); });
  await fill(page, '#bookForm [name="%"]', { title: 'After Delete', author: 'Ida After', status: 'TBR', pages: '100' });
  await submit(page, '#bookForm');
  await settle(page);
  must(await page.evaluate(() => state.allBooks[state.allBooks.length - 1].id) === '65', 'new id should be 65, not the deleted 61');
}, { mutate: fresh(setBook('61', { status: 'Removed' })) });

// ===== Wishlist (Next Up): sticky add bar, Inbox/Download/Buy/Borrow, availability, Got it popover, edit dialog =====
const wishMode = page => page.evaluate(() => { document.querySelector('.lib-mode [data-mode="wish"]').click(); });
const wishRow = (page, id) => page.evaluate(id => { const w = disc.wish.find(x => x.id === id); return w && { ...w }; }, id);
// (t1) the sticky add bar: Title, Author, How = Download, Add (stage "Download", new row below the last used one)
flow('t1-wish-bar-add-download', async ({ page }) => {
  await wishMode(page);
  await fill(page, '#%', { wlAddT: 'Bar Download Title', wlAddA: 'Bea Bar' });
  await page.click('#wlHow [data-h="Download"]');
  await page.click('#wlAddBtn');
  await settle(page, 800);
  must(await page.evaluate(() => wl.tab) === 'Download', 'the Download tab should open after adding to it');
}, { mutate: fresh() });
// (t2) Inbox > Buy: one tap writes only the stage cell
flow('t2-wish-inbox-to-buy', async ({ page }) => {
  await wishMode(page);
  await page.click('.wl-row[data-id="WL0001"] [data-mv="Buy"]');
  await settle(page, 800);
  must((await wishRow(page, 'WL0001')).stage === 'Buy', 'WL0001 should be Buy');
}, { mutate: fresh() });
// (t3) Coming soon with a release date on an old-style row ("To download"): the stage moves to "Download" with it, then the date is written
flow('t3-wish-coming-soon-date', async ({ page }) => {
  await wishMode(page);
  await page.click('#wlTabs [data-wv="Download"]');
  await page.click('.wl-row[data-id="WL0005"] [data-a="Coming soon"]');
  await settle(page, 600);
  await page.fill('.wl-row[data-id="WL0005"] [data-date]', '2027-03-01');
  await settle(page, 800);
  const w = await wishRow(page, 'WL0005');
  must(w.checked === 'Coming soon' && w.release === '2027-03-01' && w.stage === 'Download', 'WL0005 should be Download, Coming soon, 2027-03-01: ' + JSON.stringify(w));
}, { mutate: fresh() });
// (t4) Got it (Download, Kobo, Up next): Books row with tier, triaged, upNextOrder (3, after the two Up next books) and copies Kobo; archive row; Wishlist row cleared
flow('t4-wish-got-it-up-next-kobo', async ({ page }) => {
  await wishMode(page);
  await page.click('#wlTabs [data-wv="Download"]');
  await page.click('.wl-row[data-id="WL0003"] [data-got]');
  await page.click('.wl-pop [data-g="copy"][data-v="Kobo"]');
  await page.click('.wl-pop [data-ok]');
  await settle(page, 1200);
  const b = await page.evaluate(() => state.allBooks.find(x => x.title === 'Kobo Find'));
  must(b && b.tier === 'Up next' && String(b.upNextOrder) === '3' && b.copies === 'Kobo' && b.status === 'TBR', 'new book should be TBR, Up next #3, Kobo: ' + JSON.stringify(b));
  must(!(await wishRow(page, 'WL0003')), 'WL0003 should be off the Wishlist');
  must(/in your TBR · Up next/.test(await page.evaluate(() => document.getElementById('wlToasts').textContent)), 'toast missing');
}, { mutate: fresh() });
// (t4b) Got it on a Buy row (from the ⋯ menu) as Someday, Physical; and on a Borrow row as Soon (no copy, notes say Library)
flow('t4b-wish-got-it-buy-borrow', async ({ page }) => {
  await wishMode(page);
  await page.click('#wlTabs [data-wv="Buy"]');
  await page.click('.wl-row[data-id="WL0006"] [data-more]'); await page.click('.wl-menu [data-m="got"]');   // Coming soon by its release date: Got it is in the ⋯ menu
  await page.click('.wl-pop [data-g="tier"][data-v="Someday"]');
  await page.click('.wl-pop [data-ok]');
  await settle(page, 1200);
  await page.click('#wlTabs [data-wv="Borrow"]');
  await page.click('.wl-row[data-id="WL0007"] [data-got]');
  await page.click('.wl-pop [data-g="tier"][data-v="Soon"]');
  await page.click('.wl-pop [data-ok]');
  await settle(page, 1200);
}, { mutate: fresh() });
// (t5) Edit: change author and note only. Price, release, format, publisher, series and the rest stay exactly as they were
flow('t5-wish-edit-keeps-hidden-columns', async ({ page }) => {
  await wishMode(page);
  await page.click('#wlTabs [data-wv="Buy"]');
  await page.click('.wl-row[data-id="WL0006"] [data-edit]');
  await page.waitForSelector('#wishEditDlg[open]');
  await fill(page, '#%', { 'we-author': 'Uma Pen (ed.)', 'we-note': 'edited from the new dialog' });
  await submit(page, '#wishEditForm');
  await settle(page, 800);
  const w = await wishRow(page, 'WL0006');
  must(w.price === '45' && w.release === '2026-12-01' && w.format === 'Deluxe' && w.type === 'Comic' && w.gift === 'TRUE' && w.added === '2026-09-03' && w.author === 'Uma Pen (ed.)' && w.notes === 'edited from the new dialog', 'hidden columns changed: ' + JSON.stringify(w));
}, { mutate: fresh() });
// (t6) Remove, then Undo inside the toast: nothing is written and the row is back
flow('t6-wish-remove-undo', async ({ page }) => {
  await wishMode(page);
  await page.click('.wl-row[data-id="WL0001"] [data-rm]');
  must(!(await wishRow(page, 'WL0001')), 'the row should leave the list at once');
  await page.click('.wl-toast:last-child .linkbtn');
  await rmDone(page); await settle(page, 600);
  must(!!(await wishRow(page, 'WL0001')), 'Undo should bring WL0001 back');
}, { mutate: fresh() });

// (t7) Kind sticker: a tap on the sticker and "Comic" writes the one `format` cell (Book > Comic); the same kind again writes nothing; reading never writes
flow('t7-wish-kind-sticker', async ({ page, writes }) => {
  await wishMode(page);
  must(writes.length === 0, 'opening the Wishlist must not write');
  must(await page.evaluate(() => wishKind(disc.wish.find(x => x.id === 'WL0001')) + '|' + wishKind(disc.wish.find(x => x.id === 'WL0006')) + '|' + wishKind(disc.wish.find(x => x.id === 'WL0010')) + '|' + wishKind({ format: '' })) === 'Book|Comic|Graphic novel|', 'kind mapping');
  await page.click('.wl-row[data-id="WL0001"] [data-kind]');
  await page.click('.wl-menu [data-k="Book"]');                    // already Book: no write
  await settle(page, 400);
  must(writes.length === 0, 'choosing the current kind must not write');
  await page.click('.wl-row[data-id="WL0001"] [data-kind]');
  await page.click('.wl-menu [data-k="Comic"]');
  await settle(page, 800);
  must((await wishRow(page, 'WL0001')).format === 'Comic', 'WL0001 format should be Comic');
  must(await page.evaluate(() => document.querySelector('.wl-row[data-id="WL0001"] .wl-kind').textContent) === 'Comic', 'sticker should read Comic');
}, { mutate: fresh() });
// (t8) Edit How Download > Buy: only the stage is written, the Download tab stays active (the row just leaves it), an Undo toast appears
flow('t8-wish-edit-how-stays-on-tab', async ({ page }) => {
  await wishMode(page);
  await page.click('#wlTabs [data-wv="Download"]');
  await page.click('.wl-row[data-id="WL0009"] [data-edit]');
  await page.waitForSelector('#wishEditDlg[open]');
  await fill(page, '#%', { 'we-how': 'Buy' });
  await submit(page, '#wishEditForm');
  await settle(page, 800);
  must(await page.evaluate(() => wl.tab) === 'Download', 'the active Wishlist tab must stay Download');
  must(await page.evaluate(() => document.querySelector('#wlTabs [aria-pressed="true"]').dataset.wv) === 'Download', 'the Download tab button should still be pressed');
  must(!(await page.$('.wl-row[data-id="WL0009"]')), 'the row should have left the Download list');
  must((await wishRow(page, 'WL0009')).stage === 'Buy', 'WL0009 should be Buy');
  must(/Moved .*Box Of Wonders.* to Buy/.test(await page.evaluate(() => document.getElementById('wlToasts').textContent)), 'Undo toast missing');
}, { mutate: fresh() });
// (t9) Kind filter is display-only: no writes; counts follow the filter; the filter is remembered
flow('t9-wish-kind-filter-display-only', async ({ page, writes }) => {
  await wishMode(page);
  await page.click('#wlKind [data-k="Comic"]');
  await page.click('#wlKind [data-k="Graphic novel"]');
  const cnt = () => page.evaluate(() => [...document.querySelectorAll('#wlTabs button')].map(b => b.dataset.wv + b.querySelector('.n').textContent).join());
  must(await cnt() === 'Inbox2,Download3,Buy2,Borrow0', 'counts should follow the kind filter: ' + await cnt());
  must(await page.evaluate(() => localStorage.getItem('mbl_wkind')) === '["Comic","Graphic novel"]', 'filter remembered');
  await page.click('#wlKind [data-k="Comic"]'); await page.click('#wlKind [data-k="Graphic novel"]');
  must(await cnt() === 'Inbox3,Download4,Buy2,Borrow1', 'cleared filter shows all: ' + await cnt());
  await settle(page, 400);
  must(writes.length === 0, 'the kind filter must not write: ' + JSON.stringify(writes));
}, { mutate: fresh() });

// (u) Themes: loading writes nothing; changing the theme writes only the `theme` setting row, the dyslexia toggle only `dyslexiaFont`;
// a reload (browser storage cleared) takes the saved theme from the settings without writing
flow('u-theme-settings', async ({ page, writes }) => {
  must(writes.length === 0, 'loading the app must not write anything: ' + JSON.stringify(writes));
  must(await page.evaluate(() => document.documentElement.dataset.theme) === 'default', 'default theme expected');
  await page.evaluate(() => document.querySelector('button[data-theme="night"]').click());
  await settle(page, 800);
  must(await page.evaluate(() => document.documentElement.dataset.theme) === 'night', 'night should apply at once');
  must(writes.length === 1 && /App Settings/.test(JSON.stringify(writes[0])) && /theme/.test(JSON.stringify(writes[0])) && /night/.test(JSON.stringify(writes[0])), 'one theme row expected: ' + JSON.stringify(writes));
  await page.evaluate(() => document.querySelector('button[data-dys="on"]').click());
  await settle(page, 800);
  must(writes.length === 2 && /dyslexiaFont/.test(JSON.stringify(writes[1])), 'one dyslexiaFont row expected: ' + JSON.stringify(writes.slice(1)));
  const n = writes.length;
  await page.reload(); await page.waitForFunction(() => state.live && state.libLoaded); await settle(page, 800);
  must(await page.evaluate(() => document.documentElement.dataset.theme + '/' + document.documentElement.dataset.dys) === 'night/1', 'saved theme should win after reload');
  must(writes.length === n, 'reload must not write');
});

(async () => {
  const browser = await launch();
  const only = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
  const summary = [];
  for (const [name, { fn, opts }] of Object.entries(flows)) {
    if (only && !only.has(name)) continue;
    const app = await openApp(browser, appFile, { width: 1280, ...(opts || {}), keepLoadWrites: name === 'k-series-prune' || name === 'u-theme-settings' });
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
