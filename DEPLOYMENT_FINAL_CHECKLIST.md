# 최종 배포 체크리스트 및 문제 해결

## ✅ 배포 준비 완료 사항

### 1. 코드 구조
- **Backend**: `main.py` (1,175줄) - FastAPI 서버, 30개 엔드포인트
- **Frontend**: TypeScript + React - 대시보드, 로그인, 관리자 페이지
- **Database**: `init.sql` (161줄) - 7개 테이블 + 자동 사용자 생성

### 2. Docker 이미지
- **backend/Dockerfile** (8줄): Python 3.11-slim, uvicorn 직접 실행
- **frontend/Dockerfile** (12줄): Node 멀티스테이지 빌드
- **docker-compose.yml** (99줄): 5개 서비스 자동 오케스트레이션

### 3. 데이터베이스 초기화
```
✅ CREATE DATABASE 문법 수정 (MySQL → PostgreSQL)
✅ 중복된 INSERT 제거 (단일 정의로 통합)
✅ 관리자 1명 자동 생성 (root2025/1234!)
✅ 선생님 61명 자동 생성 (T0200~T0260/1234!)
✅ 학생 700명 자동 생성 (S20101~S21035/1234!)
✅ 과목 5개 자동 생성 (국어, 영어, 수학, 사회, 과학)
```

### 4. 인증 시스템
```
✅ passlib + bcrypt 사용
✅ 비밀번호 검증: pwd_context.verify()
✅ JWT 토큰 발급: create_access_token()
✅ FormData 파싱: OAuth2PasswordRequestForm
✅ 로그인 응답: access_token + user_id + role + full_name
```

### 5. 볼륨 마운트
```
✅ ./backend:/app
✅ ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
✅ postgres_data:/var/lib/postgresql/data (명시적 볼륨)
```

---

## 🚀 Portainer 배포 절차

### Step 1: Synology NAS에서 네트워크 생성
```bash
# SSH로 Synology NAS 접속
ssh admin@[NAS-IP]

# 네트워크 생성
sudo docker network create logbook-network

# 확인
sudo docker network ls | grep logbook
```

### Step 2: Portainer에서 Stack 배포
```
1. Portainer 접속: http://[NAS-IP]:9000
2. Home > Environments > [NAS명] 선택
3. Stacks > Add Stack
4. Stack name: teacher-logbook
5. Paste the docker-compose content (전체 복사)
6. Deploy the stack
```

### Step 3: 배포 모니터링 (2-3분)
```
Portainer > Stacks > teacher-logbook에서 상태 확인:

[시간대]    [단계]
0초    - Stack 생성 시작
5초    - PostgreSQL 이미지 시작
10-15초 - PostgreSQL 초기화 (init.sql 실행)
        ├─ 테이블 생성
        ├─ 사용자 생성 (762명)
        └─ 인덱스 생성
20초    - PostgreSQL healthcheck PASS
25초    - Backend 컨테이너 시작
40초    - Backend 준비 완료
45초    - Frontend 컨테이너 시작
55초    - Frontend 준비 완료
60초    - ✅ Stack 완전히 시작됨 (모두 Green)
```

---

## 🔍 배포 후 검증

### 검증 1: 컨테이너 상태 확인
```bash
# Portainer Console에서
docker ps --format "table {{.Names}}\t{{.Status}}"

예상:
teacher-logbook-db       Up ... (healthy)
teacher-logbook-redis    Up ... (healthy)
teacher-logbook-backend  Up ...
teacher-logbook-frontend Up ...
```

### 검증 2: 데이터베이스 초기화 확인
```bash
# Portainer Console - teacher-logbook-db 선택 후
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT COUNT(*) FROM users;"

예상: 762
```

### 검증 3: 관리자 로그인
```
1. http://[NAS-IP]:40000 접속
2. ID: root2025
3. Password: 1234!
4. "Sign In" 클릭
5. ✅ 대시보드 표시 확인
```

### 검증 4: API 테스트
```bash
# 로그인 요청
curl -X POST http://[NAS-IP]:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=root2025&password=1234!"

예상 응답:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user_id": "root2025",
  "role": "admin",
  "full_name": "Administrator"
}
```

---

## ⚠️ 문제 해결 가이드

### 문제 1: "Backend 컨테이너 계속 재시작"

**증상:**
```
Portainer에서 teacher-logbook-backend가 계속 재시작 (Restarting)
```

**원인 분석:**
```bash
# 로그 확인
Portainer > teacher-logbook-backend > Logs

예상 오류:
- ModuleNotFoundError: No module named 'main'
- ConnectionRefusedError: PostgreSQL 연결 실패
- REDIS_URL 환경 변수 오류
```

**해결방법:**

1️⃣ **main.py 모듈 오류**
```
원인: Dockerfile의 WORKDIR이 잘못됨
확인: WORKDIR /app와 COPY . .가 있는가?
✅ 현재 Dockerfile은 정상
```

2️⃣ **PostgreSQL 연결 실패**
```
원인: postgres 서비스가 준비되지 않음
확인: docker-compose.yml의 depends_on 조건
✅ depends_on: postgres: {condition: service_healthy}가 있음

healthcheck 확인:
docker exec teacher-logbook-db pg_isready -U logbook_user
응답: accepting connections
```

3️⃣ **REDIS_URL 오류**
```
원인: redis 서비스 미실행 또는 연결 문제
확인: docker ps에서 teacher-logbook-redis 확인
해결:
- Portainer에서 redis 컨테이너 재시작
- 또는 전체 Stack 재시작
```

**재시작 절차:**
```
1. Portainer > Stacks > teacher-logbook
2. 각 서비스별 재시작 (또는 전체 Stack 재시작)
3. 1-2분 대기
4. 상태 확인
```

---

### 문제 2: "로그인 실패 (Incorrect username or password)"

**증상:**
```
로그인 페이지에서:
ID: root2025
Password: 1234!
→ "Incorrect username or password" 오류
```

**원인 분석:**
```bash
# PostgreSQL에서 확인
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook

> SELECT * FROM users WHERE user_id = 'root2025';

결과:
- user_id가 없음 → init.sql 실행 안 됨
- password_hash가 다름 → 해시 값 불일치
```

**해결방법:**

1️⃣ **init.sql 실행 안 됨 확인**
```bash
# PostgreSQL 로그 확인
docker logs teacher-logbook-db | grep -i "init.sql"

예상:
/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/init.sql
```

2️⃣ **테이블 생성 확인**
```bash
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "\dt"

예상: 7개 테이블 표시
```

3️⃣ **사용자 생성 확인**
```bash
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT COUNT(*) FROM users;"

예상: 762 (또는 적어도 1명 이상)
```

4️⃣ **수동 데이터베이스 초기화**
```bash
# PostgreSQL에 직접 init.sql 실행
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -f /docker-entrypoint-initdb.d/init.sql
```

5️⃣ **Stack 재배포**
```
최후의 수단:
1. Portainer > Stacks > teacher-logbook > Remove
2. postgres_data 볼륨 삭제 (데이터 초기화)
3. 다시 Stack 배포
```

---

### 문제 3: "프론트엔드 접속 불가 (Connection refused)"

**증상:**
```
http://[NAS-IP]:40000
→ "연결 거부" 또는 타임아웃
```

**원인 분석:**
```
1. Nginx 서버 미시작
2. 포트 40000 바인딩 실패
3. NAS 방화벽 차단
4. 네트워크 설정 오류
```

**해결방법:**

1️⃣ **컨테이너 상태 확인**
```bash
docker ps | grep frontend

예상: teacher-logbook-frontend가 Up 상태
```

2️⃣ **포트 바인딩 확인**
```bash
docker port teacher-logbook-frontend

예상: 80/tcp -> 0.0.0.0:40000
```

3️⃣ **Nginx 로그 확인**
```bash
docker logs teacher-logbook-frontend

정상 메시지:
- nginx: master process started
- worker process started
```

4️⃣ **로컬에서 테스트** (NAS 내부)
```bash
curl -X GET http://localhost:40000

예상: HTML 반환 (또는 302 리다이렉트)
```

5️⃣ **NAS 방화벽 확인**
```bash
# Synology NAS에서
sudo ufw status

또는 DSM 설정에서:
Control Panel > Security > Firewall > Edit Rules
→ 포트 40000 인바운드 허용
```

---

### 문제 4: "데이터베이스 크기 계속 증가"

**증상:**
```
postgres_data 볼륨이 비정상적으로 커짐
```

**원인:**
```
init.sql이 여러 번 실행됨
→ ON CONFLICT 절이 없거나 오류 발생
```

**해결방법:**
```bash
# 현재 사용자 수 확인
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT COUNT(*) FROM users;"

# 762명 이상이면 중복 생성됨
# → ON CONFLICT 절 확인 및 init.sql 재검토
```

---

## 📊 모니터링 스크립트

### 정기적 체크
```bash
#!/bin/bash
# check-status.sh

echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== Database Health ==="
docker exec teacher-logbook-db pg_isready -U logbook_user

echo ""
echo "=== Redis Health ==="
docker exec teacher-logbook-redis redis-cli ping

echo ""
echo "=== User Count ==="
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT COUNT(*) as 'Total Users' FROM users;"

echo ""
echo "=== API Health ==="
curl -s http://localhost:8000/health | jq .

echo ""
echo "=== Frontend Health ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:40000
```

---

## 📝 배포 후 설정

### 1. SECRET_KEY 변경 (필수)
```bash
# docker-compose.yml에서
environment:
  SECRET_KEY: your-secret-key-change-in-production-2025
                ↓ 변경
  SECRET_KEY: $(openssl rand -hex 32)
```

### 2. CORS_ORIGINS 수정 (필수)
```bash
# docker-compose.yml에서
CORS_ORIGINS: http://localhost:40000,http://localhost:3000
              ↓ 변경
CORS_ORIGINS: http://[NAS-IP]:40000
```

### 3. PostgreSQL 비밀번호 변경 (권장)
```bash
# docker-compose.yml에서
POSTGRES_PASSWORD: logbook_pass_2025
                   ↓ 변경하고
DATABASE_URL: postgresql://logbook_user:logbook_pass_2025@...
              위 비밀번호와 일치시킬 것
```

### 4. 백업 설정
```bash
# 주간 백업 스크립트
docker exec teacher-logbook-db pg_dump -U logbook_user teacher_logbook > /backup/db_$(date +\%Y\%m\%d).sql
```

---

## ✅ 최종 확인 체크리스트

배포 완료 후 다음을 모두 확인하세요:

- [ ] PostgreSQL 컨테이너: Green (healthy)
- [ ] Redis 컨테이너: Green (healthy)
- [ ] Backend 컨테이너: Green
- [ ] Frontend 컨테이너: Green
- [ ] http://[NAS-IP]:40000 접속 가능
- [ ] root2025 / 1234! 로그인 성공
- [ ] 대시보드 페이지 표시
- [ ] 과목 목록 로드
- [ ] 학생 레코드 테이블 표시
- [ ] 데이터베이스: 762명 사용자 생성
- [ ] 데이터베이스: 5개 과목 생성
- [ ] 로그에 오류 없음
- [ ] API 헬스체크 (200 응답)
