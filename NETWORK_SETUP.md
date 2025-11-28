# 네트워크 설정 가이드

## 외부 네트워크 생성

Docker Compose를 실행하기 전에 외부 네트워크를 먼저 생성해야 합니다.

### 1. 네트워크 생성

```bash
docker network create logbook-network
```

### 2. 네트워크 확인

```bash
docker network ls | grep logbook-network
```

출력 예시:
```
abc123def456   logbook-network   bridge    local
```

### 3. Docker Compose 실행

```bash
docker-compose up -d
```

## 네트워크 설정 설명

### External Network
```yaml
networks:
  logbook-network:
    external: true
    name: logbook-network
```

- **external: true**: 외부에서 미리 생성된 네트워크 사용
- 여러 Docker Compose 프로젝트가 동일 네트워크 공유 가능
- 네트워크가 없으면 에러 발생

### host.docker.internal

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

- 컨테이너 내부에서 호스트 머신에 접근 가능
- `host.docker.internal`로 호스트의 서비스 접근
- Linux에서도 자동으로 호스트 IP 매핑

## 포트 설정

### 외부 포트: 40000
```yaml
frontend:
  ports:
    - "40000:80"
```

- **외부 접근**: http://localhost:40000
- **컨테이너 내부**: 80번 포트

### 내부 서비스 포트 (외부 노출 안됨)
- PostgreSQL: 5432 (내부만)
- Redis: 6379 (내부만)
- Backend API: 8000 (내부만)

## 문제 해결

### "network logbook-network declared as external, but could not be found"

**해결 방법:**
```bash
docker network create logbook-network
```

### 네트워크 재생성이 필요한 경우

```bash
# 기존 네트워크 삭제
docker network rm logbook-network

# 새로 생성
docker network create logbook-network
```

### 다른 프로젝트와 네트워크 공유

이미 `logbook-network`가 존재하면 재사용됩니다:

```bash
# 프로젝트 1
cd project1
docker-compose up -d

# 프로젝트 2 (같은 네트워크 사용)
cd ../project2
docker-compose up -d
```

## 완전한 설치 순서

```bash
# 1. 네트워크 생성
docker network create logbook-network

# 2. 프로젝트 디렉토리로 이동
cd teacher-logbook

# 3. Docker Compose 실행
docker-compose up -d

# 4. 로그 확인
docker-compose logs -f

# 5. 브라우저 접속
# http://localhost:40000
```

## 네트워크 정보 확인

```bash
# 네트워크 상세 정보
docker network inspect logbook-network

# 연결된 컨테이너 확인
docker network inspect logbook-network | grep -A 5 Containers
```
