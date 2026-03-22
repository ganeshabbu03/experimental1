FROM node:22-alpine AS runtime

WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npm install -g serve

COPY . .

ENV PORT=4173
EXPOSE 4173

CMD ["sh", "-c", "npm run build && serve -s dist -l ${PORT:-4173}"]
