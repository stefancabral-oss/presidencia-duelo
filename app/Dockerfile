FROM node:22-alpine AS build

WORKDIR /repo
COPY app/package*.json app/
RUN npm ci --prefix app

COPY app app
COPY front front
COPY shared shared

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --prefix app

FROM nginx:1.27-alpine
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
