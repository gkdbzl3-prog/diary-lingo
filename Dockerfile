# fly.io에 올리는 이미지. Express가 API와 빌드한 프론트를 같이 서빙한다.
# 저장은 Firestore라서 디스크에 남기는 것이 없다(머신이 꺼졌다 켜져도 괜찮다).

FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.3.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN npm install -g pnpm@12.3.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune
COPY src ./src
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8080
CMD ["node", "src/server.js"]
