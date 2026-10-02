FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/api apps/api
RUN npm run build -w @mam-chung/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm","run","start","-w","@mam-chung/api"]