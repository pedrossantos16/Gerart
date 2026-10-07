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
  { k: "oldPrice", l: "Preço antigo (opcional)", t: "text" },
  { k: "price", l: "Preço", t: "text" },
  { k: "cta", l: "Chamada (botão)", t: "text" },
];
const STYLE_FIELDS = [
  { k: "font", l: "Fonte", t: "select", o: FONTS.map(f => [f, f]) },
  { k: "bg1", l: "Fundo – cor 1", t: "color" },
  { k: "bg2", l: "Fundo – cor 2", t: "color" },
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
  { k: "shadow", l: "Sombra na foto", t: "check" },
];

const DEFAULT_SHARED = {
  brand: "MINHA LOJA", name: "Nome do produto", desc: "Uma descrição curta e persuasiva do seu produto.",
  oldPrice: "", price: "R$ 99,90", cta: "Compre agora", productImg: null,
  font: "Segoe UI", bg1: "#1b1464", bg2: "#e1306c", bgAngle: 160, textColor: "#ffffff", accent: "#ffd400", ctaText: "#1a1a1a",
  align: "center", nameSize: 84, descSize: 38, priceSize: 130, imgPos: "top", imgScale: 1, imgY: 0, shadow: true,
};

const $ = s => document.querySelector(s);
let state = load() || fresh();
let selItem = null;
const view = { grid: true, safe: false };

function fresh() {
  const formats = {};
  for (const k in FORMATS) formats[k] = { cols: FORMATS[k].cols, rows: FORMATS[k].rows, over: {}, items: [] };
  return { shared: { ...DEFAULT_SHARED }, formats, active: "feed", scope: "all" };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem("gerart-state"));
    if (!s) return null;
    s.shared = { ...DEFAULT_SHARED, ...s.shared };
    for (const k in FORMATS) s.formats[k] = { cols: FORMATS[k].cols, rows: FORMATS[k].rows, over: {}, items: [], ...s.formats[k] };
    return s;
  } catch { return null; }
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => localStorage.setItem("gerart-state", JSON.stringify(state)), 200); }

const cur = () => state.formats[state.active];
const get = (fk, k) => (k in state.formats[fk].over ? state.formats[fk].over[k] : state.shared[k]);

/* ---------- IndexedDB (biblioteca de imagens) ---------- */
let dbp;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("gerart", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("images", { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("images", mode); const out = fn(t.objectStore("images"));
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
    const rec = { id: crypto.randomUUID(), name: f.name, blob: f };
    await idbPut(rec);
    rec.url = URL.createObjectURL(f);
    library.push(rec); added.push(rec);
  }
  renderLibrary();
  return added;
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
let raf;
function scheduleDraw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint($("#cv").getContext("2d"), state.active, true); }); }

function paint(ctx, fk, overlay) {
  const F = FORMATS[fk], W = F.w, H = F.h, fs = state.formats[fk], v = k => get(fk, k);
  const font = v("font");
  ctx.clearRect(0, 0, W, H);

  const a = v("bgAngle") * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), r = Math.abs(W * dx) / 2 + Math.abs(H * dy) / 2;
  const g = ctx.createLinearGradient(W / 2 - dx * r, H / 2 - dy * r, W / 2 + dx * r, H / 2 + dy * r);
  g.addColorStop(0, v("bg1")); g.addColorStop(1, v("bg2"));
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
  const m = 80, maxW = W - 2 * m, align = v("align");
  const ax = align === "left" ? m : align === "right" ? W - m : W / 2;
  ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  let top = F.safeT, bottom = H - F.safeB;

  if (v("brand")) {
    ctx.font = `700 40px "${font}"`; ctx.fillStyle = v("textColor");
    if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
    ctx.fillText(v("brand").toUpperCase(), ax, top + 40);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    top += 90;
  }
  if (v("cta")) {
    ctx.font = `700 46px "${font}"`;
    const bw = Math.min(maxW, ctx.measureText(v("cta")).width + 140), bh = 110;
    const bx = align === "left" ? m : align === "right" ? W - m - bw : (W - bw) / 2, by = bottom - bh;
    ctx.fillStyle = v("accent"); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 55); ctx.fill();
    ctx.fillStyle = v("ctaText"); ctx.textAlign = "center"; ctx.fillText(v("cta"), bx + bw / 2, by + bh / 2 + 16); ctx.textAlign = align;
    bottom = by - 40;
  }
  // blocos de texto
  const ns = v("nameSize"), ds = v("descSize"), ps = v("priceSize");
  ctx.font = `800 ${ns}px "${font}"`; const nameL = v("name") ? wrap(ctx, v("name"), maxW) : [];
  ctx.font = `400 ${ds}px "${font}"`; const descL = v("desc") ? wrap(ctx, v("desc"), maxW) : [];
  const nameH = nameL.length * ns * 1.1, descH = descL.length * ds * 1.35;
  const textH = nameH + (nameH && descH ? 20 : 0) + descH;
  const hasPrice = !!v("price"), oldS = ps * 0.38;
  const priceH = hasPrice ? ps * 1.05 + (v("oldPrice") ? oldS * 1.3 : 0) : 0;
  const lowerH = textH + (textH && priceH ? 30 : 0) + priceH;

  const imgH = Math.max(200, bottom - top - lowerH - 40);
  const imgTop = v("imgPos") === "top" ? top : top + lowerH + 40;
  const textTop = v("imgPos") === "top" ? top + imgH + 40 : top;

  const pimg = imgOf(state.shared.productImg);
  const sc = v("imgScale");
  const bx = m, bw = maxW, ih = imgH * sc, iw = bw * sc;
  const ix = bx + (bw - iw) / 2, iy = imgTop + (imgH - ih) / 2 + v("imgY");
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

  ctx.textAlign = align; ctx.fillStyle = v("textColor");
  let y = textTop;
  ctx.font = `800 ${ns}px "${font}"`;
  for (const l of nameL) { y += ns * 1.1; ctx.fillText(l, ax, y - ns * 0.2); }
  if (nameH && descH) y += 20;
  ctx.font = `400 ${ds}px "${font}"`; ctx.globalAlpha = 0.9;
  for (const l of descL) { y += ds * 1.35; ctx.fillText(l, ax, y - ds * 0.3); }
  ctx.globalAlpha = 1;
  if (textH && priceH) y += 30;
  if (hasPrice) {
    if (v("oldPrice")) {
      ctx.font = `400 ${oldS}px "${font}"`; ctx.fillStyle = v("textColor"); ctx.globalAlpha = 0.75;
      y += oldS * 1.3; ctx.fillText(v("oldPrice"), ax, y - oldS * 0.3);
      const tw = ctx.measureText(v("oldPrice")).width, lx = align === "left" ? ax : align === "right" ? ax - tw : ax - tw / 2;
      ctx.fillRect(lx, y - oldS * 0.3 - oldS * 0.3, tw, 4); ctx.globalAlpha = 1;
    }
    ctx.font = `800 ${ps}px "${font}"`; ctx.fillStyle = v("accent");
    y += ps * 1.05; ctx.fillText(v("price"), ax, y - ps * 0.15);
  }

  if (overlay) {
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
    else if (f.t === "select") ctl = `<select>${f.o.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`;
    else if (f.t === "range") ctl = `<input type="range" min="${f.min}" max="${f.max}" step="${f.step}">`;
    else if (f.t === "check") ctl = '<input type="checkbox">';
    else ctl = `<input type="${f.t}">`;
    d.innerHTML = `<div class="lbl"><span>${f.l}</span><button class="ov" title="Voltar ao padrão (todos)"></button></div>${ctl}`;
    const el = d.querySelector("textarea,select,input");
    const on = () => {
      const val = f.t === "check" ? el.checked : f.t === "range" ? +el.value : el.value;
      if (state.scope === "this") cur().over[f.k] = val;
      else { state.shared[f.k] = val; delete cur().over[f.k]; }
      refreshOverride(); scheduleDraw(); save();
    };
    el.addEventListener("input", on); el.addEventListener("change", on);
    d.querySelector(".ov").onclick = e => { e.preventDefault(); delete cur().over[f.k]; syncFields(); scheduleDraw(); save(); };
    host.appendChild(d);
  }
}
function syncFields() {
  document.querySelectorAll(".field[data-k]").forEach(d => {
    const el = d.querySelector("textarea,select,input"), val = get(state.active, d.dataset.k);
    if (el.type === "checkbox") el.checked = !!val; else el.value = val;
  });
  refreshOverride();
}
function refreshOverride() {
  document.querySelectorAll(".field[data-k]").forEach(d => d.classList.toggle("over", d.dataset.k in cur().over));
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
    d.innerHTML = `<div class="head"><img src="${rec ? rec.url : ""}"><strong style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${rec ? rec.name : "(removida)"}</strong><button class="small ghost del">Remover</button></div>
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
  renderTabs(); syncFields(); renderLibrary(); renderItems(); scheduleDraw();
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
  await loadImg(rec.id); renderLibrary(); scheduleDraw(); save(); e.target.value = "";
};
$("#productClear").onclick = () => { state.shared.productImg = null; renderLibrary(); scheduleDraw(); save(); };
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
  const it = cur().items.find(i => i.id === selItem); if (!it) return;
  const r = e.target.getBoundingClientRect(), fs = cur();
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
$("#btnNew").onclick = () => {
  if (!confirm("Começar um novo anúncio? A biblioteca de detalhes visuais será mantida.")) return;
  state = fresh(); selItem = null; renderAll(); save();
};
addEventListener("resize", () => { fitCanvas(); });

(async function init() {
  buildFields($("#fieldsText"), TEXT_FIELDS); buildFields($("#fieldsStyle"), STYLE_FIELDS);
  try {
    library = await idbAll();
    library.forEach(r => r.url = URL.createObjectURL(r.blob));
  } catch (e) { console.warn("IndexedDB indisponível", e); }
  renderAll();
})();
