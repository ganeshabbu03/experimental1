FROM node:22-bookworm-slim

# Workspace service uses git to clone repos, node-pty needs build tools, Prisma needs openssl
RUN apt-get update && apt-get install -y git openssl python3 build-essential default-jdk && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8080 \
    PRISMA_DB_PUSH_ON_START=false \
    EXTENSION_HOST_AUTOLOAD=false

EXPOSE 8080
CMD ["sh", "scripts/start.sh"]
