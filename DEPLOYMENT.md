# 쌩기부 배포 가이드

## 📦 프로젝트 정보

- **프로젝트명**: 쌩기부 (학생 기록 관리 시스템)
- **GitHub**: pureliberty
- **Docker Hub**: m4rum4ru
- **서버**: Synology NAS 220+ (10GB RAM)
- **예상 동시 접속**: 300명

## 🚀 배포 프로세스

### 1. GitHub에 코드 푸시

```bash
# Git 초기화 (최초 1회)
cd teacher-logbook
git init
git add .
git commit -m "Initial commit: 쌩기부 시스템"

# GitHub 리포지토리 연결
git remote add origin https://github.com/pureliberty/teacher-logbook.git
git branch -M main
git push -u origin main
```

### 2. Docker 이미지 빌드

```bash
# Backend 빌드
cd backend
docker build -t m4rum4ru/teacher-logbook-backend:latest .
docker push m4rum4ru/teacher-logbook-backend:latest

# Frontend 빌드
cd ../frontend
docker build -t m4rum4ru/teacher-logbook-frontend:latest .
docker push m4rum4ru/teacher-logbook-frontend:latest
```

### 3. Synology NAS 배포

#### 방법 1: Docker Compose (권장)

```bash
# NAS SSH 접속
ssh admin@your-nas-ip

# 프로젝트 다운로드
git clone https://github.com/pureliberty/teacher-logbook.git
cd teacher-logbook

# 네트워크 생성
docker network create logbook-network

# 배포
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

#### 방법 2: Portainer 사용

1. Portainer 접속: `http://nas-ip:9000`
2. Stacks → Add stack
3. Name: `teacher-logbook`
4. Web editor에 docker-compose.yml 붙여넣기
5. Environment variables 설정:
   - `DATABASE_URL`: PostgreSQL 연결 정보
   - `SECRET_KEY`: 랜덤 키 생성
6. Deploy the stack

### 4. 데이터베이스 초기화

```bash
# PostgreSQL 컨테이너 접속
docker exec -it teacher-logbook-db psql -U logbook_user -d teacher_logbook

# init.sql이 자동 실행되었는지 확인
\dt

# 사용자 수 확인
SELECT role, COUNT(*) FROM users GROUP BY role;

# 결과:
#  role    | count 
# ---------+-------
#  admin   |     1
#  teacher |    61
#  student |   350
```

### 5. 접속 및 테스트

```
http://nas-ip:40000
```

**초기 계정:**
- 관리자: `root2025` / `1234!`
- 교사: `T0200` / `1234!`
- 학생: `S20101` / `1234!`

## 🔧 docker-compose.yml 설정

### 기본 설정

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: teacher_logbook
      POSTGRES_USER: logbook_user
      POSTGRES_PASSWORD: logbook_pass_2025  # 변경 권장!
      # 성능 최적화 (300명 동시 접속)
      POSTGRES_MAX_CONNECTIONS: 200
      POSTGRES_SHARED_BUFFERS: 2GB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 5GB
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 3G

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  backend:
    image: m4rum4ru/teacher-logbook-backend:latest
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
    environment:
      DATABASE_URL: postgresql://logbook_user:logbook_pass_2025@postgres:5432/teacher_logbook
      REDIS_URL: redis://redis:6379
      SECRET_KEY: CHANGE_THIS_TO_RANDOM_SECRET_KEY
    depends_on:
      - postgres
      - redis
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 2G

  frontend:
    image: m4rum4ru/teacher-logbook-frontend:latest
    ports:
      - "40000:80"
    depends_on:
      - backend
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

volumes:
  postgres_data:

networks:
  logbook-network:
    external: true
```

## 📊 성능 모니터링

### 시스템 리소스 확인

```bash
# 전체 컨테이너 상태
docker stats

# 특정 컨테이너 리소스
docker stats teacher-logbook-backend

# CPU 사용률 모니터링
top
```

### 로그 확인

```bash
# 전체 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend

# 실시간 로그
docker-compose logs -f backend

# 최근 100줄
docker-compose logs --tail=100 backend
```

### 데이터베이스 상태

```bash
# 연결 수 확인
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT count(*) FROM pg_stat_activity;"

# 테이블 크기
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT pg_size_pretty(pg_database_size('teacher_logbook'));"
```

## 🔐 보안 설정

### 1. 비밀번호 변경

**docker-compose.yml:**
```yaml
environment:
  POSTGRES_PASSWORD: YOUR_STRONG_PASSWORD_HERE
  SECRET_KEY: $(openssl rand -hex 32)
```

### 2. 방화벽 설정

```bash
# Synology DSM 방화벽
# 설정 → 보안 → 방화벽
# 포트 40000 허용
```

### 3. HTTPS 설정 (선택사항)

Nginx 리버스 프록시 + Let's Encrypt

## 🔄 업데이트 방법

### 코드 업데이트

```bash
# GitHub에서 최신 코드 가져오기
git pull origin main

# 이미지 재빌드
docker-compose build

# 재시작
docker-compose up -d
```

### 이미지 업데이트

```bash
# 새 버전 빌드
docker build -t m4rum4ru/teacher-logbook-backend:v1.1 backend/
docker push m4rum4ru/teacher-logbook-backend:v1.1

# NAS에서
docker-compose pull
docker-compose up -d
```

## 💾 백업

### 데이터베이스 백업

```bash
# 수동 백업
docker exec teacher-logbook-db pg_dump -U logbook_user teacher_logbook > backup_$(date +%Y%m%d).sql

# 복원
cat backup_20251127.sql | docker exec -i teacher-logbook-db psql -U logbook_user teacher_logbook
```

### 자동 백업 (Cron)

```bash
# crontab -e
0 2 * * * docker exec teacher-logbook-db pg_dump -U logbook_user teacher_logbook > /volume1/backups/teacher_logbook_$(date +\%Y\%m\%d).sql
```

## 🚨 문제 해결

### 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose logs

# 컨테이너 재시작
docker-compose restart

# 완전 재시작
docker-compose down
docker-compose up -d
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 상태 확인
docker exec teacher-logbook-db pg_isready -U logbook_user

# 연결 테스트
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT 1;"
```

### 메모리 부족

```bash
# 메모리 사용량 확인
docker stats

# 불필요한 컨테이너/이미지 삭제
docker system prune -a
```

## 📈 성능 최적화 권장사항

자세한 내용은 `PERFORMANCE_ANALYSIS.md` 참조

1. **PostgreSQL 설정 조정**
   - max_connections: 200
   - shared_buffers: 2GB
   - effective_cache_size: 5GB

2. **Backend 워커 수**: 4개

3. **Redis 메모리 제한**: 512MB

4. **리소스 제한 설정** (docker-compose.yml)

## ✅ 배포 체크리스트

- [ ] GitHub 리포지토리 생성
- [ ] Docker Hub 계정 확인
- [ ] 코드 푸시
- [ ] Docker 이미지 빌드 및 푸시
- [ ] NAS 네트워크 생성
- [ ] docker-compose.yml 설정
- [ ] SECRET_KEY 변경
- [ ] 비밀번호 변경
- [ ] 배포 실행
- [ ] 데이터베이스 확인
- [ ] 웹 접속 테스트
- [ ] 초기 계정 로그인
- [ ] 비밀번호 변경
- [ ] 백업 설정

## 🎯 다음 단계

1. 로그인 후 관리자 비밀번호 변경
2. 교사 계정 활성화 및 배포
3. 학생 계정 확인
4. 과목 추가/수정
5. 모니터링 설정
6. 정기 백업 확인

---

**GitHub**: https://github.com/pureliberty/teacher-logbook  
**Docker Hub**: https://hub.docker.com/u/m4rum4ru  
**문서**: README.md, PERFORMANCE_ANALYSIS.md
