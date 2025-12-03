// =====================================================
// 쌩기부 학생 기록 시스템 - 타입 정의
// =====================================================

// ==================== 사용자 ====================

export interface User {
  id: number;
  user_id: string;
  full_name?: string;
  role: 'admin' | 'teacher' | 'student';
  grade?: number;
  class_number?: number;
  number_in_class?: number;
  created_at: string;
}

// ==================== 과목 ====================

export interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  description?: string;
}

// ==================== 교사 역할 ====================

export type TeacherRoleType = 
  | 'homeroom_teacher' 
  | 'assistant_homeroom' 
  | 'subject_teacher' 
  | 'grade_head' 
  | 'record_manager';

export const ROLE_TYPE_LABELS: Record<TeacherRoleType, string> = {
  homeroom_teacher: '학급담임',
  assistant_homeroom: '학급부담임',
  subject_teacher: '교과교사',
  grade_head: '학년부장',
  record_manager: '생기부관리자'
};

export interface TeacherAssignment {
  id: number;
  teacher_user_id: string;
  role_type: TeacherRoleType;
  grade?: number;
  class_number?: number;
  subject_id?: number;
  school_year: number;
  created_at: string;
  teacher_name?: string;
  subject_name?: string;
}

// ==================== 기록 ====================

export interface Record {
  id: number;
  student_user_id: string;
  subject_id: number;
  record_type: 'subject' | 'activity';
  content?: string;
  char_count: number;
  byte_count: number;
  is_editable_by_student: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordWithDetails extends Record {
  student_name?: string;
  subject_name?: string;
  is_locked?: boolean;
  locked_by?: string;
}

export interface RecordVersion {
  id: number;
  record_id: number;
  content?: string;
  char_count: number;
  byte_count: number;
  edited_by: string;
  edit_type: string;
  created_at: string;
}

export interface Comment {
  id: number;
  record_id: number;
  user_id: string;
  comment_text: string;
  created_at: string;
}

// ==================== 배정 관련 ====================

export interface ClassInfo {
  grade: number;
  classNumber: number;
}

export interface StudentInfo {
  user_id: string;
  full_name?: string;
  grade: number;
  class_number: number;
  number_in_class: number;
  assigned_type?: 'class' | 'individual';
}

export interface SubjectClassAssignment {
  id: number;
  subject_id: number;
  grade: number;
  class_number: number;
  school_year: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ==================== 교사용 ====================

export interface MyClass {
  grade: number;
  class_number: number;
  role_type: string;
}

export interface MySubject {
  id: number;
  subject_name: string;
  subject_code: string;
  grade?: number;
  class_number?: number;
}