// SharePoint ATSHSS por Microsoft Graph con la identidad propia del backend (client credentials).
// El registro de Entra necesita el permiso de aplicación Sites.Selected y, sobre el sitio ATSHSS, el rol "write"
// (lo otorga IT: ver README). Nadie inicia sesión: el token lo pide el backend con su secreto o su certificado.
import { readFileSync } from 'node:fs';
import { ConfidentialClientApplication } from '@azure/msal-node';

const G = 'https://graph.microsoft.com/v1.0';

export function crearAlmacenGraph(cfg) {
  const credencial = cfg.obtenerToken ? {} : cfg.certificadoClave
    ? { clientCertificate: { thumbprintSha256: cfg.certificadoHuella, privateKey: readFileSync(cfg.certificadoClave, 'utf8') } }
    : { clientSecret: cfg.secreto };
  // cfg.obtenerToken: solo para pruebas (Graph simulado)
  const msal = cfg.obtenerToken ? null : new ConfidentialClientApplication({
    auth: { clientId: cfg.clientId, authority: `https://login.microsoftonline.com/${cfg.tenantId}`, ...credencial },
  });

  async function token() {
    if (cfg.obtenerToken) return cfg.obtenerToken();
    const r = await msal.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
    if (!r?.accessToken) throw new Error('No se obtuvo token de Microsoft Graph');
    return r.accessToken;
  }

  async function llamar(metodo, ruta, cuerpo) {
    const url = ruta.startsWith('http') ? ruta : `${G}${ruta}`;
    const resp = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
        // filtrar por columnas sin índice (las listas tienen pocos miles de filas)
        Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (!resp.ok) {
      const detalle = await resp.text();
      const e = new Error(`Graph ${metodo} ${ruta.split('?')[0]} → ${resp.status}: ${detalle.slice(0, 300)}`);
      e.status = resp.status;
      throw e;
    }
    return resp.status === 204 ? null : resp.json();
  }

  let sitio = cfg.siteId;
  async function idSitio() {
    if (!sitio) sitio = (await llamar('GET', `/sites/${cfg.sitioHost}:${cfg.sitioRuta}?$select=id`)).id;
    return sitio;
  }

  const esc = (v) => String(v).replace(/'/g, "''");

  /** filas { id, fields } de una lista, con filtro OData sobre fields/... (paginado) */
  async function listar(lista, filtro) {
    let url = `/sites/${await idSitio()}/lists/${lista}/items?$expand=fields&$top=999` + (filtro ? `&$filter=${encodeURIComponent(filtro)}` : '');
    const filas = [];
    while (url) {
      const r = await llamar('GET', url);
      for (const it of r.value) filas.push({ id: Number(it.id), fields: it.fields });
      url = r['@odata.nextLink'];
    }
    return filas;
  }

  const L = cfg.listas;
  return {
    nombre: 'graph',
    tareasActivas: () => listar(L.tareas, "fields/Activa eq 'SI'"),
    padronActivo: () => listar(L.personas, "fields/Activo eq 'SI'"),
    async registroPorCodigo(codigo) {
      const f = await listar(L.registros, `fields/Title eq '${esc(codigo)}'`);
      return f[0] ?? null;
    },
    atsInicioDesde: (isoUtc) => listar(L.registros,
      `fields/Tipo eq 'ATS' and fields/InicioTurno eq 'SI' and fields/FechaInicio ge '${isoUtc}'`),
    personalDe: (codigo) => listar(L.personal, `fields/Title eq '${esc(codigo)}'`),
    async crearRegistro(fields) {
      const r = await llamar('POST', `/sites/${await idSitio()}/lists/${L.registros}/items`, { fields });
      return Number(r.id);
    },
    async actualizarRegistro(id, fields) {
      await llamar('PATCH', `/sites/${await idSitio()}/lists/${L.registros}/items/${id}/fields`, fields);
    },
    async crearPersona(fields) {
      const r = await llamar('POST', `/sites/${await idSitio()}/lists/${L.personal}/items`, { fields });
      return Number(r.id);
    },
    /** solo para pruebas/probar-graph.js: manda el ítem a la papelera del sitio */
    async _borrar(lista, id) { await llamar('DELETE', `/sites/${await idSitio()}/lists/${L[lista]}/items/${id}`); },
    urlRegistro: (id) => `https://${cfg.sitioHost}${cfg.sitioRuta}/Lists/ATS2%20Registros/DispForm.aspx?ID=${id}`,
  };
}
