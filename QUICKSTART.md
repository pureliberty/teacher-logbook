# 빠른 시작 가이드

## 5분 안에 시작하기

1. **네트워크 생성** (최초 1회)
```bash
docker network create logbook-network
```

2. **실행**
```bash
cd teacher-logbook
docker-compose up -d
```

3. **접속**: http://localhost:40000

4. **로그인**
   - 관리자: `root2025` / `1234!`
   - 교사: `T0200` / `1234!`  
   - 학생: `S20101` / `1234!`

## 주요 기능

**기록 작성**: 대시보드 → 학생 선택 → 편집 → 내용 입력 → 저장

**실시간 통계**: 글자수, 바이트 계산 (한글×3, 영문×1, 줄바꿈×2)

**LaTeX 수식**: `$x^2$` (인라인) 또는 `$$\frac{a}{b}$$` (블록)

**동시 편집 제어**: First-Come-First-Served (30분 자동 해제)

**댓글 & 이력**: 모든 수정사항 추적, 편집자 정보 기록

## 문제 해결

### 접속 안 될 때
```bash
docker-compose logs -f
```

### 재시작
```bash
docker-compose restart
```

### 초기화
```bash
docker-compose down -v
docker-compose up -d
```

## 더 알아보기
전체 문서는 `README.md`를 참조하세요.
