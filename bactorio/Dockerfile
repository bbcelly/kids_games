# Biofilm game server (static files + mods listing). No npm dependencies at runtime.
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=8081 \
    MODS_DIR=/mods

RUN apk add --no-cache su-exec

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
# bundled example mods; copied into an empty /mods on first start (see the entrypoint)
COPY mods ./mods-bundled
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Mods live in /mods — bind-mount a host directory there (see compose.yaml).
RUN mkdir -p /mods && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8081)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/server.js"]
