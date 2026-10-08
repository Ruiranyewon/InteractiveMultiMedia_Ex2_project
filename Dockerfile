# better-sqlite3 는 네이티브 모듈이라 빌드 도구가 필요하다.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 QUIZ_DB_PATH=/data/quiz.db
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/instrumentation.ts ./
COPY --from=build /app/lib ./lib
COPY --from=build /app/data/questions.json /app/data/blocklist.txt ./data/
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./
VOLUME /data
EXPOSE 3000
# DB가 비어 있을 때만 문제를 적재한 뒤 서버를 시작한다.
CMD ["sh", "-c", "npm run seed:init && npm start"]
