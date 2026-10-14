FROM autochek/base-images:node24alpine AS base

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json .npmrc ./
COPY scripts ./scripts
RUN npm install

COPY . .
RUN npm run build

FROM autochek/base-images:node24alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/package*.json ./
COPY --from=base /app/.npmrc ./.npmrc
COPY --from=base /app/scripts ./scripts

RUN npm install --omit=dev

COPY --from=base /app/dist ./dist

RUN chmod +x ./scripts/start.sh

EXPOSE 3000

CMD ["sh", "/app/scripts/start.sh"]
