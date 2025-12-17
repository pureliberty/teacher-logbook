# PROJECT_SUMMARY.md

## 목차 (Table of Contents)

1. [개요 (Overview)](#1-개요-overview)
2. [시스템 아키텍처 (System Architecture)](#2-시스템-아키텍처-system-architecture)
    - [전체 구조도 (System Flowchart)](#전체-구조도-system-flowchart)
    - [기술 스택 (Tech Stack)](#기술-스택-tech-stack)
3. [기능 명세 및 구성 요소 매핑 (Feature Specification & Mapping)](#3-기능-명세-및-구성-요소-매핑-feature-specification--mapping)
    - [인증 및 사용자 관리 (Authentication & User Management)](#인증-및-사용자-관리-authentication--user-management)
    - [생활기록부 기록 관리 (Logbook Record Management)](#생활기록부-기록-관리-logbook-record-management)
    - [과목 및 배정 관리 (Subject & Assignment Management)](#과목-및-배정-관리-subject--assignment-management)
4. [데이터베이스 구조 (Database Schema)](#4-데이터베이스-구조-database-schema)
5. [관리 및 유지보수 가이드 (Maintenance Guide)](#5-관리-및-유지보수-가이드-maintenance-guide)

---

## 1. 개요 (Overview)

**프로젝트명**: 쌩기부 (Teacher Logbook)
**목적**: 교사가 학생들의 학교 생활 기록을 체계적으로 작성, 관리하고 학생들과 소통할 수 있는 웹 기반 플랫폼입니다. 동시성 제어(Locking)를 통해 데이터 충돌을 방지하며, 바이트 수 계산 등 생기부 작성에 특화된 기능을 제공합니다.

---

## 2. 시스템 아키텍처 (System Architecture)

### 전체 구조도 (System Flowchart)

```mermaid
graph TD
    subgraph Client [Frontend (Client Side)]
        User[사용자 (Admin/Teacher/Student)]
        ReactApp[React SPA (Vite)]
        Router[React Router]
        Store[Zustand Store]
        Axios[Axios HTTP Client]
        
        User --> ReactApp
        ReactApp --> Router
        Router --> Store
        Store --> Axios
    end

    subgraph Server [Backend (Server Side)]
        Nginx[Nginx (Reverse Proxy)]
        FastAPI[FastAPI Application]
        AuthMd[Auth Middleware (JWT)]
        
        subgraph Logic [Business Logic]
            UserRouter[User Router]
            RecordRouter[Record Router]
            AssignRouter[Assignment Router]
            LockMgr[Lock Manager (Redis)]
        end
        
        subgraph Data [Data Layer]
            Postgres[(PostgreSQL DB)]
            Redis[(Redis Cache)]
        end

        Axios -- HTTP/JSON --> Nginx
        Nginx -- Proxy --> FastAPI
        FastAPI --> AuthMd
        
        AuthMd --> UserRouter
        AuthMd --> RecordRouter
        AuthMd --> AssignRouter
        
        RecordRouter -- Lock/Check --> LockMgr
        LockMgr -- Set/Get --> Redis
        
        UserRouter -- Query --> Postgres
        RecordRouter -- CRUD --> Postgres
        AssignRouter -- CRUD --> Postgres
    end
```

### 기술 스택 (Tech Stack)

| 구분 | 기술 / 도구 | 설명 |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript | UI 라이브러리 및 언어 |
| | Vite | 빌드 도구 (빠른 개발 환경) |
| | Tailwind CSS | 유틸리티 퍼스트 CSS 프레임워크 |
| | Zustand | 전역 상태 관리 (가볍고 직관적) |
| | KaTeX | 수식 렌더링 지원 |
| **Backend** | Python 3.11+, FastAPI | 고성능 비동기 웹 프레임워크 |
| | SQLAlchemy | ORM (데이터베이스 추상화) |
| | Pydantic | 데이터 유효성 검사 및 설정 관리 |
| **Infra/DB** | Docker & Compose | 컨테이너 기반 배포 관리 |
| | PostgreSQL 15 | 주 데이터베이스 (관계형) |
| | Redis 7 | 인메모리 저장소 (편집 잠금, 캐싱) |
| | Nginx | 웹 서버 및 리버스 프록시 |

---

## 3. 기능 명세 및 구성 요소 매핑 (Feature Specification & Mapping)

### 인증 및 사용자 관리 (Authentication & User Management)

*   **설명**: JWT(JSON Web Token) 기반의 인증 시스템을 사용하여 보안을 유지합니다. 역할(Role) 기반 접근 제어(RBAC)가 적용되어 있습니다.
*   **주요 구성 요소**:
    *   **BE**: `main.py` (`/api/token`, `/api/users/me`), `dependencies.py` (OAuth2 scheme)
    *   **FE**: 로그인 페이지, AuthGuard 컴포넌트 (토큰 저장 및 유효성 검사)

| 기능 | 상세 내용 | Backend Mapping | Frontend Mapping | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **로그인** | ID/PW 인증 후 Access Token 발급 | `POST /api/token` | `LoginPage` | Token은 LocalStorage/Memory에 저장 |
| **내 정보** | 현재 로그인한 사용자 정보 조회 및 수정 | `GET/PUT /api/users/me` | `UserProfile` | 비밀번호 변경 등 |
| **사용자 관리** | (관리자) 사용자 추가, 일괄 등록 | `POST /api/admin/users/*` | `AdminPage` | 엑셀 업로드 지원 |

### 생활기록부 기록 관리 (Logbook Record Management)

*   **설명**: 이 시스템의 핵심 기능으로, 학생별 과목별 기록을 작성합니다. 동시 편집 충돌을 막기 위해 **Redis 기반의 Locking** 메커니즘을 사용합니다.
*   **주요 구성 요소**:
    *   **BE**: `main.py` (Record Routes), Redis Client
    *   **FE**: Editor Component, RecordList, ByteCounter

| 기능 | 상세 내용 | Backend Mapping | Frontend Mapping | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **기록 조회** | 학생/과목/반 별 기록 리스트 조회 | `GET /api/records` | `Dashboard`, `RecordList` | 권한에 따라 조회 범위 제한 |
| **편집 잠금 (Lock)** | 편집 시작 시 독점적 권한 획득 (30분) | `POST .../{id}/lock` | `Editor` (Edit Start) | Redis 사용, 다른 사용자 편집 불가 |
| **기록 저장** | 내용 저장 및 바이트/글자 수 자동 계산 | `PUT .../{id}` | `Editor` (Save) | 한글3byte, 줄바꿈2byte 계산 로직 적용 |
| **버전 관리** | 수정 이력 자동 저장 | `GET .../{id}/versions` | `HistoryModal` | 누가 언제 무엇을 수정했는지 추적 |
| **학생 권한** | 교사가 특정 기록을 학생이 수정 가능하게 설정 | `PUT .../permissions` | `RecordItem` (Switch) | 학생 자기주도적 기록 관리 지원 |

### 과목 및 배정 관리 (Subject & Assignment Management)

*   **설명**: 어떤 학생이 어떤 과목을 듣는지, 어떤 반이 어떤 과목에 배정되었는지를 관리합니다.
*   **주요 구성 요소**:
    *   **BE**: `assignments.py` (Assignment Logic), `main.py` (Subject CRUD)
    *   **FE**: SubjectManager, ClassAssignment

| 기능 | 상세 내용 | Backend Mapping | Frontend Mapping | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **과목 등록** | (관리자) 새로운 과목 생성 | `POST /api/subjects` | `SubjectManage` | |
| **학급 배정** | 특정 반(예: 1학년 1반)을 과목에 일괄 배정 | `POST .../classes-to-subject` | `AssignmentPage` | 해당 반 학생들 자동 매핑 |
| **개별 배정** | 특정 학생을 과목에 추가 배정 | `POST .../students-to-subject` | `StudentSelector` | 이동수업/선택과목 대응 |

---

## 4. 데이터베이스 구조 (Database Schema)

*   **Users**: 사용자 계정 정보 (id, role, name, grade, class 등)
*   **Subjects**: 과목 메타데이터 (name, code, description)
*   **Records**: 실제 생기부 기록 내용 (content, byte_count)
    *   *Foreign Keys*: `student_user_id` (Users), `subject_id` (Subjects)
*   **RecordVersions**: 수정 이력 (audit log)
*   **SubjectAssignments**: 과목-학생 매핑 테이블 (수강 신청 내역과 유사)

---

## 5. 관리 및 유지보수 가이드 (Maintenance Guide)

### 주의사항 (Caution)
1.  **Secret Key**: `docker-compose.yml`의 `SECRET_KEY`는 프로덕션 배포 시 반드시 변경하십시오.
2.  **데이터 백업**: `docker-compose exec postgres pg_dump ...` 명령을 통해 정기적으로 DB를 백업해야 합니다.
3.  **Redis 지속성**: Redis는 잠금 정보뿐만 아니라 세션성 데이터도 다룰 수 있으므로, 재시작 시 잠금 상태가 초기화될 수 있음을 인지해야 합니다.

### 유용한 명령어 (Useful Commands)

*   **전체 시스템 시작**: `docker-compose up -d --build`
*   **로그 확인 (실시간)**: `docker-compose logs -f`
*   **백엔드 쉘 접속**: `docker-compose exec backend /bin/bash`
*   **DB 접속**: `docker-compose exec postgres psql -U logbook_user -d teacher_logbook`

### 문제 해결 (Troubleshooting)
*   **423 Locked Error**: 사용자가 비정상 종료하여 락이 남아있는 경우, 관리자 권한으로 락을 해제하거나 Redis 키 만료(기본 30분)를 기다려야 합니다.
*   **DB 연결 실패**: `postgres` 컨테이너가 완전히 뜰 때까지 백엔드가 기다리는지(`depends_on` 설정) 확인하십시오.
