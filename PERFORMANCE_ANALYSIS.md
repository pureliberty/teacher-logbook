# 성능 분석 및 최적화 권장사항

## 🖥️ 서버 환경

### 하드웨어
- **모델**: Synology NAS 220+ 시리즈
- **CPU**: Intel Celeron J4025 (2코어 2.0GHz, 버스트 2.9GHz)
- **메모리**: 10GB RAM
- **그래픽**: 없음 (온보드)
- **스토리지**: HDD/SSD (RAID 구성 가능)

### 예상 부하
- **동시 접속자**: 최대 300명
- **사용 패턴**: 학생 기록 조회/편집

## 📊 성능 분석

### 1. CPU 사용률
**현재 구성:**
- PostgreSQL: 중간 부하
- Redis: 낮은 부하
- Backend (FastAPI): 중간 부하
- Frontend (Nginx): 낮은 부하

**예상 사용률 (300명 동시 접속):**
```
전체 CPU: 60-80%
├── PostgreSQL: 30-40%
├── Backend API: 20-30%
├── Redis: 5-10%
└── Nginx: 5-10%
```

**결론**: ⚠️ **CPU가 병목될 가능성 있음**

### 2. 메모리 사용량
**현재 구성:**
```
PostgreSQL: 2-3GB (shared_buffers + work_mem)
Redis: 500MB-1GB
Backend: 500MB-1GB
Nginx: 100-200MB
기타 (OS, Docker): 1-2GB
-------------------
총 예상: 4-7GB
```

**여유 메모리**: 3-6GB

**결론**: ✅ **메모리는 충분함**

### 3. 네트워크 대역폭
**예상 트래픽 (300명):**
```
페이지 로드: 2MB/사용자
동시 접속: 300명
-------------------
초기 로드: 600MB (분산 접속 시 10분간 1MB/s)
운영 중: 평균 100KB/s (실시간 업데이트)
```

**결론**: ✅ **기가비트 이더넷으로 충분**

### 4. 디스크 I/O
**PostgreSQL 쓰기:**
```
동시 편집: 최대 50명 가정
평균 기록 크기: 2KB
초당 쓰기: 100KB/s
```

**결론**: ✅ **HDD로도 충분, SSD 권장**

## ⚠️ 병목 지점

### 1. CPU (주요 병목)
- Intel Celeron J4025는 2코어만 제공
- 300명 동시 접속 시 CPU 사용률 70-90% 예상
- 복잡한 쿼리나 동시 편집 시 응답 지연 가능

### 2. PostgreSQL 연결 수
- 기본 max_connections: 100
- 300명 접속 시 연결 풀 부족 가능

### 3. FastAPI 워커 수
- 기본 설정: 1 워커
- 2코어 CPU에서 최적: 3-4 워커

## ✅ 최적화 권장사항

### 1. PostgreSQL 설정 조정

```sql
-- max_connections 증가
ALTER SYSTEM SET max_connections = 200;

-- shared_buffers 조정 (메모리의 25%)
ALTER SYSTEM SET shared_buffers = '2GB';

-- work_mem 조정
ALTER SYSTEM SET work_mem = '16MB';

-- effective_cache_size 조정 (메모리의 50%)
ALTER SYSTEM SET effective_cache_size = '5GB';

-- 연결 풀링 타임아웃
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60000'; -- 60초
```

### 2. Backend 워커 수 증가

**docker-compose.yml 수정:**
```yaml
backend:
  command: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
  deploy:
    resources:
      limits:
        cpus: '1.5'
        memory: 2G
```

### 3. Redis 메모리 제한

**docker-compose.yml 수정:**
```yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### 4. Nginx 캐싱 활성화

**nginx.conf 추가:**
```nginx
http {
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
    
    server {
        location /api/ {
            proxy_cache my_cache;
            proxy_cache_valid 200 5m;
        }
    }
}
```

### 5. 데이터베이스 인덱스 최적화

**init.sql에 추가할 인덱스:**
```sql
-- 복합 인덱스 추가
CREATE INDEX idx_records_student_subject ON records(student_user_id, subject_id);
CREATE INDEX idx_records_updated ON records(updated_at DESC);
CREATE INDEX idx_versions_record_created ON record_versions(record_id, created_at DESC);

-- 부분 인덱스
CREATE INDEX idx_editable_records ON records(student_user_id) WHERE is_editable_by_student = true;
```

### 6. 연결 풀링 (PgBouncer 추가)

**docker-compose.yml에 추가:**
```yaml
pgbouncer:
  image: pgbouncer/pgbouncer:latest
  environment:
    DATABASES_HOST: postgres
    DATABASES_PORT: 5432
    DATABASES_USER: logbook_user
    DATABASES_PASSWORD: logbook_pass_2025
    DATABASES_DBNAME: teacher_logbook
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 1000
    PGBOUNCER_DEFAULT_POOL_SIZE: 25
  depends_on:
    - postgres
  networks:
    - logbook-network
```

## 📈 예상 성능 (최적화 후)

### 동시 접속자 처리 능력

**최적화 전:**
- 안정적 동시 접속: 100-150명
- 최대 동시 접속: 200-250명 (느린 응답)
- 300명 접속 시: 타임아웃 발생 가능

**최적화 후:**
- 안정적 동시 접속: 200-250명
- 최대 동시 접속: 300-350명
- 평균 응답 시간: 200-500ms

### 응답 시간

| 작업 | 최적화 전 | 최적화 후 |
|------|-----------|-----------|
| 로그인 | 100-200ms | 50-100ms |
| 목록 조회 | 200-500ms | 100-200ms |
| 기록 편집 | 300-700ms | 150-300ms |
| 저장 | 500-1000ms | 200-500ms |

## 🚨 추가 권장사항

### 1. 모니터링 시스템 구축
```yaml
# Prometheus + Grafana 추가
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
```

### 2. 로드 밸런싱 (향후)
- Nginx 리버스 프록시로 Backend 복수 인스턴스 운영
- Docker Swarm 또는 Kubernetes 고려

### 3. CDN 사용
- Static 파일(CSS, JS, 이미지)을 CDN으로 서빙
- CloudFlare 무료 플랜 사용 가능

### 4. 데이터베이스 백업 자동화
```bash
# Cron 작업 추가
0 2 * * * docker exec teacher-logbook-db pg_dump -U logbook_user teacher_logbook > /backup/db_$(date +\%Y\%m\%d).sql
```

## 🎯 결론

### ✅ 가능한 것
- **200-250명 안정적 동시 접속** (최적화 후)
- 일반적인 사용 시나리오에서 원활한 작동
- 메모리와 네트워크는 충분

### ⚠️ 주의사항
- **CPU가 주요 병목**
- 300명 동시 접속 시 응답 지연 가능
- 피크 시간대 모니터링 필요

### 💡 장기 해결책
1. **CPU 업그레이드**: 4코어 이상 권장
2. **스케일 아웃**: 여러 서버로 분산
3. **캐싱 강화**: Redis 활용 증대

## 📊 실제 테스트 권장

```bash
# Apache Bench로 부하 테스트
ab -n 1000 -c 50 http://localhost:40000/api/records

# 결과 분석
# - Requests per second
# - Time per request
# - Connection Times
```

현재 구성으로 **최적화 적용 시 300명 동시 접속이 가능**하지만, **여유가 많지 않습니다**. 모니터링을 통해 실제 사용 패턴을 분석하고 추가 최적화가 필요할 수 있습니다.
