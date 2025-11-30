-- PostgreSQL initialization script for teacher-logbook
-- Database created by POSTGRES_DB environment variable
-- Extensions (optional)

-- Users table
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

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Records table
CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    student_user_id VARCHAR(20) NOT NULL,
    subject_id INTEGER NOT NULL,
    content TEXT,
    char_count INTEGER DEFAULT 0,
    byte_count INTEGER DEFAULT 0,
    is_editable_by_student BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE(student_user_id, subject_id)
);

-- Record versions table (for version control)
CREATE TABLE IF NOT EXISTS record_versions (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL,
    content TEXT,
    char_count INTEGER DEFAULT 0,
    byte_count INTEGER DEFAULT 0,
    edited_by VARCHAR(20) NOT NULL,
    edit_type VARCHAR(20) NOT NULL CHECK (edit_type IN ('create', 'update', 'delete')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
    FOREIGN KEY (edited_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Edit locks table (for concurrent editing control)
CREATE TABLE IF NOT EXISTS edit_locks (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL UNIQUE,
    locked_by VARCHAR(20) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
    FOREIGN KEY (locked_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    record_id INTEGER,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('record_created', 'record_updated', 'record_edited', 'comment_added', 'permission_granted', 'permission_revoked')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_records_student ON records(student_user_id);
CREATE INDEX idx_records_subject ON records(subject_id);
CREATE INDEX idx_record_versions_record ON record_versions(record_id);
CREATE INDEX idx_comments_record ON comments(record_id);
CREATE INDEX idx_edit_locks_record ON edit_locks(record_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Insert admin account
INSERT INTO users (user_id, password_hash, full_name, role) 
VALUES ('root2025', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7dcL.rZ.Ry', 'Administrator', 'admin')
ON CONFLICT (user_id) DO NOTHING;
-- Default password: 1234!

-- Insert teacher accounts (T0200 ~ T0260)
DO $$
BEGIN
    FOR i IN 200..260 LOOP
        INSERT INTO users (user_id, password_hash, role) 
        VALUES ('T0' || i, '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7dcL.rZ.Ry', 'teacher')
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;

-- Insert student accounts (S20101 ~ S21035)
DO $$
BEGIN
    FOR grade IN 2..2 LOOP
        FOR class IN 1..10 LOOP
            FOR num IN 1..35 LOOP
                INSERT INTO users (
                    user_id, 
                    password_hash, 
                    role, 
                    student_number,
                    grade,
                    class_number,
                    number_in_class
                ) 
                VALUES (
                    'S' || grade || LPAD(class::TEXT, 2, '0') || LPAD(num::TEXT, 2, '0'),
                    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7dcL.rZ.Ry',
                    'student',
                    grade || LPAD(class::TEXT, 2, '0') || LPAD(num::TEXT, 2, '0'),
                    grade,
                    class,
                    num
                )
                ON CONFLICT (user_id) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Insert sample subjects
INSERT INTO subjects (subject_name, subject_code, description) VALUES
('국어', 'KOR', '국어 과목'),
('영어', 'ENG', '영어 과목'),
('수학', 'MATH', '수학 과목'),
('사회', 'SOC', '사회 과목'),
('과학', 'SCI', '과학 과목')
ON CONFLICT (subject_code) DO NOTHING;
