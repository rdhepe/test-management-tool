FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --ignore-scripts
RUN cd server && npm install --omit=dev --ignore-scripts

# Install Playwright browsers + OS dependencies
RUN cd server && npx playwright install --with-deps chromium

# Install k6 for performance testing
RUN apt-get update && apt-get install -y ca-certificates curl gnupg && \
    curl -fsSL https://dl.k6.io/key.gpg | gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
      > /etc/apt/sources.list.d/k6.list && \
    apt-get update && apt-get install -y k6 && \
    rm -rf /var/lib/apt/lists/*

# Copy everything and build the Vite frontend
# bust-cache: 2026-03-06c
COPY . .
RUN npm run build

CMD ["node", "server/server.js"]
