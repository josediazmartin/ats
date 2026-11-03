# ATS 2.0 web (React + backend + base propia)

Versión 2 · 3-nov-2026 · Responsable: HSS Vicuña (José María Díaz)

Es la app **ATS 2.0** (ATS 2.0 + TTR) y la app **ATS Gestión** de Power Apps, rehechas en React sobre un backend propio. Desde esta versión **la base de datos del backend es la única fuente de ATS y TTR**: SharePoint ATSHSS queda como historial y las apps de Power Apps se retiran cuando esta las reemplace.

- **El componente React no hace login.** La otra app (la de operaciones) le dice al backend quién es el usuario; al iniciar sesión ahí, el trabajador puede hacer la TTR en el mismo lugar.
- **La base es un archivo SQLite** dentro del contenedor (volumen de Docker). No hace falta instalar ningún motor ni pedir nada a Microsoft.
- **Las reglas viven en un solo lugar:** el backend. Nadie escribe en la base directo; todo entra por la API.
- **Funciona sin señal:** lo que se hace en el teléfono queda guardado y se envía solo cuando vuelve la conexión.

```
 App de operaciones / navegador                 Backend ATS 2.0 (Node 22)                 Volumen Docker
┌───────────────────────────────┐  /api/ats   ┌──────────────────────────────────┐        ┌─────────────────────┐
│ <Ats2 />      ATS 2.0 + TTR   │───────────▶ │ identidad: JWT | proxy | dev     │ SQLite │ datos/ats2.sqlite   │
│ <Gestion />   HSS (notebook)  │   + JWT     │ reglas ATS/TTR (15 días, 409…)   │──────▶ │  registros          │
│ IndexedDB (sin señal)         │             │ gestión: tareas, padrón, listados│        │  personal (firmas)  │
└───────────────────────────────┘             │ almacén: sqlite | graph | local  │        │  tareas, personas   │
                                              └──────────────────────────────────┘        │ datos/respaldos/    │
                                                                                          └─────────────────────┘
```

## Qué hay en la carpeta

| Carpeta | Contenido |
|---|---|
| `frontend/src/ats2/` | **El componente para la app de operaciones**: pantallas de ATS 2.0 y TTR, estado sin señal, escáner, firma, QR y estilos (todo bajo `.ats2`). |
| `frontend/src/gestion/` | **La gestión de HSS** (lo que era ATS Gestión): ATS cargados, ATS válidos, tareas rutinarias con su personal habilitado, padrón e impresión de QR (todo bajo `.ats2g`). |
| `frontend/src/main.tsx` | Página de prueba: monta `<Ats2 />` en `/` y `<Gestion />` en `/gestion`. |
| `backend/src/` | `app.js` (rutas), `documentos.js` (reglas y columnas), `gestion.js` (rutas de gestión), `identidad.js` (JWT / proxy / rol de gestión), `almacen/sql.js` + `almacen/esquema.js` (SQLite), `almacen/graph.js` (SharePoint, lo anterior) y `almacen/local.js` (archivo de prueba). |
| `backend/scripts/` | `migrar.js` (SharePoint → SQLite), `semilla.js` (datos ficticios), `respaldo.js` (copia de la base). |
| `backend/pruebas/` | 30 pruebas de reglas (sobre SQLite y sobre JSON), 8 de gestión por HTTP y 7 de Graph simulado. |
| `Dockerfile`, `compose.yaml` | Un contenedor con todo; la base en el volumen `ats2-datos`. |

## Probarlo en la PC

Hace falta Node.js 22.13 o más nuevo (SQLite viene adentro de Node, no se instala nada más).

```bash
cd backend
cp .env.example .env          # ALMACEN=sqlite, usuario de prueba con gestión
npm install
npm run semilla:demo          # tareas y personas FICTICIAS (solo para probar)
npm start                     # http://localhost:3001
```

```bash
cd frontend
npm install
npm run build                 # el backend sirve frontend/dist: / y /gestion
# o, para desarrollar con recarga: npm run dev → http://localhost:5173 (proxy a 3001)
```

Con `?dbg=1`, cada botón de escanear tiene al lado un campo para escribir lo que "leyó" la cámara. Ejemplos con los datos de prueba:

| Qué | Texto |
|---|---|
| Credencial | `9-99-P0000000001` |
| DNI argentino (PDF417) | `00512345678@GOMEZ@ANA@F@20333444@A@01/01/1990@15/03/2018@200` |
| QR de persona | `ATS2-P-20111222` |
| QR de tarea | `ATS2-T-TR-DEMO-01` |

Pruebas del backend: `cd backend && npm run probar`.

## Ponerlo en un servidor (Docker)

```bash
cp backend/.env.example backend/.env    # completar IDENTIDAD, JWT_SECRETO, GESTION_EMAILS, CORS_ORIGENES
docker compose up -d --build
```

Queda en `http://<servidor>:3001`: ATS 2.0 en `/`, la gestión en `/gestion`, la API en `/api/ats`. La base y los respaldos viven en el volumen `ats2-datos`; recrear o actualizar el contenedor no los toca.

- **HTTPS es obligatorio** para la cámara y el NFC. Si el servidor tiene nombre público: `docker compose --profile https up -d` levanta Caddy con certificado automático (variable `ATS2_DOMINIO`). Si no, el proxy que use IT delante del puerto 3001.
- **Respaldo:** `docker compose exec ats2 npm run respaldo` deja una copia consistente en `datos/respaldos/ats2-aaaammdd-hhmm.sqlite` y conserva las últimas 30. Programarlo todos los días y copiar esa carpeta fuera del servidor (`docker cp ats2:/app/backend/datos/respaldos ./`).
- **Restaurar:** parar el contenedor, reemplazar `ats2.sqlite` en el volumen por la copia, arrancar.
- **Actualizar la app:** `docker compose up -d --build`. El esquema se crea solo si falta (`CREATE TABLE IF NOT EXISTS`).

## Probarla publicada en Railway (antes del servidor de la empresa)

Railway construye el `Dockerfile`, da HTTPS (así se prueba la cámara y el NFC en el celular) y tiene volúmenes para la base. Vercel no sirve para esto: no tiene disco persistente para el SQLite. Pasos, una sola vez:

1. Subir esta carpeta a un repositorio **privado** de GitHub (sin `.env`, bases ni exportaciones: ya están en `.gitignore`).
2. En Railway: **New Project → Deploy from GitHub repo** → elegir el repo. Toma `railway.toml` y el `Dockerfile` solo.
3. En el servicio, pestaña **Variables**:

   | Variable | Valor |
   |---|---|
   | `RAILWAY_RUN_UID` | `0` (el volumen se monta como root y la imagen corre como usuario `node`) |
   | `IDENTIDAD` | `dev` para la prueba (`jwt` o `proxy` cuando la use la app de operaciones) |
   | `CLAVE_ACCESO` | una clave larga: sin ella cualquiera con la URL podría cargar datos |
   | `DEV_USUARIO_EMAIL`, `DEV_USUARIO_NOMBRE` | quién figura como "cargado por" en la prueba |
   | `GESTION_EMAILS` | el correo de arriba, para entrar a `/gestion` |

   `PORT` lo pone Railway; el backend lo usa solo.

4. Pestaña **Volumes** (o clic derecho en el servicio → Add Volume): mount path **`/app/backend/datos`**. Sin esto la base se pierde en cada despliegue.
5. **Settings → Networking → Generate Domain**. Abrir `https://<dominio>/?clave=LA_CLAVE` una vez en cada dispositivo (queda guardada en el navegador; `?clave=` sola la borra). ATS 2.0 en `/`, la gestión en `/gestion`.
6. Datos de prueba: en Railway, pestaña del servicio → **Shell** (o `railway ssh`): `npm run semilla:demo`. Para cargar lo real: subir la carpeta de exportación al volumen y `npm run migrar -- <carpeta>`, o cargar tareas y padrón desde `/gestion`.

Cada `git push` vuelve a desplegar. Para traerse los datos al servidor de la empresa: en `/gestion`, **Descargar respaldo** (o `GET /api/ats/gestion/respaldo`) baja la base completa; se copia a `datos/ats2.sqlite` del servidor nuevo y listo.

## Migrar lo que hay en SharePoint ATSHSS

Una sola vez, antes de retirar las apps de Power Apps:

1. Exportar las cuatro listas a JSON (lo que devuelve `/_api/web/lists(guid'…')/items?$top=5000` con `Accept: application/json;odata=nometadata`, o Graph): `registros.json`, `personal.json`, `tareas.json`, `personas.json` en una carpeta.
2. `npm run migrar -- <carpeta> --solo-ver` muestra cuántos ítems cargaría.
3. `npm run migrar -- <carpeta>` los carga. Conserva el ID de SharePoint (`sp_id`) y la fecha de creación; correrlo dos veces no duplica (la clave es el código, o código + DNI en las firmas).

Los registros migrados conservan su `AppVersion` ("v17 · 30-oct", "API v1"), así que el backend sigue sin modificarlos desde la web (regla del 409).

## Quién es el usuario (variable `IDENTIDAD` del backend)

El backend no hace login de personas: confía en lo que le dice la app de operaciones. Hay dos formas.

### `jwt` (recomendada)

El backend de la otra app firma un token corto con un secreto que comparte con el backend de ATS, y el componente lo manda en `Authorization`. Ejemplo en Node (librería `jsonwebtoken`):

```js
// en el backend de la otra app, para el usuario que ya inició sesión ahí
import jwt from 'jsonwebtoken';
app.get('/token-ats', requiereSesion, (req, res) => {
  res.json({ token: jwt.sign(
    { email: req.user.email, name: req.user.nombre, aud: 'ats2', roles: req.user.esHss ? ['ats-gestion'] : [] },
    process.env.ATS_JWT_SECRETO,
    { algorithm: 'HS256', expiresIn: '1h' },
  ) });
});
```

En el `.env` del backend de ATS:

```
IDENTIDAD=jwt
JWT_SECRETO=<el mismo secreto, 32+ caracteres>
JWT_AUDIENCIA=ats2
```

Si el componente llama al backend desde otro dominio, agregar también `CORS_ORIGENES=https://otra-app.vicuna.com`.

Claims que lee el backend: `email` (o `preferred_username` / `upn`), `name`, `exp` y, para la gestión, `roles` (o `rol` / `role`) con `ats-gestion`. Verifica la firma HS256, el vencimiento y, si están configurados, `JWT_EMISOR` y `JWT_AUDIENCIA`.

### `proxy`

El backend de la otra app reenvía `/api/ats/*` al backend de ATS y agrega estos encabezados:

- `x-ats-clave`: la clave `PROXY_CLAVE`.
- `x-ats-usuario-email` y `x-ats-usuario-nombre`: el usuario, URL-encoded.
- `x-ats-usuario-rol` (opcional): `gestion` para quien puede entrar a la gestión.

El navegador nunca ve la clave. En ese caso `getHeaders` no hace falta.

### `dev`

Usuario fijo, solo para probar (`DEV_USUARIO_GESTION=SI` para ver la gestión). Si la prueba está publicada en internet, poner `CLAVE_ACCESO`: el backend rechaza todo pedido que no traiga esa clave en el encabezado `x-ats-acceso`, y la página de prueba la guarda en el navegador al abrir `?clave=…` una vez.

### Quién entra a la gestión

Entra a `/gestion` y a `/api/ats/gestion/*` quien cumpla una de estas: su correo está en `GESTION_EMAILS` (lista separada por comas), su JWT trae el rol `ats-gestion`, o el proxy manda `x-ats-usuario-rol: gestion`. El resto recibe 403 y sigue usando ATS 2.0 y la TTR normalmente.

## Meterlo en la app React de operaciones

1. Copiar `frontend/src/ats2/` (y, para HSS, `frontend/src/gestion/`) al proyecto e instalar sus dependencias:

   ```bash
   npm install idb-keyval qrcode @zxing/browser @zxing/library
   ```

   Usa React 18 o 19. En TypeScript, agregar también `@types/qrcode`.

2. Montarlo en una ruta propia, porque ocupa toda la pantalla:

   ```tsx
   import { Ats2 } from './ats2';
   import { Gestion } from './gestion';

   <Ats2 apiBase="https://ats.vicuna.com/api/ats" getHeaders={async () => ({ Authorization: `Bearer ${await pedirTokenAts()}` })} />
   <Gestion apiBase="https://ats.vicuna.com/api/ats" getHeaders={…} />
   ```

   | Prop | Para qué |
   |---|---|
   | `apiBase` | Dirección del backend de ATS 2.0. |
   | `getHeaders` | Lo que identifica al usuario ante el backend. Se llama en cada pedido. |
   | `almacenamiento` (solo `Ats2`) | Nombre de la base local del navegador (por defecto `ats2`). |
   | `alto` (solo `Ats2`) | Alto mínimo (por defecto toda la ventana). |

3. **TTR al iniciar sesión:** la app de operaciones ya sabe quién es el usuario, así que puede abrir `<Ats2 />` directo en la TTR y el trabajador no necesita escanear su propia credencial para firmar. Para precargar su DNI desde la sesión, el token puede traer `documento` (claim opcional, pendiente de definir con el equipo de operaciones).

4. Servirlo por **HTTPS**: la cámara (escaneo) y el NFC no funcionan sin HTTPS.

## API del backend

Todas las rutas van con la identidad del modo elegido. Las respuestas son JSON; los errores, `{ ok: false, errores: [...] }`.

### ATS 2.0 / TTR

| Método y ruta | Devuelve |
|---|---|
| `GET /api/ats/salud` | `{ ok, almacen, version }`. No pide identidad. |
| `GET /api/ats/yo` | `{ email, nombre, gestion }`: el usuario que entendió el backend. |
| `GET /api/ats/catalogos` | `{ tareas, padron, fecha }`: tareas activas del Listado (con `habilitados` = DNI) y personas activas. |
| `GET /api/ats/ats-inicio` | ATS de inicio de turno autorizados de los últimos 15 días, para vincular la TTR. |
| `GET /api/ats/registros/:codigo` | Resumen de un ATS: tipo, inicio de turno, estado, hora, frente, supervisor, radio y empresa. 404 si no existe. |
| `POST /api/ats/documentos` | Guarda `{ doc, personal }`. 201 creado, 200 actualizado, 400 `{ errores }`, 409 si el código es de otra app o ya está cerrado. |

### Gestión (solo usuarios de gestión; si no, 403)

| Método y ruta | Devuelve |
|---|---|
| `GET /api/ats/gestion/resumen` | `{ registros: { total, hoy, semana, ats, ttr, faltaCierre }, validos, tareas: { total, activas }, personas: { total, activas } }`. |
| `GET /api/ats/gestion/registros?dias=30&tipo=ATS&q=texto` | Filas de ATS/TTR (`dias` 1, 7, 30, 90 o 0 = todos; máximo 2000, más nuevo primero) con `valeHasta` y `vigente` para los ATS de inicio autorizados. |
| `GET /api/ats/gestion/registros/:codigo` | `{ registro, campos (las 52 columnas tal cual), personal (con la firma), ttr (las vinculadas, si es un ATS) }`. |
| `GET /api/ats/gestion/validos` | `{ ats: [... con quedan y ttrN], ttr: [...] }`: ATS de inicio vigentes y TTR de los últimos 15 días. |
| `GET /api/ats/gestion/tareas` | Todas las tareas del Listado (activas e inactivas) con `habilitados` = DNI. |
| `PUT /api/ats/gestion/tareas/:codigo` | Crea (201) o actualiza (200) la tarea: `tarea`, `procedimiento`, `anexoIperc`, `area`, `frente`, `empresa`, `riesgoFatal`, `ccv`, `aprobadoPor`, `fechaAprobacion`, `ultimaRevision` (dd/mm/aaaa), `activa` (SI/NO) y `habilitados` (lista de DNI). Devuelve `avisos` (sin habilitados, DNI fuera del padrón). |
| `GET /api/ats/gestion/personas` | El padrón completo con `tareas` = códigos en los que cada persona está habilitada. |
| `PUT /api/ats/gestion/personas/:documento` | Crea o actualiza `nombre` y `activo`; `cargo`, `empresa`, `equipo` y `credencial` solo si vienen (no se pisan). |
| `GET /api/ats/gestion/respaldo` | Baja una copia consistente de la base (`ats2-aaaammdd-hhmm.sqlite`). Es el botón "Descargar respaldo" de la gestión. |

### Reglas que aplica el backend

Son las de la app de Power Apps y de la API de carga del 30-oct.

- **Solo se envía lo autorizado:** documentos Abierto, Cerrado, Detenido o "No aplica"; los borradores quedan en el teléfono.
- **ATS:** datos obligatorios, IPER en SI, las 12 preguntas 360° sin NO, riesgos fatales y no fatales completos, cada riesgo en SI con controles, y la firma del supervisor. Al cerrar, además: los 9 checks de cierre, la hora de término, el supervisor que cierra y su firma.
- **TTR:** la tarea tiene que estar activa en el Listado; cada DNI, habilitado en la tarea; el ATS de inicio tiene que ser de inicio de turno, estar autorizado y tener 15 días o menos (hora de Argentina). Si el ATS de inicio todavía no llegó (lo hicieron en otro teléfono sin señal), la TTR se guarda con un aviso.
- **Personal:** se agregan solo las personas que todavía no firmaron ese código. No se aceptan DNI repetidos y la firma tiene que ser una imagen (`data:image/`).
- **409:** no modifica registros cargados desde la app de Power Apps ni desde la API de carga (su `AppVersion` no empieza con "Web"); un documento cerrado o detenido no vuelve atrás.
- **Envíos simultáneos:** dos envíos al mismo tiempo del mismo código se hacen de a uno.

### Qué queda en la base

Las tablas `registros`, `personal`, `tareas` y `personas` tienen **las mismas columnas y formatos que las listas de SharePoint** (`Verif360` = `1=SI 2=N/A …`, `RiesgosNoFatales` = `riesgo: 1,11; …`, `PersonalCapacitado` = `;dni;dni;`), más `id`, `creado_el`, `modificado_el` y `sp_id`. Así la migración, las reglas y cualquier exportación son 1 a 1. `sp_id` es solo el número que tenía la fila en SharePoint, para saber de dónde vino lo migrado; la app no lo usa y queda vacío en todo lo nuevo. `AppVersion` = `Web v2 · 3-nov`; `CreadoPorEmail` y `CreadoPorNombre` = el usuario que pasó la otra app.

Para mirar la base a mano: cualquier visor de SQLite (DB Browser for SQLite, la extensión SQLite de VS Code) sobre una copia de `ats2.sqlite`. Power BI entra por el conector ODBC de SQLite sobre una copia, o mejor por una exportación programada.

## Sin señal

- **Dónde queda todo:** en IndexedDB del navegador (documentos, firmas, Listado de tareas, padrón, últimos datos usados).
- **Cuándo se envía:** al abrir la app, al volver la señal, apenas algo queda pendiente (autorizar, cerrar, detener, una firma nueva) y con el botón "Enviar ahora".
- **Errores:** si el backend rechaza un documento (400 o 409), el inicio muestra el motivo.
- **Limpieza automática:** lo ya enviado se borra del teléfono a los 3 días; los ATS de inicio de turno, a los 16; los borradores, a los 7.

## Diferencias con las apps de Power Apps

| | Power Apps | Web |
|---|---|---|
| **Datos** | Listas de SharePoint ATSHSS | Base SQLite propia (única fuente). SharePoint queda como historial. |
| **Escaneo** | Lector de la app | Cámara del navegador con zxing (QR y PDF417 del DNI); pide permiso de cámara y HTTPS. |
| **NFC** | App Power Apps del celular | Web NFC: solo Chrome de Android. En iPhone y PC, escanear el QR. |
| **Abrir sin señal** | Funciona | Una página web no abre sin señal la primera vez. Una vez abierta, se puede trabajar sin señal y no se pierde nada. Para abrirla en frío sin señal, la app de operaciones tiene que ser una PWA con service worker. |
| **Licencias** | Standard de M365 | Ninguna de Microsoft. |
| **Gestión** | App "ATS Gestión" (solo HSS) | `/gestion` para los correos de `GESTION_EMAILS` o el rol `ats-gestion`. |

## Estado

**Probado el 3-nov-2026**, en la PC:

- **Backend:** 45 pruebas automáticas (reglas sobre SQLite y sobre JSON, gestión por HTTP en modos dev, JWT y proxy, migración desde JSON de SharePoint, respaldo, Graph simulado).
- **Migración con los datos reales de ATSHSS** (exportados el 3-nov con la REST API): 2 ATS (uno cerrado con firma de autorización y de cierre, uno detenido), 1 firma de personal, 2 tareas y 98 personas con credencial, en `datos/ats2-migrado.sqlite` (no viaja en el zip). ID de SharePoint y fecha de creación conservados.
- **ATS 2.0 web (2-nov):** recorrido completo en el navegador a 375 px (ATS, TTR, TTR con "cambió algo", envío con el servidor caído).
- **Gestión web (3-nov):** en el navegador a 1366×768 contra el backend SQLite: ATS cargados y ATS válidos con un ATS de inicio de prueba (vale hasta + 15 días), su detalle (QR, datos, firma del personal y del supervisor), alta y reedición de una tarea con riesgo fatal, fecha y personal habilitado, alta de una persona (DNI con puntos guardado normalizado), hoja de impresión de credenciales y conteos del menú al guardar. **No probado:** el diálogo de impresión real, la pantalla "sin acceso" (403), el detalle de una TTR real.

**Diferencias de la gestión web con ATS Gestión de Power Apps:** no hay botón "SharePoint ↗" (la base es la única fuente); el período "Hoy" es el día de hoy y hay un chip "Todos"; la hoja de QR imprime todas las páginas de una vez; la tabla de ATS cargados suma la columna Firmas y el detalle muestra más campos (GPS, país, versión, reconocimiento, cambios de la TTR, firma de cierre); los DNI del padrón se guardan sin puntos ni guiones, como los lee el escáner.

**Falta:**

- Construir la imagen de Docker en un servidor con Docker (en la PC de HSS no hay Docker: `Dockerfile`, `compose.yaml` y `railway.toml` están escritos pero sin correr). El primer destino es Railway, para probar con HTTPS desde el celular.
- Cámara y NFC en un **celular real**.
- La integración dentro de la app de operaciones: quién la mantiene, dónde corre, y si la TTR la firma cada trabajador desde su sesión o el supervisor carga al equipo.
- Decidir cuándo se retiran las apps de Power Apps (ATS 2.0 v18 y ATS Gestión a8) y dejar las listas de ATSHSS en solo lectura.
