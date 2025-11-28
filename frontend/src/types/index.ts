export interface User {
  id: number;
  user_id: string;
  full_name: string | null;
  role: 'admin' | 'teacher' | 'student';
  grade: number | null;
  class_number: number | null;
  number_in_class: number | null;
  created_at: string;
}

export interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  description: string | null;
}

export interface Record {
  id: number;
  student_user_id: string;
  subject_id: number;
  content: string | null;
  char_count: number;
  byte_count: number;
  is_editable_by_student: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordWithDetails extends Record {
  student_name: string | null;
  subject_name: string | null;
  is_locked: boolean;
  locked_by: string | null;
}

export interface Comment {
  id: number;
  record_id: number;
  user_id: string;
  comment_text: string;
  created_at: string;
}

export interface RecordVersion {
  id: number;
  record_id: number;
  content: string | null;
  char_count: number;
  byte_count: number;
  edited_by: string;
  edit_type: 'create' | 'update' | 'delete';
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
  full_name: string | null;
}

export interface ApiError {
  detail: string;
}
