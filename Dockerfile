# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite INLINES env vars at build time — they are not read at runtime. The
# deployed app talks to the backend through the ingress on the same host, so
# an empty base URL (same origin) is correct and nothing host-specific gets
# baked into the image.
ENV VITE_API_URL=""
ENV VITE_STAPLE_GRAPHQL_URL="/staple/graphql"
RUN npm run build

# ── serve ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 8080 so the container can run as non-root.
EXPOSE 8080
