# 설치 가이드 (업데이트됨)

## ✅ 수정된 사항

### 1. 포트 변경
- **기존**: 80번 포트
- **변경**: **40000번 포트**
- **접속**: http://localhost:40000

### 2. 네트워크 설정
- **외부 네트워크 사용**: `logbook-network`
- **external: true** 설정 적용
- **host.docker.internal** 모든 서비스에 추가

### 3. Dockerfile 확인
- ✅ `backend/Dockerfile` - 존재
- ✅ `frontend/Dockerfile` - 존재
- ✅ 빌드 가능

## 🚀 설치 방법 (3가지)

### 방법 1: 자동 설치 스크립트 (권장)

**Linux/Mac:**
```bash
cd teacher-logbook
chmod +x install.sh
./install.sh
```

**Windows:**
```cmd
cd teacher-logbook
install.bat
```

### 방법 2: 수동 설치

```bash
# 1. 네트워크 생성 (최초 1회만)
docker network create logbook-network

# 2. 프로젝트 디렉토리로 이동
cd teacher-logbook

# 3. Docker Compose 실행
docker-compose up -d

# 4. 로그 확인
docker-compose logs -f
```

### 방법 3: 단계별 확인

```bash
# 1. Docker 버전 확인
docker --version
docker-compose --version

# 2. 네트워크 생성
docker network create logbook-network

# 3. 네트워크 확인
docker network ls | grep logbook-network

# 4. 이미지 빌드
docker-compose build

# 5. 컨테이너 실행
docker-compose up -d

# 6. 서비스 상태 확인
docker-compose ps

# 7. 각 서비스 로그 확인
docker-compose logs postgres
docker-compose logs redis
docker-compose logs backend
docker-compose logs frontend
```

## 🌐 접속 정보

### 웹 인터페이스
```
http://localhost:40000
```

### 초기 계정
- **관리자**: `root2025` / `1234!`
- **교사**: `T0200` / `1234!`
- **학생**: `S20101` / `1234!`

## 🔧 네트워크 상세 설정

### docker-compose.yml 주요 부분

```yaml
networks:
  logbook-network:
    external: true      # 외부 네트워크 사용
    name: logbook-network

services:
  frontend:
    ports:
      - "40000:80"      # 외부:내부 포트 매핑
    extra_hosts:
      - "host.docker.internal:host-gateway"  # 호스트 접근
```

### 네트워크 구조

```
Host Machine (localhost)
    ↓ port 40000
┌─────────────────────────────────────┐
│  logbook-network (external)         │
│                                     │
│  ┌──────────┐    ┌──────────┐     │
│  │ postgres │←───│ backend  │     │
│  │  :5432   │    │  :8000   │     │
│  └──────────┘    └────┬─────┘     │
│                       │            │
│  ┌──────────┐    ┌───┴──────┐    │
│  │  redis   │←───│ frontend │    │
│  │  :6379   │    │  :80     │    │
│  └──────────┘    └──────────┘    │
│                       ↑           │
└───────────────────────┼───────────┘
                        │
                   port 40000
                        ↓
                   사용자
```

## 📋 체크리스트

실행 전 확인:
- [ ] Docker 설치됨
- [ ] Docker Compose 설치됨
- [ ] 포트 40000 사용 가능
- [ ] 네트워크 생성됨 (`docker network create logbook-network`)
- [ ] Dockerfile 존재 확인
  - [ ] backend/Dockerfile
  - [ ] frontend/Dockerfile

실행 후 확인:
- [ ] 4개 컨테이너 실행 중 (postgres, redis, backend, frontend)
- [ ] http://localhost:40000 접속 가능
- [ ] 로그인 성공

## 🔍 문제 해결

### "network logbook-network declared as external, but could not be found"

```bash
docker network create logbook-network
```

### "port 40000 is already allocated"

**옵션 1**: 다른 포트 사용
```yaml
# docker-compose.yml
frontend:
  ports:
    - "8080:80"  # 40000 대신 8080 사용
```

**옵션 2**: 기존 프로세스 종료
```bash
# 포트 사용 프로세스 확인 (Linux/Mac)
lsof -i :40000

# 포트 사용 프로세스 확인 (Windows)
netstat -ano | findstr :40000
```

### 빌드 실패

```bash
# 캐시 없이 다시 빌드
docker-compose build --no-cache

# 또는 개별 서비스 빌드
docker-compose build backend
docker-compose build frontend
```

### 컨테이너 시작 실패

```bash
# 로그 확인
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend

# 실시간 로그
docker-compose logs -f
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 컨테이너 확인
docker-compose exec postgres psql -U logbook_user -d teacher_logbook

# 테이블 확인
\dt

# 사용자 수 확인
SELECT COUNT(*) FROM users;
```

## 🛑 종료 및 정리

### 정상 종료
```bash
docker-compose down
```

### 완전 삭제 (데이터 포함)
```bash
docker-compose down -v
```

### 네트워크 삭제
```bash
docker network rm logbook-network
```

### 완전 초기화
```bash
# 1. 모든 컨테이너 및 볼륨 삭제
docker-compose down -v

# 2. 이미지 삭제
docker-compose down --rmi all

# 3. 네트워크 재생성
docker network rm logbook-network
docker network create logbook-network

# 4. 재시작
docker-compose up -d
```

## 📞 지원

문제가 지속되면:
1. 로그 수집: `docker-compose logs > logs.txt`
2. 서비스 상태 확인: `docker-compose ps`
3. 네트워크 상태 확인: `docker network inspect logbook-network`

상세 정보는 `NETWORK_SETUP.md`를 참조하세요.
