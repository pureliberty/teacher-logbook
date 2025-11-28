# 쌩기부 - 학생 기록 관리 시스템

학교에서 여러 교사들이 학생별 기록을 작성하고 조회할 수 있는 웹 기반 시스템입니다.

## 프로젝트 정보

- **GitHub**: https://github.com/pureliberty/teacher-logbook
- **Docker Hub**: https://hub.docker.com/u/m4rum4ru
- **서버 환경**: Synology NAS 220+ (10GB RAM)
- **예상 동시 접속**: 300명

## 주요 기능

### 사용자 관리
- **3가지 역할**: 관리자(Admin), 교사(Teacher), 학생(Student)
- **사전 생성된 계정**
  - 관리자: `root2025` (비밀번호: `1234!`)
  - 교사: `T0200` ~ `T0260` (비밀번호: `1234!`)
  - 학생: `S20101` ~ `S21035` (비밀번호: `1234!`)
- 엑셀 파일을 통한 계정 일괄 등록 (개발 중)

### 기록 작성 및 관리
- **스프레드시트 형태**의 직관적인 UI
- **실시간 글자수/바이트 수 계산**
  - 바이트 계산식: `(한글 × 3) + (영문/숫자 × 1) + (줄바꿈 × 2)`
- **LaTeX 수식 지원**
  - 인라인 수식: `$x^2$`
  - 블록 수식: `$$\frac{a}{b}$$`
- **버전 관리**: 모든 편집 내역 추적
- **댓글 시스템**: 교사-학생 간 소통

### 동시 편집 제어
- **First-Come-First-Served**: 먼저 편집을 시작한 사용자가 우선권 보유
- 편집 잠금(Lock) 시스템으로 충돌 방지
- 자동 잠금 연장 (25분마다)

### 다양한 조회 기능
- **과목별 조회**: 특정 과목의 모든 학생 기록
- **학급별 조회**: 특정 학급의 모든 과목 기록
- **학생별 조회**: 개별 학생의 모든 과목 기록
- 학생은 자신의 기록만 조회 가능

### 권한 관리
- 교사는 학생의 기록 수정 권한 제어 가능
- 모든 편집 내역에 편집자 정보 기록
- 마우스 오버 시 하이라이트로 편집자 표시

### 반응형 디자인
- **모바일 최적화**: iPadOS, Android 지원
- **PC 지원**: Windows 기반 PC 완벽 지원
- 다양한 화면 크기에 대응

## 기술 스택

### 백엔드
- **FastAPI** (Python 3.11+): 고성능 비동기 API 서버
- **PostgreSQL 15**: 관계형 데이터베이스
- **Redis 7**: 편집 잠금 및 세션 관리
- **SQLAlchemy**: ORM
- **JWT**: 인증

### 프론트엔드
- **React 18** + **TypeScript**: UI 프레임워크
- **Tailwind CSS**: 스타일링
- **Zustand**: 상태 관리
- **Axios**: HTTP 클라이언트
- **KaTeX**: LaTeX 렌더링
- **React Router**: 라우팅

### 인프라
- **Docker** + **Docker Compose**: 컨테이너화
- **Nginx**: 리버스 프록시 및 정적 파일 서빙

## 설치 및 실행

### 사전 요구사항
- Docker 및 Docker Compose 설치
- 포트 40000 사용 가능
- Docker 네트워크 생성 권한

### 실행 방법

1. **프로젝트 클론 또는 다운로드**
```bash
cd teacher-logbook
```

2. **외부 네트워크 생성 (최초 1회만)**
```bash
docker network create logbook-network
```

3. **Docker Compose로 빌드 및 실행**
```bash
docker-compose up -d --build
```

4. **빌드 및 초기 설정 확인**
```bash
# 로그 확인
docker-compose logs -f

# 서비스 상태 확인
docker-compose ps
```

5. **웹 브라우저에서 접속**
```
http://localhost:40000
```

⚠️ **중요**: 
- 네트워크를 먼저 생성하지 않으면 에러가 발생합니다. 자세한 내용은 `NETWORK_SETUP.md`를 참조하세요.
- 상위 경로에서 `docker build .` 실행 시 오류가 발생합니다. `docker-compose`를 사용하거나 `BUILD.md`를 참조하세요.

### 초기 로그인 정보
- **관리자**: `root2025` / `1234!`
- **교사**: `T0200` ~ `T0260` / `1234!`
- **학생**: `S20101` ~ `S21035` / `1234!`

⚠️ **중요**: 첫 로그인 후 반드시 비밀번호를 변경하세요!

## 사용 가이드

### 교사 사용법

1. **로그인**
   - 교사 계정으로 로그인 (예: T0200)

2. **학생 기록 작성**
   - 대시보드에서 조회 옵션 선택 (과목별/학급별)
   - 학생 선택 후 "편집" 버튼 클릭
   - "편집 시작" 버튼으로 잠금 획득
   - 내용 작성 (LaTeX 수식 사용 가능)
   - "저장" 버튼으로 저장

3. **학생에게 편집 권한 부여**
   - 기록 편집 화면에서 권한 설정
   - 학생이 직접 수정 가능하도록 설정

4. **댓글 및 피드백**
   - 기록에 댓글 추가
   - 수정 이력 확인

### 학생 사용법

1. **로그인**
   - 학생 계정으로 로그인 (예: S20101)

2. **자신의 기록 조회**
   - 대시보드에서 자동으로 본인 기록만 표시

3. **기록 수정 (권한이 있는 경우)**
   - 편집 가능한 기록의 "편집" 버튼 클릭
   - "편집 시작"으로 잠금 획득
   - 내용 수정 후 저장

4. **교사 댓글 확인**
   - 기록 조회 시 교사의 피드백 확인

### 관리자 사용법

1. **로그인**
   - 관리자 계정으로 로그인 (root2025)

2. **사용자 관리**
   - "관리자 설정" 메뉴 접근
   - 사용자 추가/조회
   - 엑셀 파일 일괄 업로드

3. **과목 관리**
   - 과목 추가/수정
   - 과목 코드 설정

## 데이터베이스 구조

### 주요 테이블
- **users**: 사용자 정보 (교사, 학생, 관리자)
- **subjects**: 과목 정보
- **records**: 학생 기록
- **record_versions**: 기록 수정 이력
- **comments**: 댓글
- **edit_locks**: 편집 잠금 관리

## API 엔드포인트

### 인증
- `POST /token`: 로그인
- `GET /users/me`: 현재 사용자 정보
- `PUT /users/me`: 사용자 정보 수정

### 기록 관리
- `GET /records`: 기록 조회 (필터링 지원)
- `GET /records/{id}`: 특정 기록 조회
- `POST /records`: 기록 생성
- `PUT /records/{id}`: 기록 수정
- `POST /records/{id}/lock`: 편집 잠금 획득
- `DELETE /records/{id}/lock`: 편집 잠금 해제

### 버전 및 댓글
- `GET /records/{id}/versions`: 수정 이력 조회
- `GET /records/{id}/comments`: 댓글 조회
- `POST /records/{id}/comments`: 댓글 추가

### 관리자 전용
- `GET /admin/users`: 모든 사용자 조회
- `POST /admin/users`: 사용자 생성
- `POST /admin/users/bulk-upload`: 일괄 사용자 생성

## 환경 설정

### 환경 변수 (docker-compose.yml에서 수정)
```yaml
# PostgreSQL
POSTGRES_DB: teacher_logbook
POSTGRES_USER: logbook_user
POSTGRES_PASSWORD: logbook_pass_2025

# Backend
DATABASE_URL: postgresql://logbook_user:logbook_pass_2025@postgres:5432/teacher_logbook
REDIS_URL: redis://redis:6379
SECRET_KEY: your-secret-key-change-in-production-2025
```

⚠️ **프로덕션 환경**: SECRET_KEY와 데이터베이스 비밀번호를 반드시 변경하세요!

## 백업 및 복원

### 데이터베이스 백업
```bash
docker-compose exec postgres pg_dump -U logbook_user teacher_logbook > backup.sql
```

### 데이터베이스 복원
```bash
docker-compose exec -T postgres psql -U logbook_user teacher_logbook < backup.sql
```

## 문제 해결

### 컨테이너가 시작되지 않을 때
```bash
# 로그 확인
docker-compose logs

# 컨테이너 재시작
docker-compose restart

# 완전 재시작
docker-compose down
docker-compose up -d
```

### 데이터베이스 초기화
```bash
# 모든 데이터 삭제 후 재시작
docker-compose down -v
docker-compose up -d
```

### 포트 충돌 시
```yaml
# docker-compose.yml에서 포트 변경
frontend:
  ports:
    - "8080:80"  # 40000 대신 8080 사용
```

## 개발 환경

### 로컬 개발 (백엔드)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 로컬 개발 (프론트엔드)
```bash
cd frontend
npm install
npm run dev
```

## 보안 고려사항

1. **비밀번호 변경**: 초기 비밀번호는 반드시 변경
2. **HTTPS 사용**: 프로덕션에서는 SSL/TLS 인증서 적용
3. **환경 변수**: SECRET_KEY 및 DB 비밀번호 변경
4. **CORS 설정**: 프로덕션에서는 특정 도메인만 허용
5. **정기 백업**: 데이터베이스 정기 백업 설정

## 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.

## 지원

문제가 발생하거나 질문이 있으시면 시스템 관리자에게 문의하세요.

---

**버전**: 1.0.0  
**최종 수정일**: 2025-11-27
