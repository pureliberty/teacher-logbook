# 배포 후 검증 체크리스트

## 1. 데이터베이스 초기화 확인

### 1.1 PostgreSQL 연결 테스트
```bash
# Portainer Console에서 postgres 컨테이너 실행
docker exec teacher-logbook-db psql -U logbook_user -d teacher_logbook -c "SELECT version();"
```

### 1.2 테이블 생성 확인
```sql
-- Portainer Console 또는 pgAdmin에서 실행
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 예상 결과 (7개 테이블):
-- comments
-- edit_locks
-- notifications
-- records
-- record_versions
-- subjects
-- users
```

### 1.3 사용자 계정 검증
```sql
-- 관리자 확인
SELECT user_id, full_name, role FROM users WHERE role = 'admin';
-- 예상: root2025 | Administrator | admin

-- 선생님 개수 확인
SELECT COUNT(*) as teacher_count FROM users WHERE role = 'teacher';
-- 예상: 61

-- 학생 개수 확인
SELECT COUNT(*) as student_count FROM users WHERE role = 'student';
-- 예상: 700

-- 전체 사용자 확인
SELECT COUNT(*) as total_users FROM users;
-- 예상: 762 (1 admin + 61 teacher + 700 student)
```

### 1.4 과목 확인
```sql
SELECT subject_code, subject_name FROM subjects ORDER BY subject_code;

-- 예상 결과:
-- ENG   | 영어 과목
-- KOR   | 국어 과목
-- MATH  | 수학 과목
-- SCI   | 과학 과목
-- SOC   | 사회 과목
```

### 1.5 인덱스 확인
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'users' ORDER BY indexname;

-- 예상 결과:
-- idx_users_role
-- idx_users_user_id
-- users_pkey
```

## 2. 백엔드 API 검증

### 2.1 백엔드 헬스체크
```bash
curl -X GET http://[NAS-IP]:8000/health
# 응답: {"status": "ok"} 또는 유사한 상태
```

### 2.2 로그인 테스트
```bash
curl -X POST http://[NAS-IP]:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=root2025&password=1234!"

# 예상 응답:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "token_type": "bearer",
#   "user_id": "root2025",
#   "role": "admin",
#   "full_name": "Administrator"
# }
```

### 2.3 사용자 정보 조회
```bash
# 위에서 얻은 access_token을 사용
curl -X GET http://[NAS-IP]:8000/users/me \
  -H "Authorization: Bearer <access_token>"

# 예상 응답:
# {
#   "id": 1,
#   "user_id": "root2025",
#   "full_name": "Administrator",
#   "role": "admin",
#   "created_at": "2024-...",
#   ...
# }
```

### 2.4 과목 조회
```bash
curl -X GET http://[NAS-IP]:8000/subjects \
  -H "Authorization: Bearer <access_token>"

# 예상: 5개 과목 반환
```

## 3. 프론트엔드 검증

### 3.1 프론트엔드 접근
```
http://[NAS-IP]:40000
```
- 로그인 페이지 표시 확인
- CSS 로드 확인 (Tailwind 스타일링)
- 콘솔 오류 확인

### 3.2 로그인 테스트
- ID: `root2025`
- Password: `1234!`
- "Sign In" 버튼 클릭
- ✅ 성공: 대시보드로 리다이렉트
- ✅ 실패 메시지 표시되면 문제 진단

### 3.3 대시보드 검증
- ✅ 헤더에 사용자명 표시
- ✅ 네비게이션 메뉴 표시
- ✅ 과목 목록 로드
- ✅ 레코드 테이블 표시 (빈 상태)

## 4. 컨테이너 상태 확인

### 4.1 Portainer에서 확인
- 모든 컨테이너 상태: **Green** (실행 중)
  - teacher-logbook-db
  - teacher-logbook-redis
  - teacher-logbook-backend
  - teacher-logbook-frontend

### 4.2 헬스체크 상태
```bash
# Portainer Console
docker ps --format "{{.Names}}\t{{.Status}}"

# 예상:
# teacher-logbook-db       Up ... (healthy)
# teacher-logbook-redis    Up ... (healthy)
# teacher-logbook-backend  Up ...
# teacher-logbook-frontend Up ...
```

### 4.3 로그 확인
각 컨테이너의 로그를 확인하여 오류 없음을 확인:
- PostgreSQL: 초기화 완료
- Redis: 준비 완료
- Backend: 포트 8000 리스닝
- Frontend: Nginx 시작

## 5. 문제 해결 가이드

### 5.1 로그인 실패 원인
```
증상: "Incorrect username or password" 오류

진단:
1. PostgreSQL에 root2025 사용자 존재 확인
   SELECT * FROM users WHERE user_id = 'root2025';
   
2. 비밀번호 해시 확인
   SELECT password_hash FROM users WHERE user_id = 'root2025';
   (시작: $2b$12$LQv3c1yqBWVHxkd0LHAkCO...)
   
3. Backend 로그 확인
   Portainer > teacher-logbook-backend > Logs

해결:
- init.sql 재실행: docker-compose.yml 재배포
```

### 5.2 데이터베이스 연결 실패
```
증상: "Connection refused" 또는 "Connection timeout"

진단:
1. PostgreSQL 컨테이너 상태 확인
   docker exec teacher-logbook-db pg_isready -U logbook_user
   
2. 환경 변수 확인
   DATABASE_URL: postgresql://logbook_user:logbook_pass_2025@postgres:5432/teacher_logbook

해결:
- docker-compose.yml에서 환경 변수 재확인
- 컨테이너 재시작: Portainer Stack > Restart Service
```

### 5.3 프론트엔드 로드 실패
```
증상: 빈 페이지 또는 404 오류

진단:
1. Frontend 컨테이너 로그 확인
2. 포트 40000 접근 확인
3. CORS 설정 확인: backend CORS_ORIGINS

해결:
- NAS 방화벽 확인
- 포트 포워딩 확인
- 컨테이너 재빌드
```

## 6. 성능 및 리소스

### 6.1 리소스 사용량 확인
```bash
# Portainer에서 각 컨테이너 확인
- PostgreSQL: ~500MB RAM (선택적)
- Redis: ~50MB RAM
- Backend: ~300MB RAM
- Frontend: ~50MB RAM
```

### 6.2 데이터베이스 성능
```sql
-- 커넥션 수 확인
SELECT count(*) FROM pg_stat_activity;

-- 캐시 히트율 확인
SELECT sum(heap_blks_read) as heap_read, 
       sum(heap_blks_hit) as heap_hit,
       sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;

-- 인덱스 사용률 확인
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 7. 백업 및 유지보수

### 7.1 데이터베이스 백업
```bash
# Portainer Console에서
docker exec teacher-logbook-db pg_dump -U logbook_user teacher_logbook > backup_$(date +%Y%m%d).sql
```

### 7.2 로그 정리
```bash
# 오래된 로그 삭제
docker logs --tail 0 teacher-logbook-backend > /dev/null 2>&1
```

### 7.3 정기적 모니터링
- 일일: 컨테이너 상태 확인
- 주간: 데이터베이스 성능 점검
- 월간: 백업 검증

## 8. 롤백 절차

배포 실패 시:
1. Portainer > Stacks > teacher-logbook > Remove
2. docker-compose.yml 수정
3. 다시 배포

데이터 복구:
```bash
docker exec teacher-logbook-db psql -U logbook_user teacher_logbook < backup_*.sql
```
