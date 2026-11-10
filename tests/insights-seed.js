// Synthetic books and log entries for the Insights tests, injected into the running page (tests/data.js stays small
// so the other screens and flows don't change). n = how many finished books to add; the rest (re-reads, TBR, log) scale with it.
async function seedInsights(page, n) {
  return page.evaluate(n => {
    let x = 4242; const R = () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const pick = a => a[Math.floor(R() * a.length)], pickW = (a, w) => { let t = w.reduce((s, v) => s + v, 0), r = R() * t; for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[a.length - 1]; };
    const rn = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
    const G = ['Literary fiction', 'Science fiction', 'Fantasy', 'Crime & thriller', 'Historical fiction', 'Popular science', 'History', 'Memoir', 'Horror'], GW = [24, 17, 14, 12, 8, 9, 8, 5, 3], GM = [3.95, 3.7, 3.5, 3.4, 3.8, 3.6, 3.8, 3.5, 3.2];
    const TH = ['grief', 'family', 'identity', 'war', 'sea', 'friendship', 'power', 'memory', 'migration', 'justice', 'love', 'survival', 'faith', 'class', 'technology', 'nature'];
    const CT = ['United Kingdom', 'United States of America', 'Japan', 'Nigeria', 'France', 'India', 'Germany', 'Australia', 'Argentina', 'Russia', 'Italy', 'Norway', 'Imaginary'];
    const AU = []; for (let i = 0; i < 70; i++) AU.push(pick(['Ada', 'Tomas', 'Ines', 'Rafael', 'Mira', 'Joon', 'Elena', 'Kofi', 'Nadia', 'Oskar', 'Priya', 'Lucas']) + ' ' + pick(['Marlow', 'Okafor', 'Lindqvist', 'Varga', 'Hale', 'Ibarra', 'Castellan', 'Brandt', 'Nakamura', 'Whitlock', 'Duarte', 'Petrov', 'Ashworth']) + (i > 11 ? ' ' + String.fromCharCode(65 + i % 26) + '.' : ''));
    const W1 = ['Quiet', 'Last', 'Hollow', 'Salt', 'Paper', 'Winter', 'Northern', 'Glass', 'Slow', 'Distant', 'Burning', 'Hidden', 'Silver', 'Long', 'Open', 'Iron', 'Midnight', 'Wild', 'Pale'], W2 = ['Harbour', 'Orchard', 'Archive', 'Tide', 'Garden', 'Signal', 'Atlas', 'Lantern', 'Season', 'Ledger', 'Compass', 'Meridian', 'Orbit', 'Kingdom', 'Crossing', 'Ferry', 'Mirror', 'Station'];
    const t0 = state.allBooks.find(b => b.status === 'Finished') || state.allBooks[0], T = today();
    const dayN = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5, isoN = d => new Date(d * 864e5).toISOString().slice(0, 10), todayN = dayN(T);
    let id = 2000; const used = new Set(), mk = o => Object.assign({}, t0, { id: String(id += 4), _row: 3000 + id, status: 'Finished', rating: '', favourite: '', currentPage: '', startDate: '', finishDate: '', series: '', seriesNum: '', tier: '', upNextOrder: '', why: '', awards: '', theme1: '', theme2: '', theme3: '', setting: '', added: '', year: '', cover: 'none', loaned: '', loanee: '', synopsis: '', notes: '', copies: 'Kobo', publisher: '' }, o);
    const title = () => { for (;;) { const t = pick(['The ', 'A ', '']) + pick(W1) + ' ' + pick(W2) + (R() < .3 ? ' of ' + pick(W1) + ' ' + pick(W2) : ''); if (!used.has(t)) { used.add(t); return t; } } };
    const books = [], fin = [];
    for (let i = 0; i < n; i++) {
      const gi = G.indexOf(pickW(G, GW)), pages = Math.round(Math.min(950, Math.max(110, [320, 400, 540, 340, 430, 330, 420, 300, 360][gi] * Math.exp(.36 * rn())))), au = AU[Math.floor(Math.pow(R(), 1.8) * AU.length)];
      let r = GM[gi] + .6 * Math.exp(-Math.pow((pages - 340) / 80, 2)) - (pages > 620 ? .4 : 0) + .5 * rn(); r = Math.max(1, Math.min(5, Math.round(r * 2) / 2));
      const spanDays = 1000, fdN = todayN - Math.floor(Math.pow(R(), 1.15) * spanDays) - 1, days = Math.max(2, Math.round(pages / (38 * Math.exp(.5 * rn())))) + (R() < .05 ? 60 : 0);
      const th = [...new Set([pick(TH), R() < .6 ? pick(TH) : '', R() < .3 ? pick(TH) : ''].filter(Boolean))];
      const b = mk({ title: title(), author: au, genre: G[gi], type: gi < 5 ? 'Fiction' : 'Non-Fiction', format: 'Book', pages: String(pages), currentPage: String(pages), rating: String(r), favourite: r >= 4.5 && R() < .6 ? 'Yes' : '',
        startDate: isoN(fdN - days), finishDate: isoN(fdN), year: String(R() < .7 ? Math.round(2002 + R() * 24) : Math.round(1850 + R() * 150)), theme1: th[0] || '', theme2: th[1] || '', theme3: th[2] || '', setting: R() < .8 ? pick(CT) : '', awards: R() < .08 ? pick(['Booker', 'Hugo', 'Nebula', 'Pulitzer']) : '' });
      books.push(b); fin.push(b);
    }
    // re-reads: a second finished row of the same book, rated higher, lower or the same
    fin.slice(0, Math.min(30, Math.floor(n / 6))).forEach((b, k) => { const d = [.5, 0, -.5, 1, -1, 0][k % 6], fd = Math.min(todayN - 3, dayN(b.finishDate) + 200 + k * 7); books.push(mk({ title: b.title, author: b.author, genre: b.genre, type: b.type, format: 'Book', pages: b.pages, currentPage: b.pages, rating: String(Math.max(1, Math.min(5, +b.rating + d))), startDate: isoN(fd - 9), finishDate: isoN(fd), year: b.year })); });
    // TBR with added dates, and a few comics
    for (let i = 0; i < Math.max(12, Math.round(n * .4)); i++) { const gi = Math.floor(R() * G.length); books.push(mk({ title: title(), author: pick(AU), status: 'TBR', genre: G[gi], type: 'Fiction', pages: String(150 + Math.floor(R() * 500)), added: isoN(todayN - Math.floor(-Math.log(1 - R() * .97) * 380)), awards: R() < .06 ? pick(['Booker', 'Hugo']) : '' })); }
    state.allBooks.push(...books);
    // reading log: timed app entries for recent finished books, as the app writes them
    let row = 5000;
    fin.filter(b => dayN(b.finishDate) > todayN - 400).forEach(b => {
      const s = dayN(b.startDate), f = dayN(b.finishDate), pg = +b.pages; let left = pg;
      for (let d = s; d <= f; d++) { if (d !== f && R() > .55) continue; const p = d === f ? left : Math.max(1, Math.round(pg / ((f - s) + 1) * (.5 + R()))); left -= p; if (left < 0) left = 0;
        const hr = R() < .5 ? 21 + Math.floor(R() * 2) : R() < .5 ? 7 + Math.floor(R() * 2) : 12 + Math.floor(R() * 6), mm = Math.floor(R() * 60), ds = isoN(d), mins = R() < .4 ? 15 + Math.floor(R() * 70) : 0;
        state.entries.push({ date: ds, pages: Math.max(1, p), bookId: b.id, title: b.title, pageReached: null, source: 'app', loggedAt: `${ds} ${String(hr).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, minutes: mins, _row: row++ }); }
    });
    state.settings.yearBookGoal = state.settings.yearBookGoal || 60;
    readCache.map = null; insDirty = true;
    return { books: state.allBooks.length, entries: state.entries.length };
  }, n);
}
module.exports = { seedInsights };
