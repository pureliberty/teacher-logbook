FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# start.sh 생성 및 실행 권한 부여
RUN cat > /app/start.sh << 'EOF'
#!/bin/bash
set -e

echo "Wating for PostgreSQL..."
sleep 10

echo "Initializing database..."
PGPASSWORD=${DB_PASSWORD} psql -h postgres -U ${DB_USER} -d ${DB_NAME} -f /app/init.sql || echo "Database already initialized"

echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
EOF

# 실행 권한 명시적 부여
RUN chmod +x /app/start.sh

EXPOSE 8000

# start.sh 실행
CMD ["/bin/bash", "/app/start.sh"]