// Screenshots of the main screens at 390px and 1280px. Usage: node tests/visual.js <app.html> <outDir>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { launch, openApp } = require('./lib.js');
const [, , appFile, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await launch();
  const errors = [];
  const ev = (page, f, ...a) => page.evaluate(f, ...a).catch(e => { errors.push('eval: ' + e.message.slice(0, 150)); });
  const closeAll = page => ev(page, () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); hideCard(); });
  for (const width of [390, 1280]) {
    const app = await openApp(browser, appFile, { width });
    const { page } = app;
    const shot = async name => { await page.waitForTimeout(150); await page.screenshot({ path: path.join(outDir, `${width}-${name}.png`), fullPage: true }); };
    await shot('log');
    for(const t of ['dashboard','tools','discover']){await ev(page,t=>showTab(t),t);await page.waitForTimeout(900);await shot('tab-'+t);}
    await ev(page,()=>showTab('library')); await shot('lib-books');
    await ev(page,()=>{document.querySelectorAll('#libSecs .lib-sec-head[aria-expanded="false"]').forEach(b=>b.click())}); await shot('lib-expanded');
    await ev(page,()=>{const t=document.querySelector('#libSecs .book-title');t&&t.click()}); await shot('book-card');
    await ev(page,()=>{const e=document.querySelector('#bookCard [data-a="edit"]');e&&e.click()}); await shot('edit-dialog');
    await closeAll(page);
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="plan"]').click()}); await shot('lib-plan');
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="wish"]').click()}); await shot('wish-inbox');
    await ev(page,()=>{document.querySelector('[data-wv="session"]').click()}); await shot('wish-getthem');
    await ev(page,()=>{document.getElementById('wlGroup').value='wantAs';document.getElementById('wlGroup').dispatchEvent(new Event('change'))}); await shot('wish-getthem-grouped');
    await ev(page,()=>{document.getElementById('wlGroup').value='';document.getElementById('wlGroup').dispatchEvent(new Event('change'));document.querySelector('[data-wv="series"]').click()}); await shot('wish-series');
    await ev(page,()=>{const w=disc.wish.find(x=>x.id==='WL0003'); openWishDlg(w)}); await shot('wish-dialog');
    await closeAll(page);
    await ev(page,()=>{openSeriesDlg(null)}); await shot('series-dialog-new');
    await closeAll(page);
    await ev(page,()=>{openSeriesDlg(disc.series[0])}); await shot('series-dialog-edit');
    await closeAll(page);
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="lists"]').click()}); await shot('lib-lists');
    await ev(page,()=>{document.querySelectorAll('#rlBoxes .lib-sec-head').forEach(b=>b.click())}); await shot('lib-lists-open');
    await ev(page,()=>{const it=disc.lists[0];openListDlg(it,it.list)}); await shot('list-dialog');
    await closeAll(page);
    await ev(page,()=>{openQuoteDlg(state.allBooks[0])}); await shot('quote-dialog');
    await closeAll(page);
    await ev(page,()=>{openContents(state.allBooks[0])}); await shot('contents-dialog');
    await closeAll(page);

    errors.push(...app.errors);
    await app.close();
  }
  fs.writeFileSync(path.join(outDir, 'errors.json'), JSON.stringify(errors, null, 1));
  console.log(fs.readdirSync(outDir).filter(f => f.endsWith('.png')).length, 'shots; errors', errors.length);
  await browser.close();
})();
