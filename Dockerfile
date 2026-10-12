FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node server ./server
COPY --chown=node:node dist ./dist
RUN mkdir /data && chown node:node /data
USER node
ENV BIND=0.0.0.0 PORT=3000 DB_PATH=/data/folio.sqlite
EXPOSE 3000
CMD ["node", "server/app.mjs"]
