import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../store';
import { subjectApi, recordApi, authApi } from '../utils/api';
import RecordEditor from '../components/RecordEditor';
import RecordsTable from '../components/RecordsTable';
import type { RecordWithDetails } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { subjects, setSubjects, selectedSubject, setSelectedSubject } = useAppStore();
  
  const [records, setRecords] = useState<RecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'all' | 'subject' | 'class'>('all');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<RecordWithDetails | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (subjects.length > 0) {
      loadRecords();
    }
  }, [view, selectedSubject, selectedGrade, selectedClass]);

  const loadInitialData = async () => {
    try {
      const [subjectsData, userData] = await Promise.all([
        subjectApi.getAll(),
        authApi.getCurrentUser(),
      ]);
      
      setSubjects(subjectsData);
      useAuthStore.getState().updateUser(userData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params: any = {};
      
      if (user?.role === 'student') {
        params.student_user_id = user.user_id;
      } else {
        if (selectedSubject) {
          params.subject_id = selectedSubject.id;
        }
        if (selectedGrade) {
          params.grade = selectedGrade;
        }
        if (selectedClass) {
          params.class_number = selectedClass;
        }
      }
      
      const data = await recordApi.getAll(params);
      setRecords(data);
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEditRecord = (record: RecordWithDetails) => {
    setEditingRecord(record);
  };

  const handleCloseEditor = () => {
    setEditingRecord(null);
    loadRecords();
  };

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">쌤기부</h1>
              <p className="text-sm text-gray-600">
                {user?.full_name || user?.user_id} ({user?.role === 'admin' ? '관리자' : user?.role === 'teacher' ? '교사' : '학생'})
              </p>
            </div>
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  관리자 설정
                </button>
              )}
              <button
                onClick={() => navigate('/profile')}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                프로필
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters - Only for teachers and admin */}
        {isTeacherOrAdmin && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">조회 옵션</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* View Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  조회 방식
                </label>
                <select
                  value={view}
                  onChange={(e) => setView(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">전체</option>
                  <option value="subject">과목별</option>
                  <option value="class">학급별</option>
                </select>
              </div>

              {/* Subject */}
              {(view === 'subject' || view === 'all') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    과목
                  </label>
                  <select
                    value={selectedSubject?.id || ''}
                    onChange={(e) => {
                      const subject = subjects.find(s => s.id === Number(e.target.value));
                      setSelectedSubject(subject || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">전체 과목</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subject_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Grade */}
              {(view === 'class' || view === 'all') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    학년
                  </label>
                  <select
                    value={selectedGrade || ''}
                    onChange={(e) => setSelectedGrade(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">전체 학년</option>
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                  </select>
                </div>
              )}

              {/* Class */}
              {(view === 'class' || view === 'all') && selectedGrade && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    반
                  </label>
                  <select
                    value={selectedClass || ''}
                    onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">전체 반</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num}반
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Records Table */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="spinner"></div>
            </div>
          ) : (
            <RecordsTable
              records={records}
              onEdit={handleEditRecord}
              isTeacher={isTeacherOrAdmin}
            />
          )}
        </div>
      </main>

      {/* Record Editor Modal */}
      {editingRecord && (
        <RecordEditor
          record={editingRecord}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
