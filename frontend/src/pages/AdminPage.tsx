import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { adminApi, subjectApi } from '../utils/api';
import type { User, Subject } from '../types';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onReset: () => void;
}

function ResetPasswordModal({ user, onClose, onReset }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('1234!');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.user_id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ new_password: newPassword })
      });

      if (response.ok) {
        alert(`${user.user_id}의 비밀번호가 초기화되었습니다.`);
        onReset();
        onClose();
      } else {
        alert('비밀번호 초기화 실패');
      }
    } catch (error) {
      console.error(error);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="비밀번호 초기화" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">사용자: {user.user_id}</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="새 비밀번호"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">취소</button>
          <button onClick={handleReset} disabled={loading || !newPassword} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? '처리 중...' : '초기화'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ExcelImportSectionProps {
  type: 'users' | 'subjects';
  onImportComplete: () => void;
}

function ExcelImportSection({ type, onImportComplete }: ExcelImportSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const typeName = type === 'users' ? '사용자' : '과목';

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/download-template/${type}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_template.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(error);
      alert('템플릿 다운로드 실패');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) {
      alert('파일을 선택해주세요.');
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/admin/import-excel/${type}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        if (data.success > 0) onImportComplete();
      } else {
        alert('임포트 실패');
      }
    } catch (error) {
      console.error(error);
      alert('오류가 발생했습니다.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{typeName} Excel 임포트</h3>
      <div className="space-y-4">
        <button onClick={handleDownloadTemplate} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>📥 Excel 템플릿 다운로드</span>
        </button>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Excel 파일 선택</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && <p className="text-sm text-gray-600 mt-1">선택된 파일: {file.name}</p>}
        </div>

        <button
          onClick={handleImport}
          disabled={!file || importing}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>}
          {importing ? '임포트 중...' : '임포트 실행'}
        </button>

        {result && (
          <div className={`p-4 rounded-md ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <p className="font-semibold mb-2">임포트 결과:</p>
            <ul className="text-sm space-y-1">
              <li className="text-green-600">✓ 성공: {result.success}건</li>
              {result.failed > 0 && <li className="text-red-600">✗ 실패: {result.failed}건</li>}
            </ul>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold text-sm mb-1">오류 내역:</p>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((error: string, idx: number) => (
                    <li key={idx} className="text-red-600">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="alert-error mb-4">{error}</div>}
        {success && <div className="alert-success mb-4">{success}</div>}

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-md font-medium ${activeTab === 'users' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            사용자 관리
          </button>
          <button onClick={() => setActiveTab('subjects')} className={`px-6 py-3 rounded-md font-medium ${activeTab === 'subjects' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            과목 관리
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="space-y-6">
            <ExcelImportSection type="users" onImportComplete={loadData} />
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">사용자 추가</h2>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input type="text" placeholder="아이디" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                <input type="password" placeholder="비밀번호" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                <input type="text" placeholder="이름 (선택)" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="student">학생</option>
                  <option value="teacher">교사</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">추가</button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">전체 사용자 ({users.length})</h2>
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
                      <th>작업</th>
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
                            {user.role === 'admin' ? '관리자' : user.role === 'teacher' ? '교사' : '학생'}
                          </span>
                        </td>
                        <td>{user.role === 'student' && user.grade ? `${user.grade}학년 ${user.class_number}반 ${user.number_in_class}번` : '-'}</td>
                        <td>{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                        <td>
                          <button onClick={() => { setSelectedUser(user); setShowResetModal(true); }} className="text-yellow-600 hover:text-yellow-800 text-sm" title="비밀번호 초기화">🔑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {showResetModal && selectedUser && (
              <ResetPasswordModal user={selectedUser} onClose={() => { setShowResetModal(false); setSelectedUser(null); }} onReset={loadData} />
            )}
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <ExcelImportSection type="subjects" onImportComplete={loadData} />
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">과목 추가</h2>
              <form onSubmit={handleCreateSubject} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input type="text" placeholder="과목명" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                <input type="text" placeholder="과목 코드" value={newSubjectCode} onChange={(e) => setNewSubjectCode(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                <input type="text" placeholder="설명 (선택)" value={newSubjectDesc} onChange={(e) => setNewSubjectDesc(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">추가</button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">전체 과목 ({subjects.length})</h2>
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
