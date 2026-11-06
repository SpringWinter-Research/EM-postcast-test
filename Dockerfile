FROM mirror.gcr.io/oven/bun:1.3.10 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM mirror.gcr.io/oven/bun:1.3.10-slim AS runtime
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY src ./src
COPY migrations ./migrations
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/us-east-2/us-east-2-bundle.pem /app/rds-ohio.pem
ENV NODE_ENV=production
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]
