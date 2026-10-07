// Para publicar uma atualização, troque só este número (ex.: "4" → "5").
// Ele força o navegador a baixar as versões novas do style.css, qrcode.js e app.js.
var VERSION = "4";

document.write(
  '<link rel="stylesheet" href="style.css?v=' + VERSION + '">' +
  '<script defer src="qrcode.js?v=' + VERSION + '"><\/script>' +
  '<script defer src="app.js?v=' + VERSION + '"><\/script>'
);
