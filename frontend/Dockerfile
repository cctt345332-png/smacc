FROM node:20-alpine AS builder

WORKDIR /app

# نسخ package files أولاً للاستفادة من Docker cache
COPY package.json ./
RUN npm install --prefer-offline

# نسخ باقي الملفات
COPY . .

# NEXT_PUBLIC_API_URL يُمرر وقت البناء
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN

RUN npm run build

# ── Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# نسخ ملفات الـ standalone build فقط
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
