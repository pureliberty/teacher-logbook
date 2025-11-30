# Synology NAS Portainer 배포 가이드

## 사전 준비

### 1. Synology NAS 설정
```bash
# SSH로 Synology NAS 접속 후
sudo docker network create logbook-network
```

### 2. 로그인 정보
- **관리자**: root2025 / 1234!
- **선생님**: T0200 ~ T0260 / 1234! (모두 동일)
- **학생**: S20101 ~ S21035 / 1234! (자동 생성, 모두 동일)

## Portainer 배포 단계

### Step 1: 네트워크 생성
1. Portainer 접속 > Environments > [NAS명] 선택
2. Local > Stacks > Networks
3. `logbook-network` 생성 (external 타입 아님)

### Step 2: Stack 배포
1. Portainer 메인 화면 > Stacks
2. "Add Stack" 클릭
3. 이름: `teacher-logbook`
4. `docker-compose.yml` 전체 복사 & 붙여넣기
5. "Deploy the stack" 클릭

### Step 3: 배포 확인
```
대기 시간: 약 2-3분
- PostgreSQL 초기화 (init.sql 실행)
- 사용자 계정 자동 생성
- 테이블 생성 및 인덱스 설정
```

## 서비스 접근

### 프론트엔드
```
http://[NAS-IP]:40000
```

### 관리자 로그인
- ID: `root2025`
- Password: `1234!`

### 백엔드 API
```
http://[NAS-IP]:8000
```

## 예상 초기화 시간

| 단계 | 예상 시간 |
|------|---------|
| 이미지 빌드 | 1-2분 |
| PostgreSQL 시작 | 15-30초 |
| init.sql 실행 | 5-10초 |
| 테이블 생성 | 2-3초 |
| 사용자 계정 생성 | 1-2초 |
| 백엔드 시작 | 5-10초 |
| **전체** | **2-3분** |

## 문제 해결

### 백엔드 로그 확인
```
Portainer > Stacks > teacher-logbook > teacher-logbook-backend > Logs
```

### 데이터베이스 로그 확인
```
Portainer > Stacks > teacher-logbook > teacher-logbook-db > Logs
```

### Redis 상태 확인
```bash
# Portainer Console에서
redis-cli ping
# 응답: PONG
```

### PostgreSQL 연결 테스트
```bash
# Portainer Console에서
psql -U logbook_user -d teacher_logbook -h postgres
# 명령어: \dt (테이블 목록)
# 명령어: SELECT * FROM users LIMIT 5; (사용자 확인)
```

## 주요 설정값

| 항목 | 값 |
|------|-----|
| PostgreSQL 버전 | 15-alpine |
| Redis 버전 | 7-alpine |
| 데이터베이스명 | teacher_logbook |
| DB 사용자 | logbook_user |
| DB 비밀번호 | logbook_pass_2025 |
| 최대 연결수 | 200 |
| Redis 최대 메모리 | 512MB |
| 프론트엔드 포트 | 40000 |
| 백엔드 포트 | 8000 (내부) |
| 네트워크 | logbook-network |

## 성공 표지

✅ Portainer에서 모든 컨테이너 실행 중 (Green)
✅ PostgreSQL healthcheck Pass
✅ Redis healthcheck Pass
✅ 백엔드 포트 8000 수신 대기
✅ 프론트엔드 접근 가능
✅ 관리자 로그인 성공
✅ 대시보드 데이터 표시

## 데이터 초기 상태

- **테이블**: users, subjects, records, record_versions, comments, edit_locks, notifications 생성
- **사용자**: 
  - 관리자 1명 (root2025)
  - 선생님 61명 (T0200~T0260)
  - 학생 700명 (S20101~S21035)
- **과목**: 5개 (국어, 영어, 수학, 사회, 과학)
- **기록**: 비어있음 (배포 후 추가)
