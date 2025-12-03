-- ==================== 쌩기부 데이터베이스 초기화 스크립트 ====================
-- Supabase용 완전한 스키마 정의
-- 실행: Supabase SQL Editor에서 전체 복사 후 실행

-- ==================== 1. Users 테이블 ====================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    student_number VARCHAR(10),
    grade INTEGER,
    class_number INTEGER,
    number_in_class INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS '사용자 테이블 (학생, 교사, 관리자)';
COMMENT ON COLUMN users.user_id IS '로그인 ID';
COMMENT ON COLUMN users.role IS '역할: admin, teacher, student';

-- ==================== 2. Subjects 테이블 ====================
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subjects IS '과목 테이블 (일반 과목 + 활동)';
COMMENT ON COLUMN subjects.subject_code IS '과목 코드 (UNIQUE)';

-- ==================== 3. Records 테이블 (통합) ====================
CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    
    -- 기본 정보
    student_user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    record_type VARCHAR(20) DEFAULT 'subject' CHECK (record_type IN ('subject', 'activity')),
    
    -- 공통 필드
    school_year INTEGER DEFAULT 2025,
    semester INTEGER,
    grade INTEGER,
    class_number INTEGER,
    number_in_class INTEGER,
    student_name VARCHAR(100),
    
    -- 일반 과목 전용
    student_number VARCHAR(20),
    subject_name VARCHAR(100),
    subject_code VARCHAR(20),
    class_and_number VARCHAR(20),
    status VARCHAR(50) DEFAULT '재학',
    content TEXT,
    gifted_education TEXT,
    
    -- 활동 기록 전용
    hours DECIMAL(10, 1),
    remarks TEXT,
    club_category VARCHAR(100),
    club_name VARCHAR(100),
    club_hours DECIMAL(10, 1),
    record_hours DECIMAL(10, 1),
    
    -- 메타 정보
    char_count INTEGER DEFAULT 0,
    byte_count INTEGER DEFAULT 0,
    is_editable_by_student BOOLEAN DEFAULT true,
    created_by VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 제약조건
    CONSTRAINT check_subject_fields CHECK (
        record_type != 'subject' OR (
            school_year IS NOT NULL AND
            semester IS NOT NULL AND
            grade IS NOT NULL AND
            student_number IS NOT NULL
        )
    ),
    CONSTRAINT check_activity_fields CHECK (
        record_type != 'activity' OR (
            school_year IS NOT NULL AND
            grade IS NOT NULL AND
            class_number IS NOT NULL AND
            number_in_class IS NOT NULL
        )
    )
);

COMMENT ON TABLE records IS '통합 기록 테이블 (과목 세특 + 활동 기록)';
COMMENT ON COLUMN records.record_type IS 'subject: 과목 세특, activity: 활동 기록';
COMMENT ON COLUMN records.content IS '세부능력 및 특기사항 (과목용)';
COMMENT ON COLUMN records.remarks IS '특기사항 (활동용)';

-- ==================== 4. Record Versions 테이블 ====================
CREATE TABLE IF NOT EXISTS record_versions (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    content TEXT,
    char_count INTEGER DEFAULT 0,
    byte_count INTEGER DEFAULT 0,
    edited_by VARCHAR(20) NOT NULL,
    edit_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE record_versions IS '기록 변경 이력';

-- ==================== 5. Comments 테이블 ====================
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    user_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE comments IS '기록 댓글';

-- ==================== 6. Edit Locks 테이블 ====================
CREATE TABLE IF NOT EXISTS edit_locks (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    locked_by VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(record_id)
);

COMMENT ON TABLE edit_locks IS '편집 잠금 (동시 편집 방지)';

-- ==================== 7. Notifications 테이블 ====================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    record_id INTEGER REFERENCES records(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notifications IS '알림';

-- ==================== 8. 인덱스 생성 ====================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_grade_class ON users(grade, class_number);

-- Subjects
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(subject_code);

-- Records
CREATE INDEX IF NOT EXISTS idx_records_student ON records(student_user_id);
CREATE INDEX IF NOT EXISTS idx_records_subject ON records(subject_id);
CREATE INDEX IF NOT EXISTS idx_records_type ON records(record_type);
CREATE INDEX IF NOT EXISTS idx_records_year_semester ON records(school_year, semester);
CREATE INDEX IF NOT EXISTS idx_records_grade_class ON records(grade, class_number);
CREATE INDEX IF NOT EXISTS idx_records_student_number ON records(student_number);

-- Record Versions
CREATE INDEX IF NOT EXISTS idx_record_versions_record ON record_versions(record_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_record ON comments(record_id);

-- Edit Locks
CREATE INDEX IF NOT EXISTS idx_edit_locks_record ON edit_locks(record_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- ==================== 9. UNIQUE 제약조건 ====================

-- 일반 과목: 학년도+학기+학년+과목+학생개인번호로 유니크
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_subject_unique 
ON records(school_year, semester, grade, subject_id, student_number)
WHERE record_type = 'subject' AND student_number IS NOT NULL;

-- 활동 기록: 학년도+과목+학년+반+번호로 유니크
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_activity_unique 
ON records(school_year, subject_id, grade, class_number, number_in_class)
WHERE record_type = 'activity';

-- ==================== 10. 초기 데이터 ====================

-- 관리자 계정 (root2025 / 1234!)
INSERT INTO users (user_id, password_hash, full_name, role) VALUES 
('root2025', '$2a$12$6tVA/lwyCehpx4LsFKS/4.X4glaaH9JUs2qRy4c/kFtHe/g8iJMrO', 'Administrator', 'admin')
ON CONFLICT (user_id) DO NOTHING;

-- 기본 과목
INSERT INTO subjects (subject_name, subject_code, description) VALUES 
('국어', 'KOR', '국어 과목'),
('영어', 'ENG', '영어 과목'),
('수학', 'MATH', '수학 과목'),
('사회', 'SOC', '사회 과목'),
('과학', 'SCI', '과학 과목'),
('자율활동', 'AUTO', '자율활동 기록'),
('진로활동', 'CAREER', '진로활동 기록'),
('동아리활동', 'CLUB', '동아리활동 기록')
ON CONFLICT (subject_code) DO NOTHING;

-- ==================== 11. RLS 비활성화 (개발 단계) ====================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE records DISABLE ROW LEVEL SECURITY;
ALTER TABLE record_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_locks DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ==================== 12. 편의 뷰 생성 ====================

-- 일반 과목 세특 뷰
CREATE OR REPLACE VIEW subject_records_view AS
SELECT 
  r.id,
  r.school_year,
  r.semester,
  r.grade,
  r.class_number,
  r.number_in_class,
  r.student_number,
  r.student_name,
  r.student_user_id,
  r.subject_id,
  s.subject_name,
  s.subject_code,
  r.class_and_number,
  r.status,
  r.content as remarks,
  r.gifted_education,
  r.char_count,
  r.byte_count,
  r.created_by,
  r.created_at,
  r.updated_at
FROM records r
JOIN subjects s ON r.subject_id = s.id
WHERE r.record_type = 'subject';

-- 활동 기록 뷰
CREATE OR REPLACE VIEW activity_records_view AS
SELECT 
  r.id,
  r.school_year,
  r.grade,
  r.class_number,
  r.number_in_class,
  r.student_name,
  r.student_user_id,
  r.subject_id,
  s.subject_name as activity_type,
  s.subject_code,
  r.hours,
  r.remarks,
  r.club_category,
  r.club_name,
  r.club_hours,
  r.record_hours,
  r.created_by,
  r.created_at,
  r.updated_at
FROM records r
JOIN subjects s ON r.subject_id = s.id
WHERE r.record_type = 'activity';

-- ==================== 교사 역할 배정 테이블 ====================
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id SERIAL PRIMARY KEY,
    teacher_user_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- 역할 유형
    role_type VARCHAR(30) NOT NULL CHECK (role_type IN (
        'homeroom_teacher',    -- 학급담임
        'assistant_homeroom',  -- 학급부담임
        'subject_teacher',     -- 교과교사
        'grade_head',          -- 학년부장
        'record_manager'       -- 생기부관리자
    )),
    
    -- 담당 범위
    grade INTEGER,
    class_number INTEGER,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- 메타
    school_year INTEGER DEFAULT 2025,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE teacher_assignments IS '교사 역할 배정 테이블';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ta_teacher ON teacher_assignments(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_ta_role ON teacher_assignments(role_type);
CREATE INDEX IF NOT EXISTS idx_ta_grade_class ON teacher_assignments(grade, class_number);
CREATE INDEX IF NOT EXISTS idx_ta_subject ON teacher_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_ta_year ON teacher_assignments(school_year);

-- 중복 방지 (NULL 값 처리를 위해 COALESCE 사용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ta_unique 
ON teacher_assignments(
    teacher_user_id, 
    role_type, 
    school_year,
    COALESCE(grade, 0), 
    COALESCE(class_number, 0), 
    COALESCE(subject_id, 0)
);

-- ==================== 13. 과목-학급 배정 테이블 ====================
CREATE TABLE IF NOT EXISTS subject_class_assignments (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL CHECK (grade >= 1 AND grade <= 3),
    class_number INTEGER NOT NULL CHECK (class_number >= 1),
    school_year INTEGER NOT NULL DEFAULT 2025,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(20),
    
    CONSTRAINT unique_subject_class_year 
        UNIQUE (subject_id, grade, class_number, school_year)
);

COMMENT ON TABLE subject_class_assignments IS '과목별 학급 배정';

CREATE INDEX IF NOT EXISTS idx_sca_subject ON subject_class_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_sca_grade_class ON subject_class_assignments(grade, class_number);

-- ==================== 14. 과목-학생 배정 테이블 ====================
CREATE TABLE IF NOT EXISTS subject_student_assignments (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    student_user_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    school_year INTEGER NOT NULL DEFAULT 2025,
    assigned_type VARCHAR(20) NOT NULL DEFAULT 'individual' 
        CHECK (assigned_type IN ('class', 'individual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(20),
    
    CONSTRAINT unique_subject_student_year 
        UNIQUE (subject_id, student_user_id, school_year)
);

COMMENT ON TABLE subject_student_assignments IS '과목별 학생 개별 배정';
COMMENT ON COLUMN subject_student_assignments.assigned_type IS 'class: 학급 배정으로 자동 생성, individual: 개별 지정';

CREATE INDEX IF NOT EXISTS idx_ssa_subject ON subject_student_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_ssa_student ON subject_student_assignments(student_user_id);

-- ==================== 완료 ====================
-- 
-- 데이터베이스 초기화 완료!
-- 
-- 관리자 계정:
--   ID: root2025
--   PW: 1234!
--
-- 다음 단계:
-- 1. Admin 페이지에서 교사/학생 Excel 임포트
-- 2. 과목별 세특 또는 활동 기록 임포트
-- 3. 기록 작성 및 관리