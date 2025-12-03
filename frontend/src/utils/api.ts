import axios from 'axios';
import type { 
  LoginResponse, User, Subject, Record, RecordWithDetails, 
  Comment, RecordVersion, TeacherAssignment, TeacherAssignmentCreate,
  MyClass, MySubject
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Activity tracking
let lastActivityTime = Date.now();
let activityCheckInterval: ReturnType<typeof setInterval> | null = null;
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await api.post<LoginResponse>("/token/refresh");
    const { access_token, user_id, role } = response.data;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("user_id", user_id);
    localStorage.setItem("role", role);
    return true;
  } catch (error) {
    console.error("[Token] Refresh failed:", error);
    return false;
  }
}

export function initActivityTracking() {
  if (activityCheckInterval) return;

  const updateActivity = () => { lastActivityTime = Date.now(); };

  window.addEventListener('mousemove', updateActivity);
  window.addEventListener('keypress', updateActivity);
  window.addEventListener('click', updateActivity);
  window.addEventListener('scroll', updateActivity);

  activityCheckInterval = setInterval(async () => {
    const inactiveMinutes = (Date.now() - lastActivityTime) / (60 * 1000);
    if (inactiveMinutes >= 30) {
      localStorage.clear();
      window.location.href = '/login';
    }
  }, 5 * 60 * 1000);

  tokenRefreshInterval = setInterval(async () => {
    const inactiveMinutes = (Date.now() - lastActivityTime) / (60 * 1000);
    if (inactiveMinutes < 25) {
      const token = localStorage.getItem("access_token");
      if (token) {
        const success = await refreshAccessToken();
        if (!success) {
          stopActivityTracking();
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
  }, 20 * 60 * 1000);
}

export function stopActivityTracking() {
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
    activityCheckInterval = null;
  }
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
}

// Auth APIs
export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post<LoginResponse>('/token', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/users/me');
    return response.data;
  },
  
  updateCurrentUser: async (data: { full_name?: string; password?: string }): Promise<User> => {
    const response = await api.put<User>('/users/me', data);
    return response.data;
  },

  refreshToken: refreshAccessToken,
};

// Subject APIs
export const subjectApi = {
  getAll: async (): Promise<Subject[]> => {
    const response = await api.get<Subject[]>('/subjects');
    return response.data;
  },
  
  create: async (data: { subject_name: string; subject_code: string; description?: string }): Promise<Subject> => {
    const response = await api.post<Subject>('/subjects', data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/subjects/${id}`);
  },

  bulkDelete: async (ids: number[]): Promise<{ deleted: number; errors: string[] }> => {
    const response = await api.post('/subjects/bulk-delete', ids);
    return response.data;
  },
};

// Record APIs
export const recordApi = {
  getAll: async (params?: {
    student_user_id?: string;
    subject_id?: number;
    grade?: number;
    class_number?: number;
  }): Promise<RecordWithDetails[]> => {
    const response = await api.get<RecordWithDetails[]>('/records', { params });
    return response.data;
  },
  
  getById: async (id: number): Promise<RecordWithDetails> => {
    const response = await api.get<RecordWithDetails>(`/records/${id}`);
    return response.data;
  },
  
  create: async (data: { student_user_id: string; subject_id: number; content: string }): Promise<Record> => {
    const response = await api.post<Record>('/records', data);
    return response.data;
  },
  
  update: async (id: number, data: { content: string }): Promise<Record> => {
    const response = await api.put<Record>(`/records/${id}`, data);
    return response.data;
  },
  
  updatePermissions: async (id: number, isEditable: boolean): Promise<void> => {
    await api.put(`/records/${id}/permissions`, null, { params: { is_editable: isEditable } });
  },
  
  lock: async (id: number): Promise<void> => {
    await api.post(`/records/${id}/lock`);
  },
  
  unlock: async (id: number): Promise<void> => {
    await api.delete(`/records/${id}/lock`);
  },
  
  extendLock: async (id: number): Promise<void> => {
    await api.put(`/records/${id}/lock/extend`);
  },
  
  getVersions: async (id: number): Promise<RecordVersion[]> => {
    const response = await api.get<RecordVersion[]>(`/records/${id}/versions`);
    return response.data;
  },
  
  getComments: async (id: number): Promise<Comment[]> => {
    const response = await api.get<Comment[]>(`/records/${id}/comments`);
    return response.data;
  },
  
  addComment: async (id: number, text: string): Promise<Comment> => {
    const response = await api.post<Comment>(`/records/${id}/comments`, {
      record_id: id,
      comment_text: text,
    });
    return response.data;
  },
};

// Admin APIs
export const adminApi = {
  getAllUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/admin/users');
    return response.data;
  },
  
  createUser: async (data: {
    user_id: string;
    password: string;
    full_name?: string;
    role: string;
    grade?: number;
    class_number?: number;
    number_in_class?: number;
  }): Promise<User> => {
    const response = await api.post<User>('/admin/users', data);
    return response.data;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/admin/users/${userId}`);
  },
  
  bulkUploadUsers: async (users: Array<{
    user_id: string;
    password: string;
    full_name?: string;
    role: string;
    grade?: number;
    class_number?: number;
    number_in_class?: number;
  }>): Promise<{ message: string; created_count: number; errors: any[] }> => {
    const response = await api.post('/admin/users/bulk-upload', users);
    return response.data;
  },

  bulkDeleteUsers: async (userIds: string[]): Promise<{ message: string }> => {
    const response = await api.post('/admin/users/bulk-delete', userIds);
    return response.data;
  },

  // 교사 역할 배정
  getTeacherAssignments: async (schoolYear: number = 2025): Promise<TeacherAssignment[]> => {
    const response = await api.get<TeacherAssignment[]>('/admin/teacher-assignments', {
      params: { school_year: schoolYear }
    });
    return response.data;
  },

  createTeacherAssignment: async (data: TeacherAssignmentCreate): Promise<TeacherAssignment> => {
    const response = await api.post<TeacherAssignment>('/admin/teacher-assignments', data);
    return response.data;
  },

  deleteTeacherAssignment: async (id: number): Promise<void> => {
    await api.delete(`/admin/teacher-assignments/${id}`);
  },
};

// Teacher APIs
export const teacherApi = {
  getMyAssignments: async (schoolYear: number = 2025): Promise<TeacherAssignment[]> => {
    const response = await api.get<TeacherAssignment[]>('/teacher/my-assignments', {
      params: { school_year: schoolYear }
    });
    return response.data;
  },

  getMyClasses: async (schoolYear: number = 2025): Promise<MyClass[]> => {
    const response = await api.get<MyClass[]>('/teacher/my-classes', {
      params: { school_year: schoolYear }
    });
    return response.data;
  },

  getMySubjects: async (schoolYear: number = 2025): Promise<MySubject[]> => {
    const response = await api.get<MySubject[]>('/teacher/my-subjects', {
      params: { school_year: schoolYear }
    });
    return response.data;
  },

  getAccessibleRecords: async (params: {
    school_year?: number;
    semester?: number;
    grade?: number;
    class_number?: number;
    subject_id?: number;
    record_type?: string;
  }): Promise<RecordWithDetails[]> => {
    const response = await api.get<RecordWithDetails[]>('/teacher/accessible-records', { params });
    return response.data;
  },

  getActivitySubjects: async (): Promise<Subject[]> => {
    const response = await api.get<Subject[]>('/teacher/activity-subjects');
    return response.data;
  },

  getActivityRecords: async (params: {
    subject_id: number;
    grade: number;
    class_number: number;
    school_year?: number;
  }): Promise<RecordWithDetails[]> => {
    const response = await api.get<RecordWithDetails[]>('/teacher/activity-records', { params });
    return response.data;
  },

  getSubjectRecords: async (params: {
    subject_id: number;
    school_year: number;
    semester: number;
    grade: number;
    class_number?: number;
  }): Promise<RecordWithDetails[]> => {
    const response = await api.get<RecordWithDetails[]>('/teacher/subject-records', { params });
    return response.data;
  },
};

export default api;