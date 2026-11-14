// Screenshots of the main screens at 390px and 1280px. Usage: node tests/visual.js <app.html> <outDir>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { launch, openApp } = require('./lib.js');
const { seedInsights } = require('./insights-seed.js');
const [, , appFile, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await launch();
  const errors = [];
  const ev = (page, f, ...a) => page.evaluate(f, ...a).catch(e => { errors.push('eval: ' + e.message.slice(0, 150)); });
  const closeAll = page => ev(page, () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); hideCard(); });
  for (const width of [390, 1280]) {
    const app = await openApp(browser, appFile, { width, libView: 'default' });
    const { page } = app;
    const shot = async name => { await page.waitForTimeout(150); await page.screenshot({ path: path.join(outDir, `${width}-${name}.png`), fullPage: true }); };
    await shot('log');
    for(const t of ['dashboard','tools','discover']){await ev(page,t=>showTab(t),t);await page.waitForTimeout(900);await shot('tab-'+t);}
    await ev(page,()=>showTab('library')); await shot('lib-books');
    await ev(page,()=>{const b=document.querySelector('#libViewSeg [data-v="list"]');b&&b.click()});
    await ev(page,()=>{document.querySelectorAll('#libSecs .lib-sec-head[aria-expanded="false"]').forEach(b=>b.click())}); await shot('lib-expanded');
    await ev(page,()=>{const t=document.querySelector('#libSecs .book-title');t&&t.click()}); await shot('book-card');
    await ev(page,()=>{const e=document.querySelector('#bookCard [data-a="edit"]');e&&e.click()}); await shot('edit-dialog');
    await closeAll(page);
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="plan"]').click()}); await shot('lib-plan');
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="wish"]').click()}); await shot('wish-inbox');
    for(const h of ['Download','Buy','Borrow']){ await ev(page,h=>{const b=document.querySelector('#wlTabs [data-wv="'+h+'"]');b&&b.click()},h); await shot('wish-'+h.toLowerCase()); }
    await ev(page,()=>{const b=document.querySelector('#wlTabs [data-wv="Download"]');b&&b.click();const g=document.querySelector('.wl-row [data-got]');g&&g.click()}); await shot('wish-gotit');
    await ev(page,()=>{document.querySelectorAll('.wl-pop').forEach(p=>p.remove())});
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

    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="authors"]').click()}); await shot('lib-authors');
    await ev(page,()=>{const c=[...document.querySelectorAll('.au-card')].find(x=>/Ben Okafor/.test(x.textContent))||document.querySelector('.au-card');c.click()}); await shot('author-page');
    await ev(page,()=>{document.querySelector('#auPage [data-book]').click()}); await shot('author-book-card');
    await closeAll(page);
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="series"]').click()}); await shot('lib-series');
    await closeAll(page);
    // Library Shelves (the new default view; on the old app these show the list)
    await ev(page,()=>{document.querySelector('.lib-mode [data-mode="books"]').click()});
    await ev(page,()=>{const b=document.querySelector('#libViewSeg [data-v="shelves"]');b&&b.click()}); await shot('lib-shelves');
    // a very long title proves the shrink / whole-word cut rule (injected here so the shared test data is unchanged)
    await ev(page,()=>{ if(!document.getElementById('libViewSeg')) return;
      const t=state.allBooks.find(b=>b.status==='Reading'); const mk=(title,pages)=>Object.assign({},t,{id:'L'+title.length,title,pages,author:'Long Author',_row:900+title.length});
      state.allBooks.push(mk('The Extraordinarily Long and Winding Chronicle of an Unlikely Lighthouse Keeper and Her Seventeen Cats','180'),mk('Pneumonoultramicroscopicsilicovolcanoconiosis','180'),mk('A Moderately Long Title for Testing','300'));
      renderLibrary(); });
    await shot('lib-shelves-longtitle');
    const row=await page.$('#libShelves .shelf-row'); if(row){ await row.screenshot({path:path.join(outDir,`${width}-lib-shelves-spines.png`)}); }
    await ev(page,()=>{const b=document.querySelector('#libShelves [data-seeall]');b&&b.click()}); await shot('lib-shelves-seeall');
    // Insights with enough synthetic books and log entries that every chart has something to draw (injected here only)
    // the tab bar is sticky now, so it would sit on top of the element screenshots below; unpin it for these shots
    await ev(page,()=>{document.querySelector('.wrap > .bar').style.position='static'});
    await seedInsights(page, 180);
    await ev(page,()=>showTab('insights')); await page.waitForTimeout(500); await shot('insights-full');
    for(const c of ['insC1','insC2','insC3','insC4','insC5']){ const e=await page.$('#'+c); if(e) await e.screenshot({path:path.join(outDir,`${width}-insights-${c}.png`)}); }
    await ev(page,()=>{const b=document.querySelector('#dashPeriods [data-p="all"]');b&&b.click()}); await page.waitForTimeout(400); await shot('insights-alltime');
    await ev(page,()=>{const b=[...document.querySelectorAll('#insG2b .ins-seg button')][1];b&&b.click()}); await shot('insights-themes');
    errors.push(...app.errors);
    await app.close();
  }
  fs.writeFileSync(path.join(outDir, 'errors.json'), JSON.stringify(errors, null, 1));
  console.log(fs.readdirSync(outDir).filter(f => f.endsWith('.png')).length, 'shots; errors', errors.length);
  await browser.close();
})();
