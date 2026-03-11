FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN mkdir -p dist/storage/migrations && cp -R src/storage/migrations/. dist/storage/migrations/

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist/ ./dist/
EXPOSE 3210
CMD ["node", "dist/server.js"]
