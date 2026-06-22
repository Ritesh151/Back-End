FROM mcr.microsoft.com/playwright:v1.47.0-jammy AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM mcr.microsoft.com/playwright:v1.47.0-jammy AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R pwuser:pwuser /app

USER pwuser

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
