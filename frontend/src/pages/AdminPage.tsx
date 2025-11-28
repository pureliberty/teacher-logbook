import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { adminApi, subjectApi } from '../utils/api';
import type { User, Subject } from '../types';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'subjects'>('users');
  
  // New user form
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'teacher' | 'student'>('student');
  
  // New subject form
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectDesc, setNewSubjectDesc] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, subjectsData] = await Promise.all([
        adminApi.getAllUsers(),
        subjectApi.getAll(),
      ]);
      setUsers(usersData);
      setSubjects(subjectsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await adminApi.createUser({
        user_id: newUserId,
        password: newPassword,
        full_name: newFullName || undefined,
        role: newRole,
      });
      
      setSuccess('사용자가 생성되었습니다.');
      setNewUserId('');
      setNewPassword('');
      setNewFullName('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '사용자 생성에 실패했습니다.');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await subjectApi.create({
        subject_name: newSubjectName,
        subject_code: newSubjectCode,
        description: newSubjectDesc || undefined,
      });
      
      setSuccess('과목이 생성되었습니다.');
      setNewSubjectName('');
      setNewSubjectCode('');
      setNewSubjectDesc('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '과목 생성에 실패했습니다.');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // This is a placeholder - you would need to implement Excel parsing
    setError('엑셀 업로드 기능은 구현 중입니다.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="alert-error mb-4">{error}</div>}
        {success && <div className="alert-success mb-4">{success}</div>}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-md font-medium ${
              activeTab === 'users'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            사용자 관리
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-6 py-3 rounded-md font-medium ${
              activeTab === 'subjects'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            과목 관리
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Create User Form */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">사용자 추가</h2>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input
                  type="text"
                  placeholder="아이디"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="이름 (선택)"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="student">학생</option>
                  <option value="teacher">교사</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  추가
                </button>
              </form>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  엑셀 파일 업로드
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  형식: 아이디, 비밀번호, 이름, 역할
                </p>
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  전체 사용자 ({users.length})
                </h2>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>아이디</th>
                      <th>이름</th>
                      <th>역할</th>
                      <th>학급 정보</th>
                      <th>생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="font-mono">{user.user_id}</td>
                        <td>{user.full_name || '-'}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.role === 'admin' ? 'bg-red-100 text-red-800' :
                            user.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {user.role === 'admin' ? '관리자' :
                             user.role === 'teacher' ? '교사' : '학생'}
                          </span>
                        </td>
                        <td>
                          {user.role === 'student' && user.grade ? (
                            `${user.grade}학년 ${user.class_number}반 ${user.number_in_class}번`
                          ) : '-'}
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            {/* Create Subject Form */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">과목 추가</h2>
              <form onSubmit={handleCreateSubject} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="과목명"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="과목 코드"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  required
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="설명 (선택)"
                  value={newSubjectDesc}
                  onChange={(e) => setNewSubjectDesc(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  추가
                </button>
              </form>
            </div>

            {/* Subjects List */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  전체 과목 ({subjects.length})
                </h2>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>과목명</th>
                      <th>과목 코드</th>
                      <th>설명</th>
                      <th>생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject) => (
                      <tr key={subject.id}>
                        <td className="font-semibold">{subject.subject_name}</td>
                        <td className="font-mono">{subject.subject_code}</td>
                        <td>{subject.description || '-'}</td>
                        <td>{new Date(subject.created_at).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
