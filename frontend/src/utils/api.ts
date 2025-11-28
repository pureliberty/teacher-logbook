import axios from 'axios';
import type { LoginResponse, User, Subject, Record, RecordWithDetails, Comment, RecordVersion } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
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

// Auth APIs
export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await api.post<LoginResponse>('/token', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
    await api.put(`/records/${id}/permissions`, null, {
      params: { is_editable: isEditable },
    });
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
};

export default api;
