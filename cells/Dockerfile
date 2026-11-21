# Primordial game server
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

RUN apk add --no-cache su-exec

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Profiles live in /data — bind-mount a host directory there (see compose.yaml).
# The entrypoint fixes its ownership and runs the game as PUID:PGID (default 1000, not root).
RUN mkdir -p /data && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/server.js"]
