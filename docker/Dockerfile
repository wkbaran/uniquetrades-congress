# Build from the repo root:  docker build -f docker/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    LOG_TO_STDOUT=1 \
    OLLAMA_URL=http://host.docker.internal:11434
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Cached data, reports, site output, and OCR logs all live under the working directory
RUN mkdir -p data reports output formatted-reports logs && chown -R node:node /app
USER node
ENTRYPOINT ["node", "dist/index.js"]
CMD ["report:html", "--skip-unchanged"]
