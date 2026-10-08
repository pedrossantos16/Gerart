// Para publicar uma atualização, troque só este número (ex.: "4" → "5").
// Ele força o navegador a baixar as versões novas do style.css, qrcode.js e app.js.
var VERSION = "17";

document.write(
  '<link rel="stylesheet" href="style.css?v=' + VERSION + '">' +
  '<script defer src="qrcode.js?v=' + VERSION + '"><\/script>' +
  '<script defer src="gallery.js?v='  + VERSION + '"><\/script>' +  '<script defer src="app.js?v=' + VERSION + '"><\/script>'
);

// Aviso temporário quando o visitante abre o site depois de uma atualização
addEventListener("DOMContentLoaded", function () {
  var old = null;
  try { old = localStorage.getItem("gerart-version"); localStorage.setItem("gerart-version", VERSION); } catch (e) {}
  if (!old || old === VERSION) return;
  var t = document.createElement("div");
  t.id = "updToast";
  t.textContent = "✓ Site atualizado para a versão mais recente";
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#e1306c;color:#fff;" +
    "padding:10px 18px;border-radius:999px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px #0008;" +
    "z-index:9999;transition:opacity .5s;max-width:90vw;text-align:center";
  document.body.appendChild(t);
  setTimeout(function () { t.style.opacity = "0"; }, 4000);
  setTimeout(function () { t.remove(); }, 4600);
});
