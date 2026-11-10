FROM node:22-alpine

RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000

# db push crée/synchronise le schéma au démarrage (pratique en dev).
# En production, remplace-le par : npx prisma migrate deploy
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
