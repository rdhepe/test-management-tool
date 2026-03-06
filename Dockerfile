FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --ignore-scripts
RUN cd server && npm install --omit=dev --ignore-scripts

# Install Playwright browsers + OS dependencies
RUN cd server && npx playwright install --with-deps chromium

# Copy everything and build the Vite frontend
# bust-cache: 2026-03-06c
COPY . .
RUN npm run build

CMD ["node", "server/server.js"]
