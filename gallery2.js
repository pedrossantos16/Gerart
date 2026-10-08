// Modelos da galeria com detalhes visuais (setas, balões, selos, estrelas...). Cada "svg" vira um detalhe visual no anúncio.
var DECOR = (function () {
  const wrap = (w, h, body) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
  const star = (cx, cy, R, r, n) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r : R; p.push((cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1)); } return p.join(" "); };
  const F = 'font-family="Arial Black,Arial" font-weight="900"';
  return {
    burst: (fill, text, tc, sub) => wrap(400, 400, `<polygon points="${star(200, 200, 195, 150, 16)}" fill="${fill}" stroke="${tc}" stroke-width="6"/><text x="200" y="${sub ? 215 : 235}" text-anchor="middle" ${F} font-size="${text.length > 4 ? 80 : 110}" fill="${tc}">${text}</text>${sub ? `<text x="200" y="275" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="46" fill="${tc}">${sub}</text>` : ""}`),
    arrow: c => wrap(400, 300, `<path d="M30 40 C 60 260, 260 280, 330 150" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round"/><path d="M270 120 L345 130 L330 200" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`),
    arrowStraight: c => wrap(400, 160, `<path d="M20 80 H340" stroke="${c}" stroke-width="26" stroke-linecap="round"/><path d="M270 20 L370 80 L270 140" fill="none" stroke="${c}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`),
    bubble: (fill, text, tc) => { const t = text.split("|"); return wrap(500, 340, `<path d="M60 20 H440 Q480 20 480 60 V200 Q480 240 440 240 H260 L170 320 L190 240 H60 Q20 240 20 200 V60 Q20 20 60 20Z" fill="${fill}"/>` + t.map((s, i) => `<text x="250" y="${t.length > 1 ? 105 + i * 75 : 150}" text-anchor="middle" ${F} font-size="54" fill="${tc}">${s}</text>`).join("")); },
    star: c => wrap(200, 200, `<polygon points="${star(100, 100, 95, 40, 5)}" fill="${c}"/>`),
    sparkle: c => wrap(200, 200, `<path d="M100 5 Q108 92 195 100 Q108 108 100 195 Q92 108 5 100 Q92 92 100 5Z" fill="${c}"/>`),
    heart: c => wrap(200, 180, `<path d="M100 170 C-30 80 40 -20 100 50 C160 -20 230 80 100 170Z" fill="${c}"/>`),
    bolt: c => wrap(200, 300, `<polygon points="120,5 20,170 90,170 70,295 185,115 112,115" fill="${c}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`),
    ribbon: (fill, text, tc) => wrap(520, 140, `<polygon points="0,10 520,10 490,70 520,130 0,130 30,70" fill="${fill}"/><text x="260" y="95" text-anchor="middle" ${F} font-size="64" fill="${tc}">${text}</text>`),
    ring: (c, w) => wrap(400, 400, `<circle cx="200" cy="200" r="180" fill="none" stroke="${c}" stroke-width="${w || 14}" stroke-dasharray="40 24"/>`),
    badge: (fill, l1, l2, tc) => wrap(360, 360, `<circle cx="180" cy="180" r="170" fill="${fill}"/><circle cx="180" cy="180" r="150" fill="none" stroke="${tc}" stroke-width="5" stroke-dasharray="10 8"/><text x="180" y="190" text-anchor="middle" ${F} font-size="100" fill="${tc}">${l1}</text><text x="180" y="250" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="50" fill="${tc}">${l2}</text>`)
  };
})();

GALLERY.push(
  { title: "Oferta explosiva", author: "Gerart",
    shared: { brand: "MEGA LOJA", name: "SUPER OFERTA", desc: "Só até acabar o estoque.", oldPrice: "R$ 199,00", price: "R$ 99,90", cta: "Quero aproveitar",
      font: "Impact", stops: [{ c: "#8e0e00" }, { c: "#e52d27" }, { c: "#ff8a00" }], bgAngle: 160, accent: "#ffe600", ctaText: "#8e0e00", nameSize: 110 },
    items: [
      { svg: DECOR.burst("#ffe600", "-50%", "#c00000", "OFF"), col: 5, row: 1, cs: 2, rs: 2, rot: 12, layer: "front" },
      { svg: DECOR.arrow("#ffffff"), col: 1, row: 3, cs: 2, rs: 2, rot: -10, layer: "front", opacity: 0.95 },
      { svg: DECOR.star("#ffe600"), col: 1, row: 2, cs: 1, rs: 1, rot: -15, layer: "front" },
      { svg: DECOR.star("#ffffff"), col: 5, row: 4, cs: 1, rs: 1, rot: 20, layer: "front", opacity: 0.8 },
      { svg: DECOR.sparkle("#fff3a0"), col: 1, row: 5, cs: 1, rs: 1, rot: 0, layer: "back", opacity: 0.8 }
    ] },
  { title: "Lançamento tech", author: "Gerart",
    shared: { brand: "NOVA TECH", name: "SmartWatch X2", desc: "Monitor cardíaco, GPS e 7 dias de bateria.", price: "R$ 599,90", cta: "Pré-venda aberta",
      font: "Trebuchet MS", stops: [{ c: "#0a0f2c" }, { c: "#1b2a6b" }, { c: "#5b2a9c" }], bgAngle: 190, accent: "#00e5ff", ctaText: "#06122e" },
    items: [
      { svg: DECOR.ring("#00e5ff", 8), col: 2, row: 1, cs: 5, rs: 4, rot: 0, layer: "back", opacity: 0.55 },
      { svg: DECOR.ring("#b388ff", 6), col: 1, row: 3, cs: 3, rs: 3, rot: 40, layer: "back", opacity: 0.4 },
      { svg: DECOR.ribbon("#00e5ff", "NOVO", "#06122e"), col: 1, row: 2, cs: 3, rs: 1, rot: -8, layer: "front" },
      { svg: DECOR.sparkle("#ffffff"), col: 5, row: 3, cs: 1, rs: 1, rot: 0, layer: "front" },
      { svg: DECOR.sparkle("#00e5ff"), col: 6, row: 5, cs: 1, rs: 1, rot: 15, layer: "front", opacity: 0.8 },
      { svg: DECOR.bubble("#ffffff", "Lançamento|exclusivo!", "#1b2a6b"), col: 4, row: 3, cs: 3, rs: 2, rot: 6, layer: "front" }
    ] },
  { title: "Promoção relâmpago", author: "Gerart",
    shared: { brand: "ELETRO FÁCIL", name: "RELÂMPAGO", desc: "Ofertas válidas por 24 horas.", oldPrice: "R$ 899,00", price: "R$ 549,00", cta: "Ver ofertas",
      font: "Arial Black", stops: [{ c: "#141e30" }, { c: "#35577d" }], bgAngle: 170, accent: "#ffd400", ctaText: "#141e30", nameSize: 100 },
    items: [
      { svg: DECOR.bolt("#ffd400"), col: 1, row: 1, cs: 1, rs: 2, rot: -12, layer: "front" },
      { svg: DECOR.bolt("#ffd400"), col: 6, row: 1, cs: 1, rs: 2, rot: 12, flip: true, layer: "front" },
      { svg: DECOR.bubble("#ffd400", "Só hoje!", "#141e30"), col: 1, row: 3, cs: 3, rs: 2, rot: -6, layer: "front" },
      { svg: DECOR.burst("#ff3d00", "FRETE", "#ffffff", "GRÁTIS"), col: 5, row: 3, cs: 2, rs: 2, rot: 10, layer: "front" },
      { svg: DECOR.arrowStraight("#ffd400"), col: 3, row: 3, cs: 2, rs: 1, rot: 90, layer: "back", opacity: 0.35 }
    ] },
  { title: "Dia dos namorados", author: "Gerart",
    shared: { brand: "AMOR & CIA", name: "Presente Perfeito", desc: "Kit especial com cartão personalizado.", oldPrice: "R$ 139,00", price: "R$ 99,90", cta: "Presentear",
      font: "Georgia", stops: [{ c: "#ff5f6d" }, { c: "#ffc371" }], bgAngle: 150, textColor: "#ffffff", accent: "#ffffff", ctaText: "#d81b60" },
    items: [
      { svg: DECOR.heart("#ffffff"), col: 1, row: 1, cs: 1, rs: 1, rot: -20, layer: "back", opacity: 0.8 },
      { svg: DECOR.heart("#ff1744"), col: 6, row: 2, cs: 1, rs: 1, rot: 18, layer: "front" },
      { svg: DECOR.heart("#ffffff"), col: 2, row: 4, cs: 1, rs: 1, rot: 10, layer: "back", opacity: 0.5 },
      { svg: DECOR.heart("#ff1744"), col: 1, row: 5, cs: 1, rs: 1, rot: -14, layer: "back", opacity: 0.7 },
      { svg: DECOR.ribbon("#ffffff", "12 DE JUNHO", "#d81b60"), col: 2, row: 1, cs: 4, rs: 1, rot: 0, layer: "front" },
      { svg: DECOR.badge("#ffffff", "-30%", "casais", "#d81b60"), col: 5, row: 3, cs: 2, rs: 2, rot: 8, layer: "front" }
    ] },
  { title: "Pizzaria 2 por 1", author: "Gerart",
    shared: { brand: "PIZZA DO ZÉ", name: "PIZZA EM DOBRO", desc: "Peça uma grande e leve outra de graça.", price: "R$ 54,90", cta: "Pedir agora",
      font: "Arial Black", stops: [{ c: "#1d2b12" }, { c: "#3a5a1c" }], bgAngle: 175, accent: "#ffcc00", ctaText: "#1d2b12", nameSize: 96 },
    items: [
      { svg: DECOR.badge("#ffcc00", "2x1", "grandes", "#b71c1c"), col: 5, row: 1, cs: 2, rs: 2, rot: 14, layer: "front" },
      { svg: DECOR.arrow("#ffcc00"), col: 1, row: 3, cs: 2, rs: 2, rot: -30, flip: true, layer: "front" },
      { svg: DECOR.bubble("#ffffff", "Entrega|grátis!", "#b71c1c"), col: 4, row: 3, cs: 3, rs: 2, rot: 5, layer: "front" },
      { svg: DECOR.sparkle("#ffcc00"), col: 1, row: 1, cs: 1, rs: 1, rot: 0, layer: "front" },
      { svg: DECOR.ring("#ffcc00", 10), col: 3, row: 2, cs: 4, rs: 3, rot: 0, layer: "back", opacity: 0.35 }
    ] }
);
