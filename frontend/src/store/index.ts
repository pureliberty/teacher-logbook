import { create } from 'zustand';
import { stopActivityTracking } from '../utils/api';
import type { User, Subject } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  updateToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  user: null,
  accessToken: localStorage.getItem('access_token'),
  
  login: (token: string, user: User) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_id', user.user_id);
    localStorage.setItem('role', user.role);
    set({ isAuthenticated: true, accessToken: token, user });
  },
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');
    stopActivityTracking();
    set({ isAuthenticated: false, accessToken: null, user: null });
  },
  
  updateUser: (user: User) => {
    set({ user });
  },

  updateToken: (token: string) => {
    localStorage.setItem('access_token', token);
    set({ accessToken: token });
  }
}));

interface AppState {
  subjects: Subject[];
  setSubjects: (subjects: Subject[]) => void;
  selectedSubject: Subject | null;
  setSelectedSubject: (subject: Subject | null) => void;
  selectedGrade: number | null;
  setSelectedGrade: (grade: number | null) => void;
  selectedClass: number | null;
  setSelectedClass: (classNumber: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  subjects: [],
  setSubjects: (subjects) => set({ subjects }),
  selectedSubject: null,
  setSelectedSubject: (subject) => set({ selectedSubject: subject }),
  selectedGrade: null,
  setSelectedGrade: (grade) => set({ selectedGrade: grade }),
  selectedClass: null,
  setSelectedClass: (classNumber) => set({ selectedClass: classNumber }),
}));
