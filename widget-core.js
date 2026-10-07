// PLAN70_CORE v3 · vzhled widgetu Plán 70 kg pro Scriptable a zápis jídla ťuknutím
// Tenhle soubor si stahuje krátký skript ve Scriptable (s tvým klíčem) a spouští ho jako tělo funkce.
// Dostane ctx = { KEY, ANON, family, loader, script, mode, params }.
// Na ploše vrátí hotový ListWidget. Po ťuknutí (mode 'app') ukáže nabídku zápisu a vrátí null,
// nebo 'preview', když si člověk chce prohlédnout velikosti widgetu (ty zobrazí krátký skript).
const { KEY, ANON } = ctx;
const family = ctx.family || 'medium';
const API = 'https://djeadsdsmsurjnneiclx.supabase.co/rest/v1/rpc/plan70_today';
const API_W = 'https://djeadsdsmsurjnneiclx.supabase.co/rest/v1/rpc/plan70_widget';
// Ťuknutí spustí tenhle skript ve Scriptable (zápis bez Safari). Starší krátký skript to neumí, tam vede do appky.
const RUN = q => ctx.loader >= 2 && ctx.script ? 'scriptable:///run/' + encodeURIComponent(ctx.script) + (q ? '?' + q : '') : APP + '#dnes';
const APP = 'https://michalkrausino.github.io/gain/';

// ---------- barvy ----------
const C = (h, a) => new Color(h, a == null ? 1 : a);
const DYN = (l, d) => Color.dynamic(l, d);
const BG = DYN(C('#FFFFFF'), C('#1C1C1E'));
const CARD = DYN(C('#F2F2F7'), C('#2C2C2E'));
const LABEL = DYN(C('#000000'), C('#FFFFFF'));
const SUB = DYN(C('#3C3C43', 0.62), C('#EBEBF5', 0.62));
const FAINT = DYN(C('#3C3C43', 0.32), C('#EBEBF5', 0.34));
const ORANGE = C('#FF9500');
const ORANGE_TXT = DYN(C('#C93400'), C('#FF9F0A'));
const GREEN = C('#34C759');
const GREEN_TXT = DYN(C('#248A3D'), C('#30D158'));
const RED_TXT = DYN(C('#D70015'), C('#FF453A'));
const NEXT_BG = DYN(C('#FF9500', 0.13), C('#FF9F0A', 0.2));
const RING = { go: ['#FFC24D', '#FF8A00', '#FF5A1F'], ok: ['#8EE59E', '#34C759', '#1FA846'] };
const SYM = { snidane: 'sunrise.fill', shake: 'cup.and.saucer.fill', obed: 'fork.knife', svacina: 'carrot.fill', turbo: 'bolt.fill', vecere: 'moon.stars.fill' };
const SHORT = { snidane: 'Snídaně', shake: 'Shake', obed: 'Oběd', svacina: 'Svačina', turbo: 'Shake navíc', vecere: 'Večeře' };

// ---------- data ----------
function todayISO() { const d = new Date(); if (d.getHours() < 3) d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
async function load() {
  const r = new Request(API);
  r.method = 'POST';
  r.headers = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'x-plan70-key': KEY, 'Content-Type': 'application/json' };
  r.body = '{}';
  r.timeoutInterval = 15;
  try {
    const j = await r.loadJSON();
    if (j && j.date) { Keychain.set('plan70_today', JSON.stringify(j)); return j; }
    throw new Error('bad response');
  } catch (e) {
    if (!Keychain.contains('plan70_today')) return null;
    const c = JSON.parse(Keychain.get('plan70_today'));
    if (c.date !== todayISO()) return null;
    c.offline = true;
    return c;
  }
}

// ---------- pomocné ----------
const fmt = n => Math.round(n || 0).toLocaleString('cs-CZ').replace(/\s/g, '\u00A0');
const kilo = n => (n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString('cs-CZ') + 'k' : String(Math.round(n)));
const kg1 = n => (Math.round(n * 10) / 10).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hm = t => String(t || '').replace(/^0/, '');
const tmin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return null; const v = +m[1] * 60 + +m[2]; return v < 180 ? v + 1440 : v; }; // po půlnoci do 3:00 pořád tentýž den
const nowMin = () => { const d = new Date(), m = d.getHours() * 60 + d.getMinutes(); return m < 180 ? m + 1440 : m; }; // do 3:00 pokračuje včerejšek, jako v appce
const dateAt = t => { const m = tmin(t), d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(stops, t) {
  t = Math.max(0, Math.min(1, t)); const seg = (stops.length - 1) * t, i = Math.min(stops.length - 2, Math.floor(seg)), f = seg - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return '#' + a.map((x, k) => Math.round(x + (b[k] - x) * f).toString(16).padStart(2, '0')).join('');
}
function text(st, s, font, color, opts = {}) {
  const t = st.addText(s); t.font = font; t.textColor = color;
  if (opts.lines) t.lineLimit = opts.lines; if (opts.scale) t.minimumScaleFactor = opts.scale; if (opts.op != null) t.textOpacity = opts.op;
  return t;
}
function sym(st, name, size, color, weight) {
  const s = SFSymbol.named(name) || SFSymbol.named('circle.fill');
  s.applyFont(weight === 'bold' ? Font.boldSystemFont(size) : Font.semiboldSystemFont(size));
  const i = st.addImage(s.image); i.imageSize = new Size(size, size); i.tintColor = color; return i;
}
function hstack(p, gap) { const s = p.addStack(); s.layoutHorizontally(); s.centerAlignContent(); if (gap) s.spacing = gap; return s; }
function vstack(p, gap, center) { const s = p.addStack(); s.layoutVertically(); if (center) s.centerAlignContent(); if (gap) s.spacing = gap; return s; }

// Prstenec s barevným přechodem a kulatými konci (kreslí se po malých úsecích)
function ring(size, lw, pct, opts = {}) {
  const dc = new DrawContext();
  dc.size = new Size(size, size); dc.opaque = false; dc.respectScreenScale = true;
  const c = size / 2, r = c - lw / 2 - 0.5, N = 160;
  const pt = a => new Point(c + r * Math.cos(a), c + r * Math.sin(a));
  const ang = i => -Math.PI / 2 + (i / N) * 2 * Math.PI;
  const track = new Path(); for (let i = 0; i <= N; i++) i ? track.addLine(pt(ang(i))) : track.move(pt(ang(i)));
  dc.addPath(track); dc.setStrokeColor(opts.track || C('#8E8E93', 0.2)); dc.setLineWidth(lw); dc.strokePath();
  const p = Math.max(0, Math.min(1, pct));
  if (p > 0.001) {
    const stops = opts.mono ? null : (pct >= 1 ? RING.ok : RING.go), segs = Math.max(1, Math.round(N * p));
    const col = t => opts.mono ? opts.mono : C(mix(stops, t));
    for (let i = 0; i < segs; i++) {
      const sp = new Path(); sp.move(pt(ang(i))); sp.addLine(pt(ang(Math.min(segs, i + 1.5))));
      dc.addPath(sp); dc.setStrokeColor(col(i / segs)); dc.setLineWidth(lw); dc.strokePath();
    }
    const cap = (a, color) => { const q = pt(a); dc.setFillColor(color); dc.fillEllipse(new Rect(q.x - lw / 2, q.y - lw / 2, lw, lw)); };
    cap(ang(0), col(0)); cap(ang(segs), col(1));
  }
  return dc.getImage();
}
function bar(w, h, pct, fill, track) {
  const dc = new DrawContext(); dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  const t = new Path(); t.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2); dc.addPath(t); dc.setFillColor(track); dc.fillPath();
  const p = Math.max(0, Math.min(1, pct));
  if (p > 0) { const f = new Path(); f.addRoundedRect(new Rect(0, 0, Math.max(h, w * p), h), h / 2, h / 2); dc.addPath(f); dc.setFillColor(fill); dc.fillPath(); }
  return dc.getImage();
}
function vcenter(st, build) { // svisle i vodorovně vystředěný obsah v kontejneru pevné velikosti
  st.addSpacer();
  const row = st.addStack(); row.layoutHorizontally(); row.addSpacer();
  const col = row.addStack(); col.layoutVertically(); col.centerAlignContent(); build(col);
  row.addSpacer(); st.addSpacer();
}

// ---------- stav dne ----------
const d = await load();
const w = new ListWidget();
w.url = RUN('akce=dnes');
const ok = d && d.hasPlan;
const pct = ok && d.plan ? d.eaten / d.plan : 0;
const done = ok && d.left <= 0;
const meals = ok ? (d.meals || []) : [];
// další jídlo = nejbližší, ne to, co mělo být před 12 hodinami (starší nepotvrzené se potvrdí večer v appce, stejně jako na Dnes)
const nm = nowMin(), soon = m => m && !m.done && !m.skip && (tmin(m.t) == null || tmin(m.t) >= nm - 120);
const nx = ok && !done ? (soon(d.next) ? d.next : meals.find(soon) || null) : null;
const unconf = ok && !done && !nx && meals.some(m => !m.done && !m.skip);
const nxMin = nx ? tmin(nx.t) : null, late = nx && nxMin != null && nm > nxMin + 45;
{ // obnova: v čase dalšího jídla, jinak za 15 minut
  let r = new Date(Date.now() + 15 * 60000);
  if (nx && nxMin != null && nxMin > nm) { const t = dateAt(nx.t); t.setMinutes(t.getMinutes() + 1); if (t < r) r = t; }
  w.refreshAfterDate = r;
}
const accent = done ? GREEN_TXT : ORANGE_TXT;
const slotName = m => m.k === 'turbo' ? 'Shake navíc' : (m.slot || SHORT[m.k] || '');

function whenLine(st, font, color) { // „v 18:00 · za 25 min“
  if (!nx) return;
  if (late) { text(st, 'zpožděné', font, RED_TXT); return; }
  if (nxMin != null && nxMin > nm) {
    text(st, 'za ', font, color);
    const dt = st.addDate(dateAt(nx.t)); dt.applyRelativeStyle(); dt.font = font; dt.textColor = color; dt.lineLimit = 1;
  } else text(st, 'teď', font, ORANGE_TXT);
}

function header(p, right) {
  const h = hstack(p, 4);
  sym(h, 'flame.fill', 11, ORANGE);
  text(h, 'PLÁN 70', Font.heavySystemFont(11), ORANGE_TXT);
  h.addSpacer();
  if (d && d.offline) text(h, 'offline', Font.mediumSystemFont(10), FAINT);
  else if (right) right(h);
  return h;
}

function empty(msgBig, msgSmall) {
  w.backgroundColor = BG; w.setPadding(14, 14, 14, 14);
  header(w);
  w.addSpacer();
  text(w, msgBig, Font.boldRoundedSystemFont(17), LABEL, { lines: 2, scale: 0.8 });
  w.addSpacer(4);
  text(w, msgSmall, Font.systemFont(12), SUB, { lines: 3 });
  w.addSpacer();
}

// časová osa jídel: kolečko se symbolem, hotové plné, další zvýrazněné
function dots(p, size, gap) {
  const row = hstack(p, gap);
  for (const m of meals) {
    const isNext = nx && m.k === nx.k, b = row.addStack();
    b.size = new Size(size, size); b.cornerRadius = size / 2; b.centerAlignContent();
    let tint;
    if (m.done) { b.backgroundColor = done ? GREEN : ORANGE; tint = C('#FFFFFF'); }
    else if (m.skip) { b.backgroundColor = CARD; tint = FAINT; }
    else if (isNext) { b.backgroundColor = NEXT_BG; b.borderColor = late ? C('#FF3B30') : ORANGE; b.borderWidth = 2; tint = late ? RED_TXT : ORANGE_TXT; }
    else { b.backgroundColor = CARD; tint = SUB; }
    b.addSpacer(); sym(b, m.done ? 'checkmark' : m.skip ? 'xmark' : (SYM[m.k] || 'circle.fill'), Math.round(size * (m.done ? 0.42 : 0.46)), tint, m.done ? 'bold' : null); b.addSpacer();
  }
  return row;
}

function smallW() {
  w.backgroundColor = BG; w.setPadding(13, 13, 12, 13);
  header(w, h => text(h, `${Math.round(pct * 100)} %`, Font.semiboldRoundedSystemFont(11), SUB));
  w.addSpacer();
  const row = hstack(w); row.addSpacer();
  const rb = row.addStack(); rb.size = new Size(90, 90); rb.backgroundImage = ring(90, 11, pct); rb.layoutVertically();
  vcenter(rb, col => {
    if (done) { sym(col, 'checkmark', 22, GREEN_TXT, 'bold'); col.addSpacer(2); text(col, 'splněno', Font.semiboldRoundedSystemFont(11), GREEN_TXT); }
    else { text(col, fmt(d.left), Font.boldRoundedSystemFont(22), LABEL, { scale: 0.6, lines: 1 }); text(col, 'kcal chybí', Font.mediumRoundedSystemFont(10), SUB); }
  });
  row.addSpacer();
  w.addSpacer();
  const b = hstack(w, 5);
  if (nx) {
    sym(b, SYM[nx.k] || 'fork.knife', 12, late ? RED_TXT : ORANGE_TXT);
    text(b, SHORT[nx.k] || slotName(nx), Font.semiboldSystemFont(12), LABEL, { lines: 1, scale: 0.8 });
    text(b, hm(nx.t), Font.semiboldRoundedSystemFont(12), late ? RED_TXT : SUB, { lines: 1 });
  } else {
    sym(b, 'trophy.fill', 12, GREEN_TXT);
    text(b, `${d.nDone || 0} z ${d.nMeals || meals.length} jídel`, Font.semiboldSystemFont(12), LABEL);
  }
  b.addSpacer();
}

function bigNumbers(col, compact) {
  text(col, done ? 'DNES SPLNĚNO' : 'DNES CHYBÍ', Font.heavySystemFont(10), accent);
  col.addSpacer(1);
  const big = hstack(col, 3);
  if (done) text(big, fmt(d.eaten), Font.boldRoundedSystemFont(compact ? 24 : 27), LABEL, { scale: 0.7, lines: 1 });
  else text(big, fmt(d.left), Font.boldRoundedSystemFont(compact ? 24 : 27), LABEL, { scale: 0.7, lines: 1 });
  text(big, 'kcal', Font.semiboldRoundedSystemFont(13), SUB);
  text(col, done ? `z plánu ${fmt(d.plan)} kcal` : `snědeno ${fmt(d.eaten)} z ${fmt(d.plan)}`, Font.mediumSystemFont(11), SUB, { lines: 1, scale: 0.85 });
}

function ringWithPct(p, size, lw) {
  const rb = p.addStack(); rb.size = new Size(size, size); rb.backgroundImage = ring(size, lw, pct); rb.layoutVertically();
  vcenter(rb, col => {
    if (done) { sym(col, 'checkmark', Math.round(size * 0.24), GREEN_TXT, 'bold'); }
    else {
      const r = hstack(col, 1);
      text(r, String(Math.min(999, Math.round(pct * 100))), Font.boldRoundedSystemFont(Math.round(size * 0.23)), LABEL);
      text(r, '%', Font.boldRoundedSystemFont(Math.round(size * 0.12)), SUB);
      text(col, 'snědeno', Font.mediumRoundedSystemFont(10), SUB);
    }
  });
  return rb;
}

function nextLine(p) {
  const r = hstack(p, 4);
  if (!nx && unconf) { sym(r, 'checkmark.circle', 11, ORANGE_TXT); text(r, 'Potvrď den v appce', Font.semiboldSystemFont(11), LABEL, { lines: 1 }); r.addSpacer(); return r; }
  if (!nx) { sym(r, 'trophy.fill', 11, GREEN_TXT); text(r, `Všech ${d.nMeals || meals.length} jídel odškrtnuto`, Font.semiboldSystemFont(11), LABEL, { lines: 1 }); r.addSpacer(); return r; }
  text(r, `${hm(nx.t)}`, Font.boldRoundedSystemFont(11), late ? RED_TXT : ORANGE_TXT);
  text(r, nx.n || slotName(nx), Font.semiboldSystemFont(11), LABEL, { lines: 1, scale: 0.85 });
  r.addSpacer();
  return r;
}

function mediumW() {
  w.backgroundColor = BG; w.setPadding(14, 15, 14, 15);
  const main = hstack(w, 14);
  ringWithPct(main, 112, 13);
  const col = vstack(main, 0);
  const top = hstack(col); bigNumbers(vstack(top), true); top.addSpacer();
  if (d.offline) { const o = vstack(top); text(o, 'offline', Font.mediumSystemFont(10), FAINT); }
  col.addSpacer(9);
  const n = meals.length, size = n >= 6 ? 23 : 25;
  dots(col, size, n >= 6 ? 5 : 7);
  col.addSpacer(8);
  nextLine(col);
}

function largeW() {
  w.backgroundColor = BG; w.setPadding(15, 15, 13, 15);
  header(w, h => { if (d.weighedToday === false && nm < 14 * 60) { sym(h, 'scalemass.fill', 10, ORANGE_TXT); text(h, 'zvaž se', Font.semiboldSystemFont(10), ORANGE_TXT); } else text(h, new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' }), Font.mediumSystemFont(10), SUB); });
  w.addSpacer(8);
  const main = hstack(w, 14);
  ringWithPct(main, 88, 11);
  const col = vstack(main, 0); bigNumbers(col, false);
  col.addSpacer(6);
  const prog = hstack(col, 4);
  text(prog, `${d.nDone || 0}/${d.nMeals || meals.length} jídel`, Font.semiboldRoundedSystemFont(11), SUB);
  main.addSpacer();
  w.addSpacer(10);
  const list = vstack(w, 2); list.backgroundColor = CARD; list.cornerRadius = 16; list.setPadding(5, 5, 5, 5);
  for (const m of meals) {
    const isNext = nx && m.k === nx.k, r = hstack(list, 8);
    r.setPadding(2, 5, 2, 8); r.cornerRadius = 10; r.url = RUN('slot=' + m.k);
    if (isNext) r.backgroundColor = NEXT_BG;
    const dot = r.addStack(); dot.size = new Size(20, 20); dot.cornerRadius = 10; dot.centerAlignContent();
    let tint;
    if (m.done) { dot.backgroundColor = done ? GREEN : ORANGE; tint = C('#FFFFFF'); }
    else if (isNext) { dot.backgroundColor = late ? C('#FF3B30') : ORANGE; tint = C('#FFFFFF'); }
    else { dot.backgroundColor = BG; tint = m.skip ? FAINT : SUB; }
    dot.addSpacer(); sym(dot, m.done ? 'checkmark' : m.skip ? 'xmark' : (SYM[m.k] || 'circle.fill'), m.done ? 10 : 11, tint, m.done ? 'bold' : null); dot.addSpacer();
    const tm = r.addStack(); tm.size = new Size(34, 0);
    text(tm, hm(m.t), Font.semiboldRoundedSystemFont(12), isNext ? (late ? RED_TXT : ORANGE_TXT) : SUB);
    const nmT = text(r, m.n || slotName(m), isNext ? Font.semiboldSystemFont(13) : Font.systemFont(13), m.done || m.skip ? SUB : LABEL, { lines: 1, scale: 0.85 });
    if (m.skip) nmT.textOpacity = 0.6;
    r.addSpacer();
    text(r, fmt(m.kcal), Font.mediumRoundedSystemFont(12), m.done ? accent : SUB);
  }
  w.addSpacer();
  // váha
  const start = Number(d.startKg) || 51.5, goal = Number(d.goalKg) || 70, cur = d.kg != null ? Number(d.kg) : null;
  const wr = hstack(w, 6);
  sym(wr, 'scalemass.fill', 11, SUB);
  text(wr, cur != null ? `${kg1(cur)} kg` : 'Zatím bez vážení', Font.semiboldRoundedSystemFont(12), LABEL);
  if (cur != null) text(wr, cur >= start ? `+${kg1(cur - start)} kg` : `${kg1(cur - start)} kg`, Font.semiboldRoundedSystemFont(11), cur >= start ? GREEN_TXT : RED_TXT);
  wr.addSpacer();
  text(wr, `cíl ${kg1(goal).replace(',0', '')} kg`, Font.mediumRoundedSystemFont(11), SUB);
  w.addSpacer(5);
  const bw = 300, frac = cur != null ? (cur - start) / Math.max(0.1, goal - start) : 0;
  const bi = w.addImage(bar(bw, 6, frac, ORANGE, C('#8E8E93', 0.22))); bi.imageSize = new Size(bw, 6);
}

// ---------- zamčená obrazovka ----------
function circularW() {
  w.addAccessoryWidgetBackground = true;
  const rb = w.addStack(); rb.size = new Size(62, 62); rb.backgroundImage = ring(62, 6, ok ? pct : 0, { mono: C('#FFFFFF'), track: C('#FFFFFF', 0.28) }); rb.layoutVertically();
  vcenter(rb, col => {
    if (!ok) { sym(col, 'fork.knife', 14, C('#FFFFFF')); return; }
    if (done) { sym(col, 'checkmark', 18, C('#FFFFFF'), 'bold'); return; }
    sym(col, SYM[(nx || {}).k] || 'fork.knife', 9, C('#FFFFFF', 0.85));
    col.addSpacer(1);
    text(col, kilo(d.left), Font.boldRoundedSystemFont(15), C('#FFFFFF'), { scale: 0.6, lines: 1 });
  });
}
function rectangularW() {
  w.addAccessoryWidgetBackground = true; w.setPadding(6, 9, 6, 9);
  if (!ok) { text(w, 'Plán 70', Font.boldRoundedSystemFont(14), C('#FFFFFF')); text(w, d ? 'Na dnešek není plán' : 'Otevři appku', Font.systemFont(12), C('#FFFFFF', 0.8)); return; }
  const t = hstack(w, 4);
  sym(t, done ? 'checkmark.circle.fill' : 'flame.fill', 12, C('#FFFFFF'));
  text(t, done ? 'Plán splněn' : `Chybí ${fmt(d.left)} kcal`, Font.boldRoundedSystemFont(14), C('#FFFFFF'), { lines: 1, scale: 0.8 });
  t.addSpacer();
  w.addSpacer(4);
  const bi = w.addImage(bar(150, 6, pct, C('#FFFFFF'), C('#FFFFFF', 0.28))); bi.imageSize = new Size(150, 6);
  w.addSpacer(4);
  const b = hstack(w, 3);
  if (nx) {
    sym(b, SYM[nx.k] || 'fork.knife', 10, C('#FFFFFF', 0.85));
    text(b, SHORT[nx.k] || slotName(nx), Font.semiboldSystemFont(12), C('#FFFFFF', 0.9), { lines: 1 });
    if (!late && nxMin > nm) whenLine(b, Font.systemFont(12), C('#FFFFFF', 0.75));
    else text(b, late ? `${hm(nx.t)} · zpožděné` : hm(nx.t), Font.systemFont(12), C('#FFFFFF', 0.75), { lines: 1 });
  } else text(b, `${fmt(d.eaten)} kcal dnes`, Font.semiboldSystemFont(12), C('#FFFFFF', 0.9));
  b.addSpacer();
}
function inlineW() {
  if (!ok) { text(w, 'Plán 70: otevři appku', Font.systemFont(12), C('#FFFFFF')); return; }
  text(w, done ? `Plán splněn · ${fmt(d.eaten)} kcal` : `Chybí ${fmt(d.left)} kcal${nx ? ` · ${(SHORT[nx.k] || slotName(nx)).toLowerCase()} ${hm(nx.t)}` : ''}`, Font.systemFont(12), C('#FFFFFF'));
}

// ---------- ťuknutí: zápis přímo ze Scriptable ----------
async function rpc(akce, slot, frac) {
  const r = new Request(API_W);
  r.method = 'POST';
  r.headers = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' };
  r.body = JSON.stringify({ key: KEY, akce, slot: slot || null, frac: frac == null ? 1 : frac });
  r.timeoutInterval = 15;
  return await r.loadJSON();
}
async function sheet(title, message, acts) { // acts: [[text, hodnota]]
  const a = new Alert(); a.title = title; a.message = message || '';
  for (const [n] of acts) a.addAction(n);
  a.addCancelAction('Zavřít');
  const i = await a.presentSheet();
  return i >= 0 && i < acts.length ? acts[i][1] : null;
}
async function say(title, msg) { const a = new Alert(); a.title = title; a.message = msg || ''; a.addAction('OK'); await a.presentAlert(); }
const PARTS = [[0.75, '¾'], [0.5, '½'], [0.25, '¼']];
function mealMenu(m) {
  const acts = [];
  if (m.done) acts.push(['Zrušit „snědeno“', { akce: 'zrusit', slot: m.k }]);
  else {
    acts.push([`✓ Snědeno celé · ${fmt(m.kcal)} kcal`, { akce: 'snedeno', slot: m.k, frac: 1 }]);
    for (const [f, n] of PARTS) acts.push([`Jen ${n} porce · ${fmt(m.kcal * f)} kcal`, { akce: 'snedeno', slot: m.k, frac: f }]);
    if (!m.skip) acts.push(['Vynechat', { akce: 'vynechat', slot: m.k }]);
  }
  return sheet(`${slotName(m)} · ${hm(m.t)}`, (m.n || '') + (m.boost ? `\nBomba: ${m.boost}` : '') + (m.done ? '\nUž je odškrtnuté.' : ''), acts);
}
async function appMode() {
  const p = ctx.params || {};
  if (!d || d.offline) { await say('Bez spojení', 'Zápis z widgetu potřebuje internet. Zkus to za chvíli, nebo odškrtni jídlo v appce, ta funguje i offline.'); return null; }
  if (!ok) { await say('Dnes bez plánu', 'Otevři appku Plán 70, ať se dnešní plán nahraje na server.'); return null; }
  let pick = null;
  const target = p.slot ? meals.find(m => m.k === p.slot) : null;
  if (target) pick = await mealMenu(target);
  else {
    const open = meals.filter(m => !m.done && !m.skip), others = open.filter(m => !nx || m.k !== nx.k), acts = [];
    if (nx) {
      acts.push([`✓ ${slotName(nx)} snědeno · ${fmt(nx.kcal)} kcal`, { akce: 'snedeno', slot: nx.k, frac: 1 }]);
      acts.push([`Jen část: ${slotName(nx).toLowerCase()}…`, { menu: 'part', m: nx }]);
    }
    if (others.length) acts.push(['Jiné jídlo z plánu…', { menu: 'others' }]);
    if (meals.some(m => m.done)) acts.push(['Opravit odškrtnuté…', { menu: 'fix' }]);
    acts.push(['Shake navíc · ~800 kcal', { akce: 'shake', frac: 1 }], ['½ shaku navíc · ~400 kcal', { akce: 'shake', frac: 0.5 }]);
    acts.push(['Náhled widgetu', { menu: 'preview' }]);
    const title = done ? `Splněno · ${fmt(d.eaten)} kcal` : `Chybí ${fmt(d.left)} kcal`;
    const msg = `Snědeno ${fmt(d.eaten)} z ${fmt(d.plan)} kcal.` + (nx ? ` Další: ${slotName(nx).toLowerCase()} v ${hm(nx.t)}, ${nx.n}.` : '');
    pick = await sheet(title, msg, acts);
    if (pick && pick.menu === 'preview') return 'preview';
    if (pick && pick.menu === 'part') pick = await sheet(`Kolik jsi snědl? ${slotName(pick.m)}`, pick.m.n, PARTS.map(([f, n]) => [`${n} porce · ${fmt(pick.m.kcal * f)} kcal`, { akce: 'snedeno', slot: pick.m.k, frac: f }]));
    else if (pick && (pick.menu === 'others' || pick.menu === 'fix')) {
      const list = pick.menu === 'others' ? others : meals.filter(m => m.done);
      const m = await sheet(pick.menu === 'others' ? 'Které jídlo?' : 'Které opravit?', '', list.map(m => [`${slotName(m)} · ${hm(m.t)} · ${m.n}`, m]));
      pick = m ? await mealMenu(m) : null;
    }
  }
  if (!pick || !pick.akce) return null;
  let res = null;
  try { res = await rpc(pick.akce, pick.slot, pick.frac); } catch (e) { }
  if (!res) { await say('Nezapsáno', 'Server neodpověděl. Zkus to znovu, nebo jídlo odškrtni v appce.'); return null; }
  if (res.ok === false || !res.msg) { await say('Nezapsáno', res.msg || res.message || 'Server zápis odmítl. Zkontroluj klíč v appce: Nastavení → Zkratky a widget.'); return null; }
  if (res.today && res.today.date) Keychain.set('plan70_today', JSON.stringify(res.today));
  await say('Zapsáno', res.msg + '\n\nWidget se obnoví do pár minut.');
  return null;
}
if (ctx.mode === 'app') return await appMode();

if (family === 'accessoryCircular') circularW();
else if (family === 'accessoryRectangular') rectangularW();
else if (family === 'accessoryInline') inlineW();
else if (!d) empty('Bez spojení', 'Widget se obnoví, až bude internet. Klepnutím otevřeš appku.');
else if (!ok) empty('Dnes bez plánu', 'Otevři appku Plán 70, ať se plán nahraje na server.');
else if (family === 'small') smallW();
else if (family === 'large' || family === 'extraLarge') largeW();
else mediumW();
return w;
