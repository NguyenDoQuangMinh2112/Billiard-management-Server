FROM oven/bun:1.1

WORKDIR /usr/src/app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "run", "index.ts"]
