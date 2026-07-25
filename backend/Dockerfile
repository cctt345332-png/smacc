FROM python:3.12-slim

WORKDIR /app

# تثبيت postgresql-client لـ pg_dump و psql
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# نسخ requirements أولاً للاستفادة من Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ باقي الملفات
COPY . .

# إنشاء مجلد النسخ الاحتياطية
RUN mkdir -p /backups

RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
