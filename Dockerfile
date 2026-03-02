FROM node:22-slim

# Install build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install root (frontend) deps — ignore scripts to skip postinstall
COPY package*.json ./
RUN npm ci --ignore-scripts

# Install server prod deps (compiles better-sqlite3 natively)
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev

# Copy everything and build the Vite frontend
COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "server/server.js"]
