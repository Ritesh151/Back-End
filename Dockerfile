FROM mcr.microsoft.com/playwright:v1.47.0-jammy AS builder

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/

RUN npm install

COPY backend/src ./backend/src

RUN npm run build --workspace=backend

FROM mcr.microsoft.com/playwright:v1.47.0-jammy AS runner

WORKDIR /app

# The Playwright image already has a 'pwuser' user, so we don't need to adduser
# We can just use it directly, or keep running as root. Render supports both.
# We will use pwuser for security best practices.

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Render needs to be able to write to /tmp or /app if Playwright stores temp files, 
# so we change ownership of /app to pwuser
RUN chown -R pwuser:pwuser /app

USER pwuser

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/app.js"]
