FROM node:21-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install

COPY . .

RUN pnpm build

RUN pnpm prune --prod && pnpm store prune

CMD ["node", "dist/src/main.js"]
