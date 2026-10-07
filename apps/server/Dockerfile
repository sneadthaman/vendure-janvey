FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci

FROM dependencies AS build

COPY . .
# Vendure's Dashboard compiler imports the config. Build without deployment secrets; the final
# runtime stage sets APP_ENV=production and performs the strict validation on process startup.
RUN APP_ENV=dev npm run build:server

FROM node:22-bookworm-slim AS production-dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci --omit=dev --workspace server --include-workspace-root

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV APP_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/server ./apps/server
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/static ./apps/server/static

EXPOSE 3000 3020
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.VENDURE_SERVER_PORT||3000)+'/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/index.js"]
