FROM node:22-slim

# Install build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --ignore-scripts
RUN npm install --prefix server --omit=dev --ignore-scripts
RUN npm rebuild better-sqlite3 --prefix server

# Copy everything and build the Vite frontend
COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "server/server.js"]
