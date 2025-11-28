FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# init.sql을 이미지에 포함
COPY init.sql /app/init.sql

# 시작 스크립트 생성
RUN echo '#!/bin/sh\n\
    # Wait for Postgres to be ready\n\
    sleep 5\n\
    PGPASSWORD=$DB_PASSWORD psql -h postgres -U $DB_USER -d $DB_NAME -f /app/init.sql || true\n\
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4\n\
    ' > /app/start.sh && chmod +x /app/start.sh
    
CMD ["/app/start.sh"]

# Expose port
#EXPOSE 8000

# Run the application
#CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
