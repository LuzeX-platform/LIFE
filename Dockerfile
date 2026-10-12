# Bouwcontext is de root van de repository: de server serveert ook frontend/ en neemt de
# planlogica (src/planner) mee die in dist/ wordt gecompileerd.
#
# Debian-slim en niet Alpine, net als bij ACCRD: argon2 levert prebuilds voor glibc, op Alpine's
# musl valt npm terug op zelf compileren. python3/make/g++ staan er voor het geval dat toch gebeurt.

FROM node:22-bookworm-slim AS bouwen
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS draaien
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
# Volledige node_modules, inclusief de prisma-CLI (een devDependency): de migratiestap hieronder
# heeft die nodig. Een aparte productie-install zou dit bestand ingewikkelder maken voor weinig winst.
COPY --from=bouwen /app/node_modules ./node_modules
COPY --from=bouwen /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
COPY frontend ./frontend
EXPOSE 4000
# `prisma migrate deploy` bij elke start: past alleen nog niet toegepaste migraties toe, dus
# veilig bij elke herstart. Lukt de migratie niet, dan start de server niet en blijft de vorige
# versie live.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/index.js"]
