// Descarga de paquetes gratuitos de itch.io, para los modelos CC0 que no tienen URL directa estable.
//
// El flujo que hace el navegador, sin cuenta ni clave:
//   1. GET  /<pack>                     → cookie de sesión + csrf_token
//   2. POST /<pack>/download_url        → { url } de la página de descarga (firmada, caduca en minutos)
//   3. GET  esa url                     → lista de archivos con su data-upload_id + un csrf nuevo
//   4. POST /<pack>/file/<upload_id>    → { url } del archivo en el CDN (caduca en 60 s)
//
// Se usa solo con paquetes **gratuitos y CC0**; nada de esto sortea un pago ni una licencia.

const UA = 'Mozilla/5.0 (compatible; Pitalito-City/0.4; +https://github.com/TakaraDasein/Pitalito-City)';

class Session {
  constructor() { this.jar = new Map(); }
  get cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); }
  #take(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
  }
  async get(url) {
    const res = await fetch(url, { headers: { cookie: this.cookie, 'user-agent': UA } });
    this.#take(res);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return { text: await res.text(), url: res.url };
  }
  async postJson(url, csrf) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { cookie: this.cookie, 'user-agent': UA, 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf_token: csrf }),
    });
    this.#take(res);
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    return res.json();
  }
}

// El csrf viene como <input> en la página del paquete y como <meta> (con los atributos al revés) en la de descarga.
const csrfOf = (html) => decodeURIComponent(
  (html.match(/name="csrf_token" value="([^"]+)"/) || html.match(/value="([^"]+)" name="csrf_token"/) || [])[1] || '',
);

// pageUrl: https://<autor>.itch.io/<paquete>. match: qué archivo elegir de la lista (por defecto, el «Standard»).
export async function itchFileUrl(pageUrl, match = /standard/i) {
  const s = new Session();
  const page = await s.get(pageUrl);
  const { url: downloadPage } = await s.postJson(`${pageUrl}/download_url`, csrfOf(page.text));
  if (!downloadPage) throw new Error(`itch.io no entregó página de descarga para ${pageUrl}`);
  const dl = await s.get(downloadPage);
  const files = [...dl.text.matchAll(/data-upload_id="(\d+)"[\s\S]{0,400}?title="([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] }));
  if (!files.length) throw new Error(`Sin archivos en la página de descarga de ${pageUrl}`);
  const pick = files.find((f) => match.test(f.name)) || files[0];
  const { url } = await s.postJson(`${pageUrl}/file/${pick.id}?source=game_download`, csrfOf(dl.text));
  if (!url) throw new Error(`itch.io no entregó enlace del archivo ${pick.name}`);
  return { url, name: pick.name, all: files.map((f) => f.name) };
}
