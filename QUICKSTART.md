# 쌤기부 빠른 시작 가이드

## 5분 안에 시작하기

### 1단계: 네트워크 생성 (최초 1회만)
```bash
docker network create logbook-network
```

### 2단계: Docker 실행
```bash
cd teacher-logbook
docker-compose up -d
```

### 3단계: 브라우저 접속
```
http://localhost:40000
```

### 4단계: 로그인
- **관리자**: `root2025` / `1234!`
- **교사**: `T0200` / `1234!`  
- **학생**: `S20101` / `1234!`

## 주요 기능

### ✏️ 기록 작성
1. 대시보드 → 학생 선택 → 편집
2. "편집 시작" 클릭
3. 내용 입력 (LaTeX: `$x^2$` 또는 `$$\frac{a}{b}$$`)
4. 저장

### 📊 실시간 통계
- **글자수**: 전체 문자 수
- **바이트**: `(한글×3) + (영문×1) + (줄바꿈×2)`
- 색상 코드로 용량 확인

### 💬 댓글 & 이력
- 댓글로 피드백 제공
- 모든 수정 이력 추적
- 편집자 정보 자동 기록

### 🔒 동시 편집 제어
- 먼저 편집 시작한 사람이 우선
- 자동 잠금 해제 (30분)
- 충돌 방지

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
