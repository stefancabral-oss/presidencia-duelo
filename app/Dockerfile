FROM node:22-alpine AS build

WORKDIR /repo
COPY app/package*.json app/
RUN npm ci --prefix app

COPY app app
COPY shared shared
# O build pós-Vite compara o dist com o manifesto de evidência. O contexto
# canônico é a raiz do repositório (README); o arquivo entra só no estágio de
# build e nunca é copiado para a imagem final do nginx.
COPY stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json

ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN npm run build --prefix app

FROM nginx:1.27-alpine
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
