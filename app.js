"use strict";

const FORMATS = {
  feed:   { label: "Feed 4:5",   file: "feed-4x5",   w: 1080, h: 1350, safeT: 70,  safeB: 70,  cols: 6, rows: 8 },
  story:  { label: "Stories 9:16", file: "story-9x16", w: 1080, h: 1920, safeT: 250, safeB: 340, cols: 6, rows: 11 },
  reels:  { label: "Reels 9:16", file: "reels-9x16", w: 1080, h: 1920, safeT: 250, safeB: 340, cols: 6, rows: 11 },
};
const FONTS = ["Segoe UI", "Arial", "Arial Black", "Impact", "Georgia", "Trebuchet MS", "Verdana", "Tahoma", "Courier New"];

const TEXT_FIELDS = [
  { k: "brand", l: "Marca / loja", t: "text" },
  { k: "name", l: "Nome do produto", t: "text" },
  { k: "desc", l: "Descrição", t: "area" },
  { k: "oldPrice", l: "Preço antigo (opcional)", t: "money" },
  { k: "price", l: "Preço", t: "money" },
  { k: "cta", l: "Chamada (botão)", t: "text" },
  { k: "link", l: "Link (vira QR code no canto inferior direito)", t: "link" },
];
const STYLE_FIELDS = [
  { k: "font", l: "Fonte", t: "select", o: FONTS.map(f => [f, f]) },
  { k: "bgAngle", l: "Ângulo do degradê", t: "range", min: 0, max: 360, step: 1 },
  { k: "textColor", l: "Cor do texto", t: "color" },
  { k: "accent", l: "Cor de destaque (preço/botão)", t: "color" },
  { k: "ctaText", l: "Cor do texto do botão", t: "color" },
  { k: "align", l: "Alinhamento", t: "select", o: [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]] },
  { k: "nameSize", l: "Tamanho do nome", t: "range", min: 30, max: 180, step: 1 },
  { k: "descSize", l: "Tamanho da descrição", t: "range", min: 20, max: 80, step: 1 },
  { k: "priceSize", l: "Tamanho do preço", t: "range", min: 40, max: 240, step: 1 },
  { k: "imgPos", l: "Foto do produto", t: "select", o: [["top", "Acima do texto"], ["bottom", "Abaixo do texto"]] },
  { k: "imgScale", l: "Escala da foto", t: "range", min: 0.3, max: 1.8, step: 0.01 },
  { k: "imgY", l: "Deslocar foto (vertical)", t: "range", min: -500, max: 500, step: 1 },
  { k: "imgX", l: "Deslocar foto (horizontal)", t: "range", min: -540, max: 540, step: 1 },
  { k: "shadow", l: "Sombra na foto", t: "check" },
];

const DEFAULT_SHARED = {
  brand: "MINHA LOJA", name: "Nome do produto", desc: "Uma descrição curta e persuasiva do seu produto.",
  oldPrice: "", price: "R$ 99,90", cta: "Compre agora", link: "", productImg: null,
  font: "Segoe UI", stops: [{ c: "#1b1464" }, { c: "#e1306c" }], extras: [], tAlign: {}, bgAngle: 160, textColor: "#ffffff", accent: "#ffd400", ctaText: "#1a1a1a",
  align: "center", nameSize: 84, descSize: 38, priceSize: 130, imgPos: "top", imgScale: 1, imgY: 0, imgX: 0, shadow: true,
};

const $ = s => document.querySelector(s);
let state = fresh();
let adId = null, dirty = false;
let selItem = null, selText = null, hits = [];
const view = { grid: true, safe: false };

function fresh() {
  const formats = {};
  for (const k in FORMATS) formats[k] = { cols: FORMATS[k].cols, rows: FORMATS[k].rows, over: {}, items: [] };
  return { shared: { ...DEFAULT_SHARED }, formats, active: "feed", scope: "all" };
}
function normalize(s) {
  s.shared = { ...DEFAULT_SHARED, ...s.shared };
  const mig = o => { if (!o.stops && (o.bg1 || o.bg2)) o.stops = [{ c: o.bg1 || DEFAULT_SHARED.stops[0].c }, { c: o.bg2 || DEFAULT_SHARED.stops[1].c }]; delete o.bg1; delete o.bg2; };
  mig(s.shared);
  s.formats = s.formats || {};
  for (const k in FORMATS) s.formats[k] = { cols: FORMATS[k].cols, rows: FORMATS[k].rows, over: {}, items: [], ...s.formats[k] };
  for (const k in FORMATS) mig(s.formats[k].over);
  s.active = s.active in FORMATS ? s.active : "feed"; s.scope = s.scope || "all";
  return s;
}

/* ---------- Lista de anúncios salvos ---------- */
const ADS_KEY = "gerart-ads";
function readAds() { try { return JSON.parse(localStorage.getItem(ADS_KEY)) || []; } catch { return []; } }
function migrateLegacy() {
  if (localStorage.getItem(ADS_KEY) !== null) return;
  const raw = localStorage.getItem("gerart-state"); if (!raw) return;
  try {
    localStorage.setItem(ADS_KEY, JSON.stringify([{ id: crypto.randomUUID(), updated: Date.now(), state: JSON.parse(raw) }]));
    localStorage.removeItem("gerart-state");
  } catch { }
}
let saveT;
function flushSave() {
  clearTimeout(saveT);
  if (!adId || !dirty) return;
  const ads = readAds(), rec = { id: adId, updated: Date.now(), state };
  const i = ads.findIndex(a => a.id === adId);
  if (i < 0) ads.unshift(rec); else ads[i] = rec;
  try { localStorage.setItem(ADS_KEY, JSON.stringify(ads)); dirty = false; }
  catch { alert("Não foi possível salvar: o armazenamento do navegador está cheio."); }
}
function save() { dirty = true; clearTimeout(saveT); saveT = setTimeout(flushSave, 200); }
addEventListener("pagehide", flushSave);

const cur = () => state.formats[state.active];
const get = (fk, k) => (k in state.formats[fk].over ? state.formats[fk].over[k] : state.shared[k]);

/* ---------- IndexedDB (biblioteca de imagens) ---------- */
let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("gerart", 2);
    r.onupgradeneeded = () => {
      for (const n of ["images", "pngs"]) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
async function tx(mode, fn, store = "images") {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error);
  });
}
const idbAll = () => tx("readonly", s => s.getAll());
const idbPut = v => tx("readwrite", s => s.put(v));
const idbDel = id => tx("readwrite", s => s.delete(id));

let library = [];            // {id,name,blob,url}
const imgCache = new Map();  // id -> HTMLImageElement
function loadImg(id) {
  if (imgCache.has(id)) return imgCache.get(id).ready;
  const rec = library.find(l => l.id === id);
  if (!rec) return Promise.resolve(null);
  const img = new Image();
  img.ready = new Promise(r => { img.onload = () => { img.loaded = true; r(img); draw(); }; img.onerror = () => r(null); });
  img.src = rec.url;
  imgCache.set(id, img);
  return img.ready;
}
const imgOf = id => { if (!id) return null; if (!imgCache.has(id)) loadImg(id); const i = imgCache.get(id); return i && i.loaded ? i : null; };

async function addFiles(files) {
  const added = [];
  for (const f of files) {
    const rec = { id: crypto.randomUUID(), name: f.name, blob: f, orig: null, noBg: false };
    await idbPut({ id: rec.id, name: rec.name, blob: rec.blob, orig: null, noBg: false });
    rec.url = URL.createObjectURL(f);
    library.push(rec); added.push(rec);
  }
  renderLibrary();
  return added;
}

let bgLib;
async function toggleBg(rec) {
  if (rec.busy) return;
  rec.busy = true; refreshBgUi();
  try {
    if (rec.noBg) { rec.blob = rec.orig; rec.noBg = false; }
    else {
      bgLib = bgLib || import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm");
      const { removeBackground } = await bgLib;
      const src = rec.orig || rec.blob;
      const out = await removeBackground(src, { output: { format: "image/png" } });
      rec.orig = src; rec.blob = out; rec.noBg = true;
    }
    URL.revokeObjectURL(rec.url); rec.url = URL.createObjectURL(rec.blob);
    imgCache.delete(rec.id);
    await idbPut({ id: rec.id, name: rec.name, blob: rec.blob, orig: rec.orig, noBg: rec.noBg });
  } catch (e) {
    console.error(e); bgLib = null;
    alert("Não foi possível remover o fundo. Verifique a conexão com a internet (o modelo é baixado na primeira vez) e tente novamente.");
  } finally { rec.busy = false; refreshBgUi(); scheduleDraw(); }
}
function bgButton(rec, cls) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "bgbtn " + (cls || "");
  b.disabled = !!rec.busy;
  b.textContent = rec.busy ? "Processando..." : rec.noBg ? "Restaurar fundo" : "Remover fundo";
  b.title = rec.noBg ? "Voltar à imagem original" : "Remover o fundo desta imagem";
  b.onclick = e => { e.stopPropagation(); toggleBg(rec); };
  return b;
}
function refreshBgUi() { renderLibrary(); renderItems(); renderProductBg(); }
function renderProductBg() {
  const host = $("#productBg"); host.innerHTML = "";
  const rec = library.find(l => l.id === state.shared.productImg);
  if (rec) host.appendChild(bgButton(rec, "wide"));
}

/* ---------- Renderização ---------- */
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
  }
  return lines.filter((l, i, a) => l || a.length === 1);
}
function drawFit(ctx, img, x, y, w, h, fit, rot) {
  const s = fit === "cover" ? Math.max(w / img.width, h / img.height) : fit === "stretch" ? 0 : Math.min(w / img.width, h / img.height);
  ctx.save();
  // só recorta ao preencher; assim imagens giradas não perdem as pontas
  if (fit === "cover") { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  if (fit === "stretch") ctx.drawImage(img, x, y, w, h);
  else { const dw = img.width * s, dh = img.height * s; ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
  ctx.restore();
}

function draw(opts) {
  if (opts === undefined || opts instanceof Event) { scheduleDraw(); return; }
  paint(opts.ctx, opts.key, opts.overlay);
}
let barSig = "";
function getAl(key) {
  if (key[0] === "x") return (get(state.active, "extras")[+key.slice(1)] || {}).align || "";
  return (get(state.active, "tAlign") || {})[key] || "";
}
function setAl(key, val) {
  if (key[0] === "x") { const a = clone(get(state.active, "extras")); if (!a[+key.slice(1)]) return; if (val) a[+key.slice(1)].align = val; else delete a[+key.slice(1)].align; setVal("extras", a); }
  else { const t = clone(get(state.active, "tAlign") || {}); if (val) t[key] = val; else delete t[key]; setVal("tAlign", t); }
}
function updateBar() {
  const sel = $("#alignSel"), bar = $("#alignBar");
  const sig = hits.map(h => h.key + h.label).join("|");
  if (sig !== barSig) {
    barSig = sig;
    let n = 0;
    sel.innerHTML = '<option value="">Escolha um elemento…</option>' + hits.map(h => `<option value="${h.key}">${h.key[0] === "x" ? "Texto extra " + (++n) : h.label}</option>`).join("");
  }
  if (selText && !hits.some(h => h.key === selText)) selText = null;
  sel.value = selText || "";
  const cur_ = selText ? getAl(selText) : "";
  bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", !!selText && b.dataset.a === cur_));
  bar.classList.toggle("off", !selText);
}
function initAlignBar() {
  $("#alignSel").onchange = e => { selText = e.target.value || null; scheduleDraw(); };
  $("#alignBar").querySelectorAll("button").forEach(b => b.onclick = () => { if (selText) { setAl(selText, b.dataset.a); } });
}
let raf;
function scheduleDraw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint($("#cv").getContext("2d"), state.active, true); updateBar(); }); }

const qrCache = new Map();
function qrMatrix(text) {
  if (qrCache.has(text)) return qrCache.get(text);
  let m = null;
  try {
    const q = qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(); m = [];
    for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
  } catch { m = null; }
  qrCache.set(text, m);
  return m;
}
function drawQr(ctx, m, x, y, size) {
  const pad = 14, n = m.length, cell = (size - 2 * pad) / n;
  ctx.save();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x, y, size, size, 16); ctx.fill();
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (m[r][c]) ctx.fillRect(x + pad + c * cell, y + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
  ctx.restore();
}

function paint(ctx, fk, overlay) {
  const F = FORMATS[fk], W = F.w, H = F.h, fs = state.formats[fk], v = k => get(fk, k);
  const font = v("font");
  ctx.clearRect(0, 0, W, H);

  const a = v("bgAngle") * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), r = Math.abs(W * dx) / 2 + Math.abs(H * dy) / 2;
  const g = ctx.createLinearGradient(W / 2 - dx * r, H / 2 - dy * r, W / 2 + dx * r, H / 2 + dy * r);
  const stops = v("stops");
  stops.forEach((s, i) => g.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, s.c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const cw = W / fs.cols, ch = H / fs.rows;
  const drawItems = layer => {
    for (const it of fs.items) {
      if (it.layer !== layer) continue;
      const img = imgOf(it.imgId); if (!img) continue;
      const ix = (it.col - 1) * cw, iy = (it.row - 1) * ch, iw = it.cs * cw, ih = it.rs * ch;
      ctx.save();
      ctx.globalAlpha = it.opacity;
      ctx.translate(ix + iw / 2, iy + ih / 2);
      ctx.rotate((it.rot || 0) * Math.PI / 180);
      if (it.flip) ctx.scale(-1, 1);
      drawFit(ctx, img, -iw / 2, -ih / 2, iw, ih, it.fit, it.rot);
      ctx.restore();
    }
  };
  drawItems("back");

  // conteúdo
  const m = 80, maxW = W - 2 * m, align = v("align"), tAl = v("tAlign") || {};
  const al = k => tAl[k] || align;
  const axOf = a => a === "left" ? m : a === "right" ? W - m : W / 2;
  const ax = axOf(align);
  const hit = (key, label, a, w, y0, h) => {
    if (!overlay) return;
    const x = a === "left" ? m : a === "right" ? W - m - w : (W - w) / 2;
    hits.push({ key, label, x, y: y0, w, h });
  };
  if (overlay) hits = [];
  ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  let top = F.safeT, bottom = H - F.safeB;

  if (v("brand")) {
    ctx.font = `700 40px "${font}"`; ctx.fillStyle = v("textColor");
    if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
    const a = al("brand"), bt = v("brand").toUpperCase();
    ctx.textAlign = a; ctx.fillText(bt, axOf(a), top + 40);
    hit("brand", "Marca / loja", a, Math.min(maxW, ctx.measureText(bt).width), top, 50);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    top += 90;
  }
  const link = String(v("link") || "").trim(), qr = link ? qrMatrix(link) : null;
  if (v("cta")) {
    ctx.font = `700 46px "${font}"`;
    const bw = Math.min(maxW, ctx.measureText(v("cta")).width + 140), bh = 110;
    const ca = al("cta"), bx = ca === "left" ? m : ca === "right" ? W - m - bw : (W - bw) / 2, by = bottom - bh;
    ctx.fillStyle = v("accent"); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 55); ctx.fill();
    ctx.fillStyle = v("ctaText"); ctx.textAlign = "center"; ctx.fillText(v("cta"), bx + bw / 2, by + bh / 2 + 16); ctx.textAlign = align;
    hit("cta", "Chamada (botão)", ca, bw, by, bh);
    bottom = by - 40;
  }
  // blocos de texto
  const ns = v("nameSize"), ds = v("descSize"), ps = v("priceSize");
  ctx.font = `800 ${ns}px "${font}"`; const nameL = v("name") ? wrap(ctx, v("name"), maxW) : [];
  ctx.font = `400 ${ds}px "${font}"`; const descL = v("desc") ? wrap(ctx, v("desc"), maxW) : [];
  const extras = (v("extras") || []).map((e, i) => ({ e, i })).filter(o => o.e.text).map(({ e, i }) => {
    ctx.font = `600 ${e.size}px "${font}"`;
    return { e, i, lines: wrap(ctx, e.text, maxW) };
  });
  const extraH = extras.reduce((s, x) => s + 16 + x.lines.length * x.e.size * 1.3, 0);
  const nameH = nameL.length * ns * 1.1, descH = descL.length * ds * 1.35;
  const textH = nameH + (nameH && descH ? 20 : 0) + descH + extraH;
  const hasPrice = !!v("price"), oldS = ps * 0.38;
  const priceH = hasPrice ? ps * 1.05 : 0;
  const lowerH = textH + (textH && priceH ? 30 : 0) + priceH;

  const imgH = Math.max(200, bottom - top - lowerH - 40);
  const imgTop = v("imgPos") === "top" ? top : top + lowerH + 40;
  const textTop = v("imgPos") === "top" ? top + imgH + 40 : top;

  const pimg = imgOf(state.shared.productImg);
  const sc = v("imgScale");
  const bx = m, bw = maxW, ih = imgH * sc, iw = bw * sc;
  const ix = bx + (bw - iw) / 2 + v("imgX"), iy = imgTop + (imgH - ih) / 2 + v("imgY");
  if (pimg) {
    ctx.save();
    if (v("shadow")) { ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 25; }
    const s = Math.min(iw / pimg.width, ih / pimg.height);
    ctx.drawImage(pimg, ix + (iw - pimg.width * s) / 2, iy + (ih - pimg.height * s) / 2, pimg.width * s, pimg.height * s);
    ctx.restore();
  } else if (overlay) {
    ctx.save(); ctx.strokeStyle = "#fff8"; ctx.setLineDash([16, 12]); ctx.lineWidth = 3; ctx.strokeRect(ix, iy, iw, ih);
    ctx.fillStyle = "#fffa"; ctx.textAlign = "center"; ctx.font = `600 36px "${font}"`; ctx.fillText("Foto do produto", ix + iw / 2, iy + ih / 2); ctx.restore();
  }

  drawItems("front");
  if (qr) { const QR = 150, mg = 36; drawQr(ctx, qr, W - mg - QR, H - mg - QR, QR); }

  ctx.fillStyle = v("textColor");
  let y = textTop;
  const lw = lines => Math.min(maxW, Math.max(0, ...lines.map(l => ctx.measureText(l).width)));
  const na = al("name"), da = al("desc");
  ctx.font = `800 ${ns}px "${font}"`; ctx.textAlign = na; const ny = y;
  for (const l of nameL) { y += ns * 1.1; ctx.fillText(l, axOf(na), y - ns * 0.2); }
  if (nameL.length) hit("name", "Nome do produto", na, lw(nameL), ny, y - ny);
  if (nameH && descH) y += 20;
  ctx.font = `400 ${ds}px "${font}"`; ctx.globalAlpha = 0.9; ctx.textAlign = da; const dy0 = y;
  for (const l of descL) { y += ds * 1.35; ctx.fillText(l, axOf(da), y - ds * 0.3); }
  ctx.globalAlpha = 1;
  if (descL.length) hit("desc", "Descrição", da, lw(descL), dy0, y - dy0);
  for (const x of extras) {
    const xa = x.e.align || align;
    y += 16; ctx.font = `600 ${x.e.size}px "${font}"`; ctx.fillStyle = x.e.color; ctx.textAlign = xa; const ey = y;
    for (const l of x.lines) { y += x.e.size * 1.3; ctx.fillText(l, axOf(xa), y - x.e.size * 0.3); }
    hit("x" + x.i, "Texto extra", xa, lw(x.lines), ey, y - ey);
  }
  ctx.fillStyle = v("textColor");
  if (textH && priceH) y += 30;
  if (hasPrice) {
    const old = v("oldPrice"), gap = 28;
    ctx.font = `800 ${ps}px "${font}"`;
    const pw = ctx.measureText(v("price")).width;
    let os = oldS;
    if (old) {
      ctx.font = `400 ${os}px "${font}"`;
      const room = maxW - pw - gap, ow = ctx.measureText(old).width;
      if (ow > room) os = Math.max(14, os * Math.max(room, 1) / ow);
      ctx.font = `400 ${os}px "${font}"`;
    }
    const ow = old ? ctx.measureText(old).width : 0, total = pw + (old ? ow + gap : 0);
    const pa = al("price"), pax = axOf(pa);
    const sx = pa === "left" ? pax : pa === "right" ? pax - total : pax - total / 2;
    hit("price", "Preço", pa, Math.min(maxW, total), y, ps * 1.05);
    y += ps * 1.05;
    const base = y - ps * 0.15;
    ctx.textAlign = "left";
    if (old) {
      ctx.font = `400 ${os}px "${font}"`; ctx.fillStyle = v("textColor"); ctx.globalAlpha = 0.75;
      ctx.fillText(old, sx, base);
      ctx.fillRect(sx, base - os * 0.32, ow, Math.max(3, os * 0.07)); ctx.globalAlpha = 1;
    }
    ctx.font = `800 ${ps}px "${font}"`; ctx.fillStyle = v("accent");
    ctx.fillText(v("price"), sx + (old ? ow + gap : 0), base);
    ctx.textAlign = align;
  }

  if (overlay) {
    const sh = hits.find(h => h.key === selText);
    if (sh) { ctx.save(); ctx.strokeStyle = "#e1306c"; ctx.lineWidth = 4; ctx.setLineDash([14, 8]); ctx.strokeRect(sh.x - 10, sh.y - 6, sh.w + 20, sh.h + 12); ctx.restore(); }
    if (view.safe) {
      ctx.fillStyle = "rgba(255,0,0,.18)";
      ctx.fillRect(0, 0, W, F.safeT); ctx.fillRect(0, H - F.safeB, W, F.safeB);
    }
    if (view.grid) {
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.setLineDash([10, 8]);
      ctx.beginPath();
      for (let i = 1; i < fs.cols; i++) { ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, H); }
      for (let j = 1; j < fs.rows; j++) { ctx.moveTo(0, j * ch); ctx.lineTo(W, j * ch); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "600 20px Arial"; ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,.7)";
      for (let i = 0; i < fs.cols; i++) for (let j = 0; j < fs.rows; j++) ctx.fillText(`${i + 1}×${j + 1}`, i * cw + 6, j * ch + 22);
    }
    const it = fs.items.find(i => i.id === selItem);
    if (it) { ctx.strokeStyle = "#e1306c"; ctx.lineWidth = 6; ctx.strokeRect((it.col - 1) * cw, (it.row - 1) * ch, it.cs * cw, it.rs * ch); }
  }
}

/* ---------- UI ---------- */
function buildFields(host, list) {
  host.innerHTML = "";
  for (const f of list) {
    const d = document.createElement("div"); d.className = "field"; d.dataset.k = f.k;
    let ctl;
    if (f.t === "area") ctl = '<textarea></textarea>';
    else if (f.t === "money") ctl = '<input type="text" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off">';
    else if (f.t === "link") ctl = '<div class="row"><input type="text" placeholder="https://seusite.com/produto" inputmode="url"><button type="button" class="copy small">Copiar</button></div>';
    else if (f.t === "select") ctl = `<select>${f.o.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`;
    else if (f.t === "range") ctl = `<input type="range" min="${f.min}" max="${f.max}" step="${f.step}">`;
    else if (f.t === "check") ctl = '<input type="checkbox">';
    else ctl = `<input type="${f.t}">`;
    d.innerHTML = `<div class="lbl"><span>${f.l}</span><button class="ov" title="Voltar ao padrão (todos)"></button></div>${ctl}`;
    const el = d.querySelector("textarea,select,input");
    const on = () => {
      if (f.t === "money") {
        el.value = formatMoney(el.value);
        el.setSelectionRange(el.value.length, el.value.length);
      }
      const val = f.t === "check" ? el.checked : f.t === "range" ? +el.value : el.value;
      setVal(f.k, val);
    };
    el.addEventListener("input", on); el.addEventListener("change", on);
    d.querySelector(".ov").onclick = e => { e.preventDefault(); delete cur().over[f.k]; syncFields(); scheduleDraw(); save(); };
    const copy = d.querySelector(".copy");
    if (copy) copy.onclick = async () => {
      const text = el.value.trim(); if (!text) { el.focus(); return; }
      try { await navigator.clipboard.writeText(text); } catch { el.select(); document.execCommand("copy"); }
      copy.textContent = "Copiado!"; setTimeout(() => copy.textContent = "Copiar", 1500);
    };
    host.appendChild(d);
  }
}
function formatMoney(raw) {
  const digits = String(raw).replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const int = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${int},${cents.slice(-2)}`;
}
function setVal(k, val) {
  if (state.scope === "this") cur().over[k] = val;
  else { state.shared[k] = val; delete cur().over[k]; }
  refreshOverride(); scheduleDraw(); save();
}
const clone = v => JSON.parse(JSON.stringify(v));

function blockHead(title, addTitle) {
  return `<div class="lbl"><span>${title}</span><span class="row"><button class="ov" title="Voltar ao padrão (todos)"></button><button class="plus" title="${addTitle}">+</button></span></div><div class="list"></div>`;
}
function renderStops() {
  const box = $("#stopsBox"), stops = get(state.active, "stops");
  box.innerHTML = blockHead("Cores do degradê", "Adicionar cor");
  const list = box.querySelector(".list");
  stops.forEach((s, i) => {
    const r = document.createElement("div"); r.className = "lrow";
    r.innerHTML = `<input type="color" value="${s.c}"><button class="x" title="Remover cor"${stops.length <= 1 ? " disabled" : ""}>✕</button>`;
    r.querySelector("input").oninput = e => { const a = clone(get(state.active, "stops")); a[i].c = e.target.value; setVal("stops", a); };
    r.querySelector(".x").onclick = () => { const a = clone(get(state.active, "stops")); a.splice(i, 1); setVal("stops", a); renderStops(); };
    list.appendChild(r);
  });
  box.querySelector(".plus").onclick = () => {
    const a = clone(get(state.active, "stops")); a.push({ c: a[a.length - 1].c }); setVal("stops", a); renderStops();
  };
  box.querySelector(".ov").onclick = () => { delete cur().over.stops; renderStops(); scheduleDraw(); refreshOverride(); save(); };
}
function renderExtras() {
  const box = $("#extrasBox"), extras = get(state.active, "extras");
  box.innerHTML = blockHead("Textos extras", "Adicionar campo de texto");
  const list = box.querySelector(".list");
  extras.forEach((x, i) => {
    const r = document.createElement("div"); r.className = "lrow extra";
    r.innerHTML = `<input type="text" class="t" placeholder="Texto" value=""><input type="number" class="s" min="16" max="200" title="Tamanho" value="${x.size}"><input type="color" class="c" title="Cor" value="${x.color}"><button class="x" title="Remover texto">✕</button>`;
    r.querySelector(".t").value = x.text;
    const upd = (p, val) => { const a = clone(get(state.active, "extras")); a[i][p] = val; setVal("extras", a); };
    r.querySelector(".t").oninput = e => upd("text", e.target.value);
    r.querySelector(".s").oninput = e => { const n = +e.target.value; if (n >= 16 && n <= 200) upd("size", n); };
    r.querySelector(".c").oninput = e => upd("color", e.target.value);
    r.querySelector(".x").onclick = () => { const a = clone(get(state.active, "extras")); a.splice(i, 1); setVal("extras", a); renderExtras(); };
    list.appendChild(r);
  });
  box.querySelector(".plus").onclick = () => {
    const a = clone(get(state.active, "extras")); a.push({ text: "Novo texto", size: 44, color: get(state.active, "textColor") });
    setVal("extras", a); renderExtras();
  };
  box.querySelector(".ov").onclick = () => { delete cur().over.extras; renderExtras(); scheduleDraw(); refreshOverride(); save(); };
}
function syncFields() {
  renderStops(); renderExtras();
  document.querySelectorAll(".field[data-k]").forEach(d => {
    const el = d.querySelector("textarea,select,input"), val = get(state.active, d.dataset.k);
    if (el.type === "checkbox") el.checked = !!val; else el.value = val;
  });
  refreshOverride();
}
function refreshOverride() {
  document.querySelectorAll(".field[data-k],.block[data-k]").forEach(d => d.classList.toggle("over", d.dataset.k in cur().over));
}

function renderTabs() {
  $("#tabs").innerHTML = "";
  for (const k in FORMATS) {
    const b = document.createElement("button"); b.textContent = FORMATS[k].label; b.className = k === state.active ? "on" : "";
    b.onclick = () => { state.active = k; selItem = null; renderAll(); save(); };
    $("#tabs").appendChild(b);
  }
}
function renderLibrary() {
  const host = $("#library"); host.innerHTML = "";
  for (const rec of library) {
    if (rec.id === state.shared.productImg) continue;
    const t = document.createElement("div"); t.className = "thumb"; t.title = rec.name;
    t.innerHTML = `<img src="${rec.url}"><button class="x" title="Excluir da biblioteca">×</button>`;
    t.appendChild(bgButton(rec, "thumbbg"));
    t.onclick = () => addItem(rec.id);
    t.querySelector(".x").onclick = async e => {
      e.stopPropagation();
      if (!confirm("Excluir esta imagem da biblioteca e de todos os formatos?")) return;
      await idbDel(rec.id); library = library.filter(l => l !== rec); imgCache.delete(rec.id);
      for (const k in state.formats) state.formats[k].items = state.formats[k].items.filter(i => i.imgId !== rec.id);
      renderLibrary(); renderItems(); scheduleDraw(); save();
    };
    host.appendChild(t);
  }
}
function addItem(imgId) {
  const fs = cur(), id = crypto.randomUUID();
  fs.items.push({ id, imgId, col: 1, row: 1, cs: Math.min(2, fs.cols), rs: Math.min(2, fs.rows), layer: "front", fit: "contain", opacity: 1 });
  selItem = id; renderItems(); scheduleDraw(); save();
}
function renderItems() {
  const host = $("#items"), fs = cur(); host.innerHTML = "";
  for (const it of fs.items) {
    const rec = library.find(l => l.id === it.imgId);
    const d = document.createElement("div"); d.className = "item" + (it.id === selItem ? " sel" : "");
    d.innerHTML = `<div class="head"><img src="${rec ? rec.url : ""}"><strong style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rec ? rec.name : "(removida)"}</strong><button class="x del" title="Remover">✕</button></div>
      <div class="grid">
        <label>Coluna<input type="number" data-p="col" min="1" max="${fs.cols}" value="${it.col}"></label>
        <label>Linha<input type="number" data-p="row" min="1" max="${fs.rows}" value="${it.row}"></label>
        <label>Larg. (col.)<input type="number" data-p="cs" min="1" max="${fs.cols}" value="${it.cs}"></label>
        <label>Alt. (lin.)<input type="number" data-p="rs" min="1" max="${fs.rows}" value="${it.rs}"></label>
      </div>
      <div class="grid2">
        <label>Camada<select data-p="layer"><option value="back"${it.layer === "back" ? " selected" : ""}>Atrás do conteúdo</option><option value="front"${it.layer === "front" ? " selected" : ""}>À frente</option></select></label>
        <label>Ajuste<select data-p="fit"><option value="contain"${it.fit === "contain" ? " selected" : ""}>Conter</option><option value="cover"${it.fit === "cover" ? " selected" : ""}>Preencher</option><option value="stretch"${it.fit === "stretch" ? " selected" : ""}>Esticar</option></select></label>
        <label>Opacidade<input type="range" data-p="opacity" min="0.05" max="1" step="0.05" value="${it.opacity}"></label>
      </div>
      <div class="grid2">
        <label>Rotação (°)<input type="number" data-p="rot" min="-360" max="360" step="1" value="${it.rot || 0}"></label>
        <label style="grid-column:span 2">Girar<input type="range" data-p="rot" min="-180" max="180" step="1" value="${it.rot || 0}"></label>
        <label><input type="checkbox" data-p="flip"${it.flip ? " checked" : ""} style="width:auto"> Espelhar</label>
      </div>`;
    d.querySelector(".head").insertBefore(rec ? bgButton(rec, "small") : document.createTextNode(""), d.querySelector(".del"));
    d.onclick = () => { if (selItem !== it.id) { selItem = it.id; renderItems(); scheduleDraw(); } };
    d.querySelector(".del").onclick = e => { e.stopPropagation(); fs.items = fs.items.filter(i => i !== it); renderItems(); scheduleDraw(); save(); };
    d.querySelectorAll("[data-p]").forEach(el => el.addEventListener("input", () => {
      const p = el.dataset.p;
      if (p === "rot") {
        it.rot = +el.value || 0;
        d.querySelectorAll('[data-p="rot"]').forEach(o => { if (o !== el) o.value = it.rot; });
      } else if (p === "flip") it.flip = el.checked;
      else if (el.type === "number") {
        let n = Math.round(+el.value); if (!n) return;
        const max = p === "col" || p === "cs" ? fs.cols : fs.rows; it[p] = Math.max(1, Math.min(max, n));
      } else it[p] = p === "opacity" ? +el.value : el.value;
      scheduleDraw(); save();
    }));
    host.appendChild(d);
  }
}

function fitCanvas() {
  const cv = $("#cv"), wrap = cv.parentElement, F = FORMATS[state.active];
  const s = Math.min((wrap.clientWidth - 10) / F.w, (wrap.clientHeight - 10) / F.h);
  cv.style.width = F.w * s + "px"; cv.style.height = F.h * s + "px";
}
function renderAll() {
  const F = FORMATS[state.active], cv = $("#cv");
  cv.width = F.w; cv.height = F.h; fitCanvas();
  $("#fmtName").textContent = F.label;
  $("#info").textContent = `${F.w}×${F.h}px`;
  $("#gCols").value = cur().cols; $("#gRows").value = cur().rows;
  document.querySelector(`input[name=scope][value=${state.scope}]`).checked = true;
  renderTabs(); syncFields(); renderLibrary(); renderProductBg(); renderItems(); scheduleDraw();
}

/* ---------- Exportação ---------- */
async function renderBlob(fk) {
  const F = FORMATS[fk], c = document.createElement("canvas"); c.width = F.w; c.height = F.h;
  const ids = [state.shared.productImg, ...cur_all_ids()].filter(Boolean);
  await Promise.all(ids.map(loadImg));
  paint(c.getContext("2d"), fk, false);
  return new Promise(r => c.toBlob(r, "image/png"));
}
const cur_all_ids = () => Object.values(state.formats).flatMap(f => f.items.map(i => i.imgId));
const slug = () => (state.shared.name || "anuncio").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "anuncio";
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; }
function makeZip(files) { // files: [{name, data:Uint8Array}] sem compressão
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    parts.push(lh, nm, f.data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(ch, nm);
    off += 30 + nm.length + sz;
  }
  const csize = central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

/* ---------- Eventos ---------- */
$("#productFile").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const [rec] = await addFiles([f]); state.shared.productImg = rec.id;
  await loadImg(rec.id); renderLibrary(); renderProductBg(); scheduleDraw(); save(); e.target.value = "";
};
$("#productClear").onclick = () => { state.shared.productImg = null; renderLibrary(); renderProductBg(); scheduleDraw(); save(); };
$("#libFile").onchange = async e => { await addFiles([...e.target.files]); e.target.value = ""; };
document.querySelectorAll("input[name=scope]").forEach(r => r.onchange = () => { state.scope = r.value; save(); });
$("#gCols").oninput = e => setGrid("cols", +e.target.value);
$("#gRows").oninput = e => setGrid("rows", +e.target.value);
function setGrid(p, n) {
  n = Math.round(n); if (!n || n < 1 || n > 24) return;
  const fs = cur(); fs[p] = n;
  for (const it of fs.items) {
    it.col = Math.min(it.col, fs.cols); it.row = Math.min(it.row, fs.rows);
    it.cs = Math.min(it.cs, fs.cols - it.col + 1); it.rs = Math.min(it.rs, fs.rows - it.row + 1);
  }
  renderItems(); scheduleDraw(); save();
}
$("#showGrid").onchange = e => { view.grid = e.target.checked; scheduleDraw(); };
$("#showSafe").onchange = e => { view.safe = e.target.checked; scheduleDraw(); };
$("#cv").onclick = e => {
  const r = e.target.getBoundingClientRect(), fs = cur();
  if (!selItem) {
    const px = (e.clientX - r.left) / r.width * FORMATS[state.active].w, py = (e.clientY - r.top) / r.height * FORMATS[state.active].h;
    const h = hits.filter(h => px >= h.x - 10 && px <= h.x + h.w + 10 && py >= h.y - 6 && py <= h.y + h.h + 6).pop();
    selText = h ? h.key : null; scheduleDraw(); return;
  }
  const it = fs.items.find(i => i.id === selItem); if (!it) return;
  it.col = Math.min(fs.cols - it.cs + 1, Math.floor((e.clientX - r.left) / r.width * fs.cols) + 1);
  it.row = Math.min(fs.rows - it.rs + 1, Math.floor((e.clientY - r.top) / r.height * fs.rows) + 1);
  renderItems(); scheduleDraw(); save();
};
$("#btnOne").onclick = async () => download(await renderBlob(state.active), `${slug()}-${FORMATS[state.active].file}.png`);
$("#btnZip").onclick = async e => {
  const b = e.target, old = b.textContent; b.textContent = "Gerando..."; b.disabled = true;
  try {
    const dir = `anuncio-${slug()}/`, files = [];
    for (const k in FORMATS) files.push({ name: dir + FORMATS[k].file + ".png", data: new Uint8Array(await (await renderBlob(k)).arrayBuffer()) });
    download(makeZip(files), `anuncio-${slug()}.zip`);
  } finally { b.textContent = old; b.disabled = false; }
};
/* ---------- Telas ---------- */
function showView(v) {
  document.body.dataset.view = v;
  if (v === "editor") renderAll();
  if (v === "ads") renderAds();
  if (v === "gallery") renderGallery();
  scrollTo(0, 0);
}
function newAd() { state = fresh(); adId = crypto.randomUUID(); dirty = false; selItem = selText = null; showView("editor"); }
function openAd(rec) { state = normalize(JSON.parse(JSON.stringify(rec.state))); adId = rec.id; dirty = false; selItem = selText = null; showView("editor"); }
function goHome() { flushSave(); adId = null; showView("home"); }
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = t => new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
let adUrls = [];
async function renderAds() {
  const host = $("#adsList"), ads = readAds().sort((a, b) => b.updated - a.updated);
  adUrls.forEach(URL.revokeObjectURL); adUrls = [];
  if (!ads.length) { host.innerHTML = '<div class="empty">Você ainda não criou nenhum anúncio.</div>'; return; }
  const pngs = new Map((await tx("readonly", s => s.getAll(), "pngs").catch(() => [])).map(p => [p.id, p]));
  const frag = document.createDocumentFragment();
  for (const rec of ads) {
    const row = document.createElement("div"); row.className = "adRow";
    const png = rec.kind === "png" ? pngs.get(rec.id) : null;
    if (rec.kind === "png") {
      const url = png ? URL.createObjectURL(png.blob) : ""; if (url) adUrls.push(url);
      row.innerHTML = `<img class="adThumb" src="${url}" alt=""><div class="info"><b>${esc(rec.name) || "Imagem"}</b><small>Imagem importada · ${fmtDate(rec.updated)}</small></div><button class="x" title="Excluir">✕</button>`;
      row.onclick = () => png && openLightbox(url, rec.name);
    } else {
      const sh = rec.state.shared || {};
      row.innerHTML = `<div class="info"><b>${esc(sh.name) || "Sem nome"}</b><small>${esc(sh.brand)}${sh.brand ? " · " : ""}Editado em ${fmtDate(rec.updated)}</small></div><button class="x" title="Excluir anúncio">✕</button>`;
      row.onclick = () => openAd(rec);
    }
    row.querySelector(".x").onclick = async e => {
      e.stopPropagation();
      if (!confirm("Excluir este anúncio? Essa ação não pode ser desfeita.")) return;
      if (rec.kind === "png") await tx("readwrite", s => s.delete(rec.id), "pngs");
      localStorage.setItem(ADS_KEY, JSON.stringify(readAds().filter(a => a.id !== rec.id))); renderAds();
    };
    frag.appendChild(row);
  }
  host.replaceChildren(frag);
}
function openLightbox(url, name) {
  const lb = $("#lightbox"); $("#lbImg").src = url;
  $("#lbDown").onclick = () => { const a = document.createElement("a"); a.href = url; a.download = (name || "anuncio") + ".png"; a.click(); };
  lb.hidden = false;
}
$("#lbClose").onclick = () => { $("#lightbox").hidden = true; };
$("#lightbox").onclick = e => { if (e.target.id === "lightbox") e.target.hidden = true; };

/* ---------- Importar PNGs ---------- */
async function importPngs(files) {
  const imgs = [...files].filter(f => f.type.startsWith("image/"));
  if (!imgs.length) return;
  const ads = readAds();
  for (const f of imgs) {
    const id = crypto.randomUUID();
    await tx("readwrite", s => s.put({ id, name: f.name, blob: f }), "pngs");
    ads.unshift({ id, updated: Date.now(), kind: "png", name: f.name.replace(/\.[^.]+$/, "") });
  }
  localStorage.setItem(ADS_KEY, JSON.stringify(ads));
  showView("ads");
}
$("#tileImport").onclick = () => $("#importFile").click();
$("#importFile").onchange = e => { importPngs(e.target.files); e.target.value = ""; };

/* ---------- Galeria ---------- */
let galleryData = null;
async function loadGallery() {
  if (galleryData) return galleryData;
  galleryData = [...(typeof GALLERY !== "undefined" ? GALLERY : [])];
  try {
    const r = await fetch("gallery.json?t=" + Date.now());
    if (r.ok) galleryData.push(...await r.json());
  } catch { }
  return galleryData;
}
function galleryThumb(shared) {
  const old = state, F = FORMATS.feed;
  state = fresh(); Object.assign(state.shared, JSON.parse(JSON.stringify(shared)));
  try {
    const big = document.createElement("canvas"); big.width = F.w; big.height = F.h;
    paint(big.getContext("2d"), "feed", false);
    const c = document.createElement("canvas"); c.width = 320; c.height = Math.round(320 * F.h / F.w);
    c.getContext("2d").drawImage(big, 0, 0, c.width, c.height);
    return c;
  } finally { state = old; }
}
async function renderGallery() {
  const host = $("#galleryList");
  host.innerHTML = '<div class="empty">Carregando…</div>';
  const list = await loadGallery(), frag = document.createDocumentFragment();
  for (const e of list) {
    const card = document.createElement("div"); card.className = "gCard";
    card.appendChild(galleryThumb(e.shared));
    const info = document.createElement("div"); info.className = "gInfo";
    info.innerHTML = `<b>${esc(e.title)}</b><small>por ${esc(e.author || "Comunidade")}</small><button class="primary">Usar como base</button>`;
    info.querySelector("button").onclick = () => {
      state = fresh(); Object.assign(state.shared, JSON.parse(JSON.stringify(e.shared)));
      adId = crypto.randomUUID(); dirty = true; selItem = selText = null; showView("editor");
    };
    card.appendChild(info); frag.appendChild(card);
  }
  host.replaceChildren(frag);
}
$("#tileGallery").onclick = () => showView("gallery");
$("#tileNew").onclick = newAd;
$("#tileList").onclick = () => showView("ads");
$("#tileGuide").onclick = () => showView("guide");
$("#btnHome").onclick = () => document.body.dataset.view === "editor" ? goHome() : showView("home");
addEventListener("resize", fitCanvas);

(function sideResizer() {
  const bar = $("#resizer"), MIN = 260, root = document.documentElement;
  const clampW = w => Math.max(MIN, Math.min(w, innerWidth - 320));
  const saved = +localStorage.getItem("gerart-side");
  if (saved) root.style.setProperty("--side", clampW(saved) + "px");
  bar.addEventListener("pointerdown", e => {
    e.preventDefault(); bar.setPointerCapture(e.pointerId); bar.classList.add("drag");
    document.body.style.userSelect = "none";
  });
  bar.addEventListener("pointermove", e => {
    if (!bar.hasPointerCapture(e.pointerId)) return;
    root.style.setProperty("--side", clampW(e.clientX) + "px");
  });
  const end = e => {
    bar.classList.remove("drag"); document.body.style.userSelect = "";
    localStorage.setItem("gerart-side", parseInt(getComputedStyle($("#side")).width));
  };
  bar.addEventListener("pointerup", end); bar.addEventListener("pointercancel", end);
  bar.addEventListener("dblclick", () => { root.style.removeProperty("--side"); localStorage.removeItem("gerart-side"); });
})();
if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe($(".canvasWrap"));

(async function init() {
  initAlignBar(); buildFields($("#fieldsText"), TEXT_FIELDS); buildFields($("#fieldsStyle"), STYLE_FIELDS);
  try {
    library = await idbAll();
    library.forEach(r => r.url = URL.createObjectURL(r.blob));
  } catch (e) { console.warn("IndexedDB indisponível", e); }
  migrateLegacy(); showView("home");
})();
