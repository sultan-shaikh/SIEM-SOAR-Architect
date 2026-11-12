const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '../public'); const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.csv': 'text/csv' };
let serveBook = true;
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/.netlify/functions/')) { r.setHeader('content-type', 'application/json'); return r.end(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] })); }
  const u = q.url.split('?')[0]; if (u === '/price-book.csv' && !serveBook) { r.statusCode = 404; return r.end(); }
  const f = path.join(root, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); r.end(d); });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port, br = await chromium.launch(), errs = [], res = [];
  const t = (c, m) => { res.push((c ? 'PASS ' : 'FAIL ') + m); };
  const open = async (ctx) => { const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push('PE ' + e.message)); pg.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push('CE ' + m.text())); await pg.goto(url); await pg.fill('#lockInput', 'ok'); await pg.click('#lockForm button'); await pg.waitForSelector('#intro:not([hidden])'); await pg.click('#introStart'); return pg; };
  // 1. no repo file -> placeholder + banner
  serveBook = false; let ctx = await br.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 }); let pg = await open(ctx);
  t(await pg.locator('.pbbanner:not(.ok)').count() === 1, 'first-run banner shown with placeholder rates');
  t(await pg.evaluate(() => window.App.S.st.rateSource) === 'default', 'placeholder rates when no price book');
  t(await pg.locator('[data-vertsel]').count() === 1 && await pg.locator('.vcards').count() === 0, 'industry is a dropdown');
  await pg.selectOption('[data-vertsel]', 'healthcare'); await pg.fill('[data-seats]', '2000');
  t(/NHS|health|patient|clinic/i.test(await pg.textContent('#vertDesc')) || (await pg.textContent('#vertDesc')).length > 10, 'industry description shows');
  // 2. import via modal
  await pg.click('#btnPB'); t(await pg.isVisible('#pbModal'), 'price book modal opens from nav');
  await pg.setInputFiles('#pbFile', path.join(root, 'price-book.csv')); await pg.waitForTimeout(300);
  t(/UK South/.test(await pg.textContent('#pbBody')), 'import shows region UK South');
  await pg.screenshot({ path: '/tmp/pb-modal.png' }); await pg.click('#pbClose');
  t(/UK South/.test(await pg.textContent('#lvFlag')), 'live flag shows region after import');
  t(await pg.locator('.pbbanner.ok').count() === 1, 'banner turns green');
  // 3. persists across reload and new scenario
  await pg.reload(); await pg.waitForTimeout(800);
  t(await pg.evaluate(() => window.App.S.st.priceMeta && window.App.S.st.priceMeta.region) === 'UK South' && await pg.evaluate(() => window.App.PB.source) === 'browser', 'price book persists after reload');
  // 4. region in quote
  await pg.evaluate(() => { document.getElementById('intro').hidden = true; }); await pg.selectOption('[data-vertsel]', 'financial'); await pg.fill('[data-seats]', '3000');
  const html = await pg.evaluate(() => window.App.buildQuoteHtml()); t(/priced for a workspace in UK South/.test(html), 'quote states region'); t(!/DRAFT/.test(html), 'no DRAFT banner with price book');
  // customer mode hides it
  await pg.click('#btnMode'); t(!(await pg.isVisible('#btnPB')), 'price book button hidden in customer view'); t(!/UK South/.test(await pg.textContent('#lvFlag')), 'customer view hides price book name'); await pg.click('#btnMode');
  await pg.screenshot({ path: '/tmp/s1b.png', fullPage: true }); await ctx.close();
  // 5. repo file auto-load on a fresh browser
  serveBook = true; ctx = await br.newContext({ viewport: { width: 1360, height: 900 } }); pg = await open(ctx);
  t(await pg.evaluate(() => window.App.PB.source) === 'repo' && await pg.evaluate(() => window.App.S.st.rateSource) === 'csv', 'repo price-book.csv auto-loads for a new user');
  await pg.click('#btnPB'); t(/managed centrally/.test(await pg.textContent('#pbBody')), 'modal says repo-managed'); await pg.click('#pbClose');
  await pg.selectOption('[data-vertsel]', 'retail'); await pg.fill('[data-seats]', '1500');
  for (let i = 2; i <= 5; i++) { await pg.click('#stepper [data-step="' + i + '"]'); await pg.waitForTimeout(250); if (i === 2) t(await pg.locator('[data-path="p2Pct"]').count() === 1, 'Defender % of use field present'); if (i === 4) { t(await pg.locator('[data-path="lakeUse"]').count() === 1 && await pg.locator('[data-path="lakeFree"]').count() === 1, 'lake usage + free % fields present'); await pg.screenshot({ path: '/tmp/s4b.png', fullPage: true }); } }
  await pg.screenshot({ path: '/tmp/s5b.png', fullPage: true });
  // mobile
  const m = await br.newContext({ viewport: { width: 390, height: 800 } }); const mp = await open(m); await mp.screenshot({ path: '/tmp/mob.png' });
  const ov = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); t(!ov, 'no horizontal scroll on phone');
  console.log(res.join('\n')); console.log('ERRORS:', errs.length ? errs : 'none'); await br.close(); srv.close();
});
