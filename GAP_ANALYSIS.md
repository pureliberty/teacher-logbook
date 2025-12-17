# GAP_ANALYSIS.md

## 1. 개요 (Overview)
사용자의 요청에 따라 현재 코드베이스의 기능 구현 상태를 점검하고, 오류 및 개선이 필요한 사항을 분석했습니다.

## 2. 점검 결과 (Verification Results)

### 1) 충돌 및 오류 점검 (Conflicts & Errors)
*   **[RESOLVED] 포트 충돌 (Port Mismatch)**
    *   **현상**: `vite.config.ts`의 포트(3000)가 `docker-compose.yml` 매핑(40000)과 불일치
    *   **조치 결과**: 사용자 요청에 따라 `vite.config.ts`의 포트를 `40000`으로 수정하고 `host: true` 설정을 추가하여 해결하였습니다.


### 2) 학생 학번 기준 과목 배정 (Student-Subject Assignment)
*   **구현 상태**: ✅ **지원함 (Admin Only)**
*   **상세**:
    *   Backend: `/api/assignments/students-to-subject` 엔드포인트를 통해 특정 학생들을 과목에 개별 배정 가능합니다 (`subject_student_assignments` 테이블).
    *   Frontend: `AdminPage` > "과목-학생 배정" 탭에서 UI를 지원합니다.
*   **비고**: 교사가 직접 배정하는 기능은 없으며, 관리자(Admin) 권한이 필요합니다.

### 3) 교사 담당 학급 및 학생 배정 (Teacher-Class Assignment)
*   **구현 상태**: ✅ **지원함 (Admin Only)**
*   **상세**:
    *   Backend: `teacher_assignments` 테이블에서 `role_type='homeroom_teacher'`로 지정 시, 해당 학년/반(Grade/Class)이 배정됩니다.
    *   **자동 권한**: 담임 교사로 배정되면, 별도의 학생 개별 배정 없이도 해당 학급의 모든 학생 기록 `accessible-records`에 자동으로 접근 권한을 가집니다.
    *   Frontend: `AdminPage` > "교사 역할 배정" 탭에서 설정 가능하며, `DashboardPage`에서 "내 담당 역할"로 표시됩니다.

### 4) 교사 담당 과목+학급 지정 (Teacher-Subject-Class Assignment)
*   **구현 상태**: ✅ **지원함 (Subject Teacher)**
*   **상세**:
    *   Backend: `teacher_assignments` 테이블에서 `role_type='subject_teacher'`와 함께 `grade`, `class_number`, `subject_id`를 모두 지정할 수 있습니다.
    *   Frontend: `AdminPage`에서 3지망(학년/반/과목)을 모두 선택하여 배정하는 기능을 지원합니다.

### 5) UI 지원 여부 (UI Coverage)
*   **구현 상태**: ✅ **지원함**
*   **상세**:
    *   **관리자**: `AdminPage.tsx`에 역할 배정, 과목 배정, 사용자 관리 탭이 모두 구현되어 있습니다.
    *   **교사**: `DashboardPage.tsx`에서 본인에게 배정된 역할(`myAssignments`)을 확인하고, 그에 따라 필터링된 기록(`accessibleRecords`)만 조회/수정할 수 있도록 구현되어 있습니다.

---

## 3. 수정 제안 사항 (Action Items)

현재 **포트 매핑 오류**는 사용자의 요청에 따라 `vite.config.ts` 수정을 통해 해결되었습니다.
추가적으로 발견된 기능상의 심각한 결함은 없습니다.

### [Info] 향후 권장 사항
개발 환경에서 `npm install`을 수행하여 frontend 의존성을 설치하고 실행하시기 바랍니다.

