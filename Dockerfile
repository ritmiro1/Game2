FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY core ./core
COPY server ./server
ENV NODE_ENV=production PORT=3101 LIFEOS_DATA_DIR=/data
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3101
VOLUME ["/data"]
CMD ["node", "server/index.mjs", "--search-only"]
