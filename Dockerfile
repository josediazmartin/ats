# ATS 2.0 web: un solo contenedor con el backend (Node 22 + SQLite incorporado) que sirve el frontend compilado.
# La base queda en el volumen /app/backend/datos (ats2.sqlite + respaldos). Ver compose.yaml y README.md.

# ---- 1) compilar el frontend (ATS 2.0 en / y la gestión en /gestion)
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2) imagen final: backend + dist del frontend
FROM node:22-alpine
ENV NODE_ENV=production \
    ALMACEN=sqlite \
    SQLITE_ARCHIVO=datos/ats2.sqlite \
    SERVIR_FRONTEND=../frontend/dist
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/datos/demo.json ./datos/demo.json
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN mkdir -p /app/backend/datos && chown -R node:node /app
USER node
# La base vive en /app/backend/datos: montar ahí un volumen (compose.yaml lo hace; en Railway, Add Volume con ese mount path).
# No se usa la instrucción VOLUME porque Railway la rechaza.
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.PUERTO||3001)+'/api/ats/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
