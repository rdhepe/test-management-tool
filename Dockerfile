FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci
RUN npm install --prefix server --omit=dev

# Copy everything and build the Vite frontend
COPY . .
RUN npm run build

CMD ["node", "server/server.js"]
