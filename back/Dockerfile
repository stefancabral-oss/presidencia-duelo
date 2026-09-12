FROM node:22-alpine

WORKDIR /repo
COPY back/package*.json back/
RUN npm ci --omit=dev --prefix back

COPY back back
COPY shared shared

WORKDIR /repo/back
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
VOLUME ["/repo/back/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "start"]
