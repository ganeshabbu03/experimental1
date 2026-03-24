FROM node:22-bookworm-slim

# Workspace service uses git to clone repos, node-pty needs build tools, Prisma needs openssl
RUN apt-get update && apt-get install -y git openssl python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080
CMD ["sh", "-c", "echo '[Startup] Container starting...'; if [ -n \"${DATABASE_URL}\" ]; then timeout 30 npx prisma db push 2>&1 || echo '[warn] prisma db push failed or timed out'; else echo '[warn] DATABASE_URL not set; skipping prisma db push'; fi; echo '[Startup] Launching node dist/main...'; exec node dist/main"]
