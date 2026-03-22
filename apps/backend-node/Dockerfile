FROM node:22-bookworm-slim

# Workspace service uses git to clone repos, node-pty needs build tools, Prisma needs openssl
RUN apt-get update && apt-get install -y git openssl python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/main"]
