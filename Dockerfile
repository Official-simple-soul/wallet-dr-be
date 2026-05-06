FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY server.ts ./

RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/server.js"]