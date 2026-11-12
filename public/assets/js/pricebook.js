/* Sentinel Architect - price book manager: repo file, browser override, region label */
(function () {
'use strict';
const App = window.App, C = App.C, $ = App.$, S = App.S, esc = C.esc;
const KEY = 'sa_pricebook';
const PB = App.PB = { rates: null, meta: null, source: 'default' };
const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const lsSet = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); return true; } catch (e) { return false; } };
const clone = (a) => a.map((x) => Object.assign({}, x));
const today = () => new Date().toISOString().slice(0, 10);

PB.apply = function (r, source, label) { PB.rates = clone(r.rates); PB.source = source; PB.meta = Object.assign({ name: label || 'Price book', region: '', date: '' }, r.meta || {}); if (S.st) PB.applyTo(S.st); };
PB.applyTo = function (st) { if (!PB.rates) return; st.rates = clone(PB.rates); st.rateSource = 'csv'; st.priceMeta = Object.assign({}, PB.meta, { source: PB.source }); };
PB.clear = function () { PB.rates = null; PB.meta = null; PB.source = 'default'; if (S.st) { S.st.rates = C.defaultRates(); S.st.rateSource = 'default'; S.st.priceMeta = null; } };
PB.label = function (st) { const m = (st || S.st).priceMeta; if (!m || (st || S.st).rateSource === 'default') return 'Placeholder rates'; return (m.region ? m.region + ' · ' : '') + (m.name || 'Price book') + (m.date ? ' · ' + m.date : ''); };
PB.short = function (st) { st = st || S.st; const m = st.priceMeta; if (!m || st.rateSource === 'default') return 'placeholder rates'; return (m.region ? m.region + ' price book' : (m.name || 'price book')); };
PB.region = (st) => { const m = (st || S.st).priceMeta; return m && m.region ? m.region : ''; };

PB.load = async function () {
  const local = lsGet();
  if (local && local.csv) { try { const r = C.ratesFromCsv(local.csv); PB.apply(r, 'browser', local.file); return; } catch (e) { lsSet(null); } }
  try { const res = await fetch('price-book.csv', { cache: 'no-store' }); if (res.ok) { const txt = await res.text(); if (/^\s*item\s*,/i.test(txt)) { const r = C.ratesFromCsv(txt); PB.apply(r, 'repo', 'Company price book'); return; } } } catch (e) { /* no repo file: placeholders */ }
};
PB.importText = function (txt, file) { const r = C.ratesFromCsv(txt); if (!r.meta.date) r.meta.date = today(); const saved = lsSet({ csv: txt, file: file || 'imported.csv' }); PB.apply(r, 'browser', file); return { r, saved }; };

const SRCTXT = { repo: 'Loaded from the company price book file (managed centrally).', browser: 'Imported in this browser. It stays here until you reset it.', default: 'No price book loaded. Quotes use placeholder rates and are marked DRAFT.' };
PB.open = function (msg) { PB.render(msg); $('pbModal').hidden = false; const c = $('pbClose'); if (c) c.focus(); };
PB.render = function (msg) {
  const st = S.st, real = st.rateSource !== 'default', m = st.priceMeta || {};
  $('pbBody').innerHTML = '<div class="pbstat ' + (real ? 'ok' : 'warn') + '"><b>' + (real ? '✔ ' + esc(PB.label(st)) : '⚠ Placeholder rates in use') + '</b><span>' + esc(SRCTXT[real ? PB.source : 'default']) + '</span></div>' +
    (msg ? '<p class="small ' + (msg.err ? 'err' : 'ok') + '" style="margin:10px 0 0">' + esc(msg.text) + '</p>' : '') +
    '<ol class="pbsteps"><li><b>Get the template.</b> <button id="pbTpl" class="btn sm" type="button">⬇ Download template (CSV)</button><br><span class="tiny muted">Fill in your Microsoft buy prices (CSP or MACC, in GBP), service packages, onboarding and term discounts. Set <code>PRICE_REGION</code> to the Azure region the prices are for.</span></li>' +
    '<li><b>Import it.</b> <label class="btn sm dark" for="pbFile" style="cursor:pointer">⬆ Import price book</label><input id="pbFile" type="file" accept=".csv,text/csv" hidden><br><span class="tiny muted">Saved in this browser, so it is still there next time and for every new estimate.</span></li>' +
    '<li><b>Share with the team (recommended).</b> <span class="small">Save the CSV as <code>public/price-book.csv</code> in the GitHub repo and push. Every rep then gets it automatically with nothing to import. A browser import overrides it on that machine only.</span></li></ol>' +
    (PB.source === 'browser' && real ? '<button id="pbReset" class="btn sm" type="button">Remove this browser\'s price book</button>' : '') +
    '<p class="tiny muted" style="margin:12px 0 0">Region: ' + (m.region ? '<b>' + esc(m.region) + '</b>. This appears on every quote and deck.' : 'not set in the price book. Add a <code>PRICE_REGION</code> row so quotes state where the prices apply.') + '</p>';
};
function after(msg) { App.recompute(); if (S.step && S.step < 5) App.renderStep(S.step); else if (S.step === 5) App.renderResults(); PB.render(msg); }
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-pbopen]'); if (!t) return;
  if (t.dataset.pbopen != null || t.id === 'btnPB' || t.id === 'lvFlag') { if (S.mode !== 'customer') PB.open(); return; }
  if (t.id === 'pbClose' || t.id === 'pbModal') { $('pbModal').hidden = true; return; }
  if (t.id === 'pbTpl') { App.dl(new Blob([C.ratesToCsv(S.st.rates, S.st.priceMeta)], { type: 'text/csv' }), 'sentinel_price_book.csv'); return; }
  if (t.id === 'pbReset') { lsSet(null); PB.clear(); PB.load().then(() => after({ text: 'Browser price book removed.' })); }
});
$('pbModal').addEventListener('click', (e) => { if (e.target.id === 'pbModal') $('pbModal').hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('pbModal').hidden = true; });
document.addEventListener('change', (e) => {
  if (e.target.id !== 'pbFile') return; const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  f.text().then((txt) => { try { const o = PB.importText(txt, f.name); after({ text: 'Loaded ' + o.r.updated + ' rates from ' + f.name + (o.r.unknown.length ? ' (' + o.r.unknown.length + ' unrecognised rows ignored)' : '') + (o.saved ? '.' : '. Could not save in this browser; it will be lost on reload.') }); } catch (err) { PB.render({ err: true, text: err.message }); } });
});
})();
