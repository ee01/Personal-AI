FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY src/storage/migrations/ ./src/storage/migrations/
EXPOSE 3210
CMD ["node", "dist/server.js"]
