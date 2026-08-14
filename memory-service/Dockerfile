FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY .npmrc ./
RUN npm ci --include=dev --no-audit --no-fund && test -x node_modules/.bin/tsc
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN mkdir -p dist/storage/migrations && cp -R src/storage/migrations/. dist/storage/migrations/
RUN mkdir -p dist/analytics && cp src/analytics/schema.sql dist/analytics/schema.sql
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-slim
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/dist/ ./dist/
EXPOSE 3210
CMD ["node", "dist/server.js"]
