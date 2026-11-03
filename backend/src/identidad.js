// Quién usa la app. El backend NO hace login de personas contra Microsoft: la otra app (la que muestra ATS 2.0)
// ya sabe quién es su usuario y se lo pasa al backend de una de estas formas (variable IDENTIDAD):
//   jwt   → el navegador manda "Authorization: Bearer <jwt>" firmado por el backend de la otra app (HS256, JWT_SECRETO)
//           con los claims email y name. Es lo recomendado si el componente llama directo a este backend.
//   proxy → el backend de la otra app reenvía las llamadas agregando x-ats-clave (PROXY_CLAVE) y el usuario en
//           x-ats-usuario-email / x-ats-usuario-nombre (URL-encoded). El navegador nunca ve la clave.
//   dev   → usuario fijo (DEV_USUARIO_EMAIL / DEV_USUARIO_NOMBRE). Solo para probar en la PC.
// Gestión (req.usuario.gestion): el correo está en GESTION_EMAILS, o el JWT trae el rol "ats-gestion" (claim roles /
// rol / role, lista o texto), o el proxy manda x-ats-usuario-rol con "gestion". En dev, DEV_USUARIO_GESTION (SI/NO).
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const igual = (a, b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function verificarJwt(token, secreto, { emisor, audiencia } = {}) {
  const partes = String(token).split('.');
  if (partes.length !== 3) throw new Error('token mal formado');
  const [h, p, firma] = partes;
  const cab = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  if (cab.alg !== 'HS256') throw new Error('algoritmo no permitido');
  if (!igual(firma, b64url(createHmac('sha256', secreto).update(`${h}.${p}`).digest()))) throw new Error('firma inválida');
  const c = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  const ahora = Math.floor(Date.now() / 1000);
  if (typeof c.exp !== 'number' || c.exp < ahora - 30) throw new Error('token vencido');
  if (c.nbf && c.nbf > ahora + 30) throw new Error('token todavía no válido');
  if (emisor && c.iss !== emisor) throw new Error('emisor no válido');
  if (audiencia && c.aud !== audiencia && !(Array.isArray(c.aud) && c.aud.includes(audiencia))) throw new Error('audiencia no válida');
  return c;
}

/** para pruebas y para el ejemplo del README: firma un JWT HS256 */
export function firmarJwt(claims, secreto, segundos = 3600) {
  const ahora = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iat: ahora, exp: ahora + segundos, ...claims }));
  return `${h}.${p}.${b64url(createHmac('sha256', secreto).update(`${h}.${p}`).digest())}`;
}

/** ¿la lista de roles (array o texto separado por comas/espacios) incluye el de gestión? */
export function tieneRolGestion(roles) {
  const lista = Array.isArray(roles) ? roles : String(roles ?? '').split(/[,\s]+/);
  return lista.map((x) => String(x).trim().toLowerCase()).some((x) => ['ats-gestion', 'ats_gestion', 'gestion', 'gestión', 'hss'].includes(x));
}

export function middlewareIdentidad(cfg) {
  const gestionEmails = new Set(String(cfg.gestionEmails ?? '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));
  return (req, res, next) => {
    try {
      let usuario;
      if (cfg.modo === 'dev') {
        // prueba publicada: con CLAVE_ACCESO, cada pedido tiene que traer la clave en x-ats-acceso (la guarda el navegador al abrir ?clave=…)
        if (cfg.claveAcceso && !igual(req.get('x-ats-acceso') ?? '', cfg.claveAcceso)) throw new Error('falta la clave de acceso (abrí la app con ?clave=… una vez en este dispositivo)');
        usuario = { email: cfg.devEmail, nombre: cfg.devNombre, gestion: cfg.devGestion !== false };
      } else if (cfg.modo === 'proxy') {
        const clave = req.get('x-ats-clave') ?? '';
        if (!cfg.proxyClave || !igual(clave, cfg.proxyClave)) throw new Error('clave de proxy inválida');
        usuario = {
          email: decodeURIComponent(req.get('x-ats-usuario-email') ?? ''), nombre: decodeURIComponent(req.get('x-ats-usuario-nombre') ?? ''),
          gestion: tieneRolGestion(decodeURIComponent(req.get('x-ats-usuario-rol') ?? '')),
        };
      } else if (cfg.modo === 'jwt') {
        const m = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
        if (!m) throw new Error('falta el token');
        const c = verificarJwt(m[1], cfg.jwtSecreto, { emisor: cfg.jwtEmisor, audiencia: cfg.jwtAudiencia });
        usuario = { email: c.email || c.preferred_username || c.upn || c.sub, nombre: c.name || c.email || c.sub, gestion: c.gestion === true || tieneRolGestion(c.roles ?? c.rol ?? c.role) };
      } else {
        throw new Error(`IDENTIDAD desconocida: ${cfg.modo}`);
      }
      usuario.email = String(usuario.email ?? '').trim().toLowerCase().slice(0, 255);
      usuario.nombre = String(usuario.nombre ?? '').trim().slice(0, 255) || usuario.email;
      if (!usuario.email) throw new Error('sin usuario');
      usuario.gestion = Boolean(usuario.gestion) || gestionEmails.has(usuario.email);
      req.usuario = usuario;
      next();
    } catch (e) {
      res.status(401).json({ ok: false, errores: [`No autorizado: ${e.message}.`] });
    }
  };
}
