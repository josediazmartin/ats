// Arma la app Express de ATS 2.0 web a partir de la configuración (variables de entorno o un objeto en las pruebas).
// server.js la escucha en un puerto; las pruebas la levantan en un puerto libre.
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { crearAlmacenGraph } from './almacen/graph.js';
import { crearAlmacenLocal } from './almacen/local.js';
import { crearAlmacenSql } from './almacen/sql.js';
import { middlewareIdentidad } from './identidad.js';
import { guardarDocumento, atsInicioVigentes, resumenAts, resumenTarea, resumenPersona } from './documentos.js';
import { routerGestion } from './gestion.js';

export const VERSION = 'Web v2 · 3-nov';

export function crearAlmacen(env, RAIZ) {
  if (env.ALMACEN === 'graph') {
    return crearAlmacenGraph({
      tenantId: env.GRAPH_TENANT_ID, clientId: env.GRAPH_CLIENT_ID, secreto: env.GRAPH_CLIENT_SECRET,
      certificadoClave: env.GRAPH_CERT_CLAVE ? resolve(RAIZ, env.GRAPH_CERT_CLAVE) : undefined, certificadoHuella: env.GRAPH_CERT_HUELLA_SHA256,
      sitioHost: env.SITIO_HOST || 'vicunacom.sharepoint.com', sitioRuta: env.SITIO_RUTA || '/sites/ATSHSS', siteId: env.SITIO_ID,
      listas: {
        registros: env.LISTA_REGISTROS || '75817493-9d10-4d51-8ad3-a7e621765d94',
        personal: env.LISTA_PERSONAL || '1ed91276-f8dd-4ddd-9a65-019740b5ebf2',
        tareas: env.LISTA_TAREAS || '10b9009b-7229-427e-ac18-2232cdb16b5b',
        personas: env.LISTA_PERSONAS || 'b720fe19-4239-4617-b204-a5259ab7902b',
      },
    });
  }
  if (env.ALMACEN === 'local') return crearAlmacenLocal({ archivo: resolve(RAIZ, env.LOCAL_ARCHIVO || 'datos/local.json'), semilla: resolve(RAIZ, 'datos/demo.json') });
  return crearAlmacenSql({ archivo: env.SQLITE_ARCHIVO === ':memory:' ? ':memory:' : resolve(RAIZ, env.SQLITE_ARCHIVO || 'datos/ats2.sqlite') });
}

export function crearApp({ env, RAIZ, almacen = crearAlmacen(env, RAIZ) }) {
  const identidad = middlewareIdentidad({
    modo: env.IDENTIDAD || 'dev',
    devEmail: env.DEV_USUARIO_EMAIL || 'demo@vicuna.com', devNombre: env.DEV_USUARIO_NOMBRE || 'Usuario de prueba', devGestion: env.DEV_USUARIO_GESTION !== 'NO',
    claveAcceso: env.CLAVE_ACCESO || '',
    proxyClave: env.PROXY_CLAVE,
    jwtSecreto: env.JWT_SECRETO, jwtEmisor: env.JWT_EMISOR, jwtAudiencia: env.JWT_AUDIENCIA,
    gestionEmails: env.GESTION_EMAILS,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '6mb' }));   // un documento con varias firmas (cada una ~20-60 KB)

  // CORS solo para los orígenes de la otra app (si el componente llama a este backend desde otro dominio)
  const origenes = (env.CORS_ORIGENES || '').split(',').map((x) => x.trim()).filter(Boolean);
  app.use('/api', (req, res, next) => {
    const o = req.get('origin');
    if (o && origenes.includes(o)) {
      res.set({ 'Access-Control-Allow-Origin': o, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-ats-acceso', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Max-Age': '600' });
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });

  app.get('/api/ats/salud', (req, res) => res.json({ ok: true, almacen: almacen.nombre, version: VERSION }));

  const api = express.Router();
  api.use(identidad);
  api.get('/yo', (req, res) => res.json(req.usuario));

  api.get('/catalogos', async (req, res) => {
    const [tareas, padron] = await Promise.all([almacen.tareasActivas(), almacen.padronActivo()]);
    res.json({ tareas: tareas.map((t) => resumenTarea(t.fields)), padron: padron.map((p) => resumenPersona(p.fields)), fecha: new Date().toISOString() });
  });

  api.get('/ats-inicio', async (req, res) => res.json(await atsInicioVigentes(almacen)));

  api.get('/registros/:codigo', async (req, res) => {
    const r = await almacen.registroPorCodigo(String(req.params.codigo).trim().toUpperCase());
    if (!r) return res.status(404).json({ ok: false, errores: ['No existe ese registro.'] });
    res.json(resumenAts(r.fields));
  });

  api.post('/documentos', async (req, res) => {
    const r = await guardarDocumento(almacen, req.usuario, req.body, VERSION);
    if (r.status >= 400) console.warn(`[${req.usuario.email}] ${r.body.codigo}: ${r.status} ${r.body.errores.join(' | ')}`);
    res.status(r.status).json(r.body);
  });

  api.use('/gestion', routerGestion(almacen));
  app.use('/api/ats', api);

  // opcional: servir el frontend compilado en el mismo puerto (ATS 2.0 en / y la gestión en /gestion)
  const front = env.SERVIR_FRONTEND ? resolve(RAIZ, env.SERVIR_FRONTEND) : null;
  if (front && existsSync(front)) {
    app.use(express.static(front));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(resolve(front, 'index.html')));
  }

  app.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') return res.status(400).json({ ok: false, errores: ['El cuerpo del pedido no es JSON válido o es demasiado grande.'] });
    console.error(err);
    res.status(err.status === 404 ? 404 : 500).json({ ok: false, errores: [`Error del servidor al hablar con ${almacen.nombre === 'graph' ? 'SharePoint' : 'la base de datos'}. Se reintenta solo.`] });
  });

  return { app, almacen };
}
