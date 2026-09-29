# Self-hosted FinLens: static build served by unprivileged nginx on port 8080.
#   docker build -t finlens .
#   docker run --rm -p 8080:8080 finlens
# The processed data in public/data/processed must be committed or present (the raw workbook
# is not needed and is excluded by .dockerignore).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run data:verify && npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/finlens-security.conf /etc/nginx/snippets/finlens-security.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
