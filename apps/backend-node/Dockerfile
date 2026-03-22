# apps/backend-node/Dockerfile
FROM node:22-bookworm-slim

# Workspace service uses git to clone repos, node-pty needs build tools, Prisma needs openssl
RUN apt-get update && apt-get install -y git openssl python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm audit fix || true

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
