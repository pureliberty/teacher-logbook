import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { adminApi, subjectApi } from '../utils/api';
import type { User, Subject, TeacherAssignment, TeacherRoleType } from '../types';
import { ROLE_TYPE_LABELS } from '../types';
import SubjectAssignmentManager from '../components/SubjectAssignmentManager';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
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
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
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
        <p className="text-sm text-gray-600">사용자: {user.user_id} ({user.full_name})</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
  type: 'users' | 'subjects' | 'teacher-assignments';
  onImportComplete: () => void;
}

function ExcelImportSection({ type, onImportComplete }: ExcelImportSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [schoolYear, setSchoolYear] = useState(2025);

  const typeNames: Record<string, string> = {
    'users': '사용자',
    'subjects': '과목',
    'teacher-assignments': '교사 역할 배정'
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/download-template/${type}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
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

      let url = `/api/admin/import-excel/${type}`;
      if (type === 'teacher-assignments') {
        url = `/api/admin/import-teacher-assignments?school_year=${schoolYear}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
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
      <h3 className="text-lg font-semibold mb-4">{typeNames[type]} Excel 임포트</h3>
      <div className="space-y-4">
        <button onClick={handleDownloadTemplate} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800">
          <span>📥 Excel 템플릿 다운로드</span>
        </button>

        {type === 'teacher-assignments' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">학년도</label>
            <input
              type="number"
              value={schoolYear}
              onChange={(e) => setSchoolYear(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Excel 파일 선택</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={!file || importing}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {importing ? '임포트 중...' : '임포트 실행'}
        </button>

        {result && (
          <div className={`p-4 rounded-md ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <p className="font-semibold mb-2">임포트 결과:</p>
            <ul className="text-sm space-y-1">
              <li className="text-green-600">✓ 성공: {result.success}건</li>
              {result.failed > 0 && <li className="text-red-600">✗ 실패: {result.failed}건</li>}
            </ul>
            {result.errors?.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                <p className="font-semibold text-sm mb-1">오류:</p>
                {result.errors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-red-600">• {err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 교사 역할 배정 관리 컴포넌트
// 교사 역할 배정 관리 컴포넌트
function TeacherAssignmentManager() {
  const [assignments, setAssignments] = useState<TeacherAssignmentWithDetails[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation State (Multi-select)
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear());
  const [newTeacherId, setNewTeacherId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<TeacherRoleType>>(new Set());
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set()); // Format: "grade-class"
  const [newSubjectId, setNewSubjectId] = useState<number | ''>('');

  // Bulk Action State
  const [selectedAssignments, setSelectedAssignments] = useState<Set<number>>(new Set());

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    teacher_user_id: string;
    role_type: TeacherRoleType;
    grade: number;
    class_number: number;
    subject_id: number | null;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [schoolYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignRows, userRows, subjRows] = await Promise.all([
        adminApi.getTeacherAssignments(schoolYear),
        adminApi.getAllUsers(),
        subjectApi.getAll(),
      ]);
      setAssignments(assignRows);
      setTeachers(userRows.filter(u => u.role === 'teacher' || u.role === 'admin'));
      setSubjects(subjRows);
    } catch (error) {
      console.error('Data load failed:', error);
      // alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: TeacherRoleType) => {
    const newSet = new Set(selectedRoles);
    if (newSet.has(role)) newSet.delete(role);
    else newSet.add(role);
    setSelectedRoles(newSet);
  };

  const toggleClass = (grade: number, classNum: number) => {
    const key = `${grade}-${classNum}`;
    const newSet = new Set(selectedClasses);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedClasses(newSet);
  };

  const handleCreate = async () => {
    if (!newTeacherId) {
      alert('교사를 선택해주세요.');
      return;
    }
    if (selectedRoles.size === 0) {
      alert('최소 하나의 역할을 선택해주세요.');
      return;
    }

    // Validation
    if (selectedRoles.has('subject_teacher') && !newSubjectId) {
      alert('교과교사 역할이 포함되어 있어 과목 선택이 필수입니다.');
      return;
    }
    if ((selectedRoles.has('homeroom_teacher') || selectedRoles.has('assistant_homeroom')) && selectedClasses.size === 0) {
      alert('담임/부담임 역할이 포함되어 있어 학급 선택이 필수입니다.');
      return;
    }

    try {
      const promises: Promise<any>[] = [];

      for (const role of selectedRoles) {
        if (['homeroom_teacher', 'assistant_homeroom', 'grade_head'].includes(role)) {
          if (selectedClasses.size > 0) {
            for (const classKey of selectedClasses) {
              const [g, c] = classKey.split('-').map(Number);
              promises.push(adminApi.createTeacherAssignment({
                teacher_user_id: newTeacherId,
                role_type: role,
                grade: g,
                class_number: c,
                subject_id: null,
                school_year: schoolYear
              }));
            }
          } else if (role === 'grade_head') {
            // Grade head without class selected? Maybe assume grade 0? 
            // For now just skip as our UI emphasizes class selection.
          }
        }
        else if (role === 'subject_teacher') {
          if (selectedClasses.size > 0) {
            for (const classKey of selectedClasses) {
              const [g, c] = classKey.split('-').map(Number);
              promises.push(adminApi.createTeacherAssignment({
                teacher_user_id: newTeacherId,
                role_type: role,
                grade: g,
                class_number: c,
                subject_id: newSubjectId || null,
                school_year: schoolYear
              }));
            }
          } else {
            // Subject teacher with no class (fallback if needed)
            promises.push(adminApi.createTeacherAssignment({
              teacher_user_id: newTeacherId,
              role_type: role,
              grade: 0,
              class_number: 0,
              subject_id: newSubjectId || null,
              school_year: schoolYear
            }));
          }
        } else {
          promises.push(adminApi.createTeacherAssignment({
            teacher_user_id: newTeacherId,
            role_type: role,
            grade: 0,
            class_number: 0,
            subject_id: null,
            school_year: schoolYear
          }));
        }
      }

      await Promise.all(promises);

      alert('배정이 완료되었습니다.');
      // Reset limited state
      setSelectedClasses(new Set());
      setSelectedRoles(new Set());
      loadData();
    } catch (error: any) {
      console.error(error);
      alert('일부 배정 실패: ' + (error.response?.data?.detail || error.message));
      loadData();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssignments.size === 0) return;
    if (!confirm(`선택한 ${selectedAssignments.size}개의 배정을 삭제하시겠습니까?`)) return;

    try {
      await Promise.all(Array.from(selectedAssignments).map(id => adminApi.deleteTeacherAssignment(id)));
      setSelectedAssignments(new Set());
      loadData();
    } catch (e) {
      alert('삭제 중 오류 발생');
    }
  };

  const startEdit = (assignment: TeacherAssignmentWithDetails) => {
    setEditingId(assignment.id);
    setEditForm({
      teacher_user_id: assignment.teacher_user_id,
      role_type: assignment.role_type,
      grade: assignment.grade,
      class_number: assignment.class_number,
      subject_id: assignment.subject_id
    });
  };

  const handleUpdate = async (id: number) => {
    if (!editForm) return;
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/admin/teacher-assignments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...editForm,
          school_year: schoolYear
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Update failed');
      }

      setEditingId(null);
      setEditForm(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const toggleAssignmentSelection = (id: number) => {
    const newSet = new Set(selectedAssignments);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAssignments(newSet);
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="space-y-8">
      <ExcelImportSection type="teacher-assignments" onImportComplete={loadData} />

      {/* Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">새 역할 배정</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">학년도</label>
              <input type="number" value={schoolYear} onChange={e => setSchoolYear(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">교사 선택</label>
              <select value={newTeacherId} onChange={e => setNewTeacherId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                <option value="">선택하세요</option>
                {teachers.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name || t.user_id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">과목 (교과교사용)</label>
              <select value={newSubjectId} onChange={e => setNewSubjectId(Number(e.target.value) || '')} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                <option value="">과목 없음</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">역할 선택 (다중 선택 가능)</label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(ROLE_TYPE_LABELS).map(([role, label]) => (
                <label key={role} className={`flex items-center space-x-2 px-3 py-2 rounded border cursor-pointer ${selectedRoles.has(role as TeacherRoleType) ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  <input type="checkbox" checked={selectedRoles.has(role as TeacherRoleType)} onChange={() => toggleRole(role as TeacherRoleType)} className="rounded text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">학급 선택 (다중 선택 가능)</label>
            <div className="grid grid-cols-1 gap-2 border p-3 rounded-md bg-gray-50">
              {[1, 2, 3].map(grade => (
                <div key={grade} className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="w-12 font-bold text-gray-600 flex-shrink-0">{grade}학년</span>
                  {Array.from({ length: 15 }, (_, i) => i + 1).map(cls => {
                    const key = `${grade}-${cls}`;
                    const isSelected = selectedClasses.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleClass(grade, cls)}
                        className={`w-8 h-8 rounded-full text-xs font-medium flex-shrink-0 transition-colors border
                                            ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleCreate} className="w-full py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-sm">
            선택한 역할 배정하기
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-700">배정 목록 ({assignments.length})</h3>
          {selectedAssignments.size > 0 && (
            <button onClick={handleBulkDelete} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
              선택 삭제 ({selectedAssignments.size})
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 w-8"><input type="checkbox" checked={selectedAssignments.size === assignments.length && assignments.length > 0} onChange={() => {
                  if (selectedAssignments.size === assignments.length) setSelectedAssignments(new Set());
                  else setSelectedAssignments(new Set(assignments.map(a => a.id)));
                }} /></th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">교사</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">역할</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">학년</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">반</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">과목</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {assignments.map(a => {
                const isEditing = editingId === a.id;
                return (
                  <tr key={a.id} className={selectedAssignments.has(a.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedAssignments.has(a.id)} onChange={() => toggleAssignmentSelection(a.id)} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <select className="border rounded px-1 py-1 text-sm bg-white" value={editForm?.teacher_user_id} onChange={e => setEditForm({ ...editForm!, teacher_user_id: e.target.value })}>
                          {teachers.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name}</option>)}
                        </select>
                      ) : (
                        a.teacher_name || a.teacher_user_id
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <select className="border rounded px-1 py-1 text-sm bg-white" value={editForm?.role_type} onChange={e => setEditForm({ ...editForm!, role_type: e.target.value as TeacherRoleType })}>
                          {Object.entries(ROLE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${a.role_type === 'homeroom_teacher' ? 'bg-purple-100 text-purple-800' :
                          a.role_type === 'assistant_homeroom' ? 'bg-pink-100 text-pink-800' :
                            a.role_type === 'subject_teacher' ? 'bg-blue-100 text-blue-800' :
                              a.role_type === 'grade_head' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                          }`}>
                          {ROLE_TYPE_LABELS[a.role_type]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? <input type="number" className="w-16 border rounded px-1" value={editForm?.grade} onChange={e => setEditForm({ ...editForm!, grade: Number(e.target.value) })} /> : (a.grade ? a.grade + '학년' : '-')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? <input type="number" className="w-16 border rounded px-1" value={editForm?.class_number} onChange={e => setEditForm({ ...editForm!, class_number: Number(e.target.value) })} /> : (a.class_number ? a.class_number + '반' : '-')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <select className="border rounded px-1 py-1 text-sm bg-white" value={editForm?.subject_id || ''} onChange={e => setEditForm({ ...editForm!, subject_id: Number(e.target.value) || null })}>
                          <option value="">없음</option>
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                        </select>
                      ) : (a.subject_name || '-')}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => handleUpdate(a.id)} className="text-blue-600 font-bold hover:underline">저장</button>
                          <button onClick={() => { setEditingId(null); setEditForm(null); }} className="text-gray-500 hover:underline">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(a)} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50">수정</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
  const [activeTab, setActiveTab] = useState<'users' | 'subjects' | 'assignments' | 'subject-assignments'>('users');

  // 선택된 항목들
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [selectedSubjectForAssignment, setSelectedSubjectForAssignment] = useState<Subject | null>(null);

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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(`${userId} 사용자를 삭제하시겠습니까?`)) return;

    try {
      await adminApi.deleteUser(userId);
      setSuccess('사용자가 삭제되었습니다.');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '삭제 실패');
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) {
      alert('삭제할 사용자를 선택하세요.');
      return;
    }
    if (!confirm(`선택한 ${selectedUsers.size}명의 사용자를 삭제하시겠습니까?`)) return;

    try {
      await adminApi.bulkDeleteUsers(Array.from(selectedUsers));
      setSuccess(`${selectedUsers.size}명의 사용자가 삭제되었습니다.`);
      setSelectedUsers(new Set());
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '삭제 실패');
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

  const handleDeleteSubject = async (subjectId: number) => {
    if (!confirm('이 과목을 삭제하시겠습니까?')) return;

    try {
      await subjectApi.delete(subjectId);
      setSuccess('과목이 삭제되었습니다.');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '삭제 실패');
    }
  };

  const handleBulkDeleteSubjects = async () => {
    if (selectedSubjects.size === 0) {
      alert('삭제할 과목을 선택하세요.');
      return;
    }
    if (!confirm(`선택한 ${selectedSubjects.size}개의 과목을 삭제하시겠습니까?`)) return;

    try {
      const result = await subjectApi.bulkDelete(Array.from(selectedSubjects));
      if (result.errors.length > 0) {
        setError(`일부 과목 삭제 실패: ${result.errors.join(', ')}`);
      }
      if (result.deleted > 0) {
        setSuccess(`${result.deleted}개의 과목이 삭제되었습니다.`);
      }
      setSelectedSubjects(new Set());
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '삭제 실패');
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const toggleSubjectSelection = (subjectId: number) => {
    const newSet = new Set(selectedSubjects);
    if (newSet.has(subjectId)) {
      newSet.delete(subjectId);
    } else {
      newSet.add(subjectId);
    }
    setSelectedSubjects(newSet);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.size === users.filter(u => u.user_id !== user?.user_id).length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.filter(u => u.user_id !== user?.user_id).map(u => u.user_id)));
    }
  };

  const toggleAllSubjects = () => {
    if (selectedSubjects.size === subjects.length) {
      setSelectedSubjects(new Set());
    } else {
      setSelectedSubjects(new Set(subjects.map(s => s.id)));
    }
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
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-md font-medium ${activeTab === 'users' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            사용자 관리
          </button>
          <button onClick={() => setActiveTab('subjects')} className={`px-6 py-3 rounded-md font-medium ${activeTab === 'subjects' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            과목 관리
          </button>
          <button onClick={() => setActiveTab('assignments')} className={`px-6 py-3 rounded-md font-medium ${activeTab === 'assignments' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            교사 역할 배정
          </button>
          <button onClick={() => setActiveTab('subject-assignments')} className={`px-6 py-3 rounded-md font-medium ${activeTab === 'subject-assignments' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            과목-학생 배정
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="space-y-6">
            <ExcelImportSection type="users" onImportComplete={loadData} />

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">사용자 추가</h2>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input type="text" placeholder="아이디" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md" />
                <input type="password" placeholder="비밀번호" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md" />
                <input type="text" placeholder="이름 (선택)" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-md">
                  <option value="student">학생</option>
                  <option value="teacher">교사</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">추가</button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold">전체 사용자 ({users.length})</h2>
                {selectedUsers.size > 0 && (
                  <button onClick={handleBulkDeleteUsers} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                    선택 삭제 ({selectedUsers.size})
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input type="checkbox" onChange={toggleAllUsers} checked={selectedUsers.size === users.filter(u => u.user_id !== user?.user_id).length && users.length > 1} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">아이디</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학급 정보</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className={selectedUsers.has(u.user_id) ? 'bg-blue-50' : ''}>
                        <td className="px-4 py-3">
                          {u.user_id !== user?.user_id && (
                            <input type="checkbox" checked={selectedUsers.has(u.user_id)} onChange={() => toggleUserSelection(u.user_id)} />
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">{u.user_id}</td>
                        <td className="px-4 py-3">{u.full_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${u.role === 'admin' ? 'bg-red-100 text-red-800' :
                            u.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                            {u.role === 'admin' ? '관리자' : u.role === 'teacher' ? '교사' : '학생'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{u.role === 'student' && u.grade ? `${u.grade}학년 ${u.class_number}반 ${u.number_in_class}번` : '-'}</td>
                        <td className="px-4 py-3">{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3 space-x-2">
                          <button onClick={() => { setSelectedUser(u); setShowResetModal(true); }} className="text-yellow-600 hover:text-yellow-800" title="비밀번호 초기화">🔑</button>
                          {u.user_id !== user?.user_id && (
                            <button onClick={() => handleDeleteUser(u.user_id)} className="text-red-600 hover:text-red-800" title="삭제">🗑️</button>
                          )}
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
                <input type="text" placeholder="과목명" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md" />
                <input type="text" placeholder="과목 코드" value={newSubjectCode} onChange={(e) => setNewSubjectCode(e.target.value)} required className="px-3 py-2 border border-gray-300 rounded-md" />
                <input type="text" placeholder="설명 (선택)" value={newSubjectDesc} onChange={(e) => setNewSubjectDesc(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md" />
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">추가</button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold">전체 과목 ({subjects.length})</h2>
                {selectedSubjects.size > 0 && (
                  <button onClick={handleBulkDeleteSubjects} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                    선택 삭제 ({selectedSubjects.size})
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input type="checkbox" onChange={toggleAllSubjects} checked={selectedSubjects.size === subjects.length && subjects.length > 0} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">과목명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">과목 코드</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">배정 관리</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subjects.map((subject) => (
                      <tr key={subject.id} className={selectedSubjects.has(subject.id) ? 'bg-blue-50' : ''}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedSubjects.has(subject.id)} onChange={() => toggleSubjectSelection(subject.id)} />
                        </td>
                        <td className="px-4 py-3 font-semibold">{subject.subject_name}</td>
                        <td className="px-4 py-3 font-mono">{subject.subject_code}</td>
                        <td className="px-4 py-3">{subject.description || '-'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteSubject(subject.id)} className="text-red-600 hover:text-red-800" title="삭제">🗑️</button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedSubjectForAssignment(subject)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
                          >
                            학생/학급 배정
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && <TeacherAssignmentManager />}



        {activeTab === 'subject-assignments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">과목별 학생 배정</h2>
              <p className="text-gray-600 mb-4">과목을 선택하여 학급/학생을 배정하세요.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubjectForAssignment(subject)}
                    className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-400 text-left transition group"
                  >
                    <div className="font-semibold text-gray-900 group-hover:text-blue-700">{subject.subject_name}</div>
                    <div className="text-sm text-gray-500 font-mono">{subject.subject_code}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 과목 선택 시 모달로 SubjectAssignmentManager 표시 */}
            {selectedSubjectForAssignment && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <SubjectAssignmentManager
                  subjectId={selectedSubjectForAssignment.id}
                  subjectName={selectedSubjectForAssignment.subject_name}
                  schoolYear={2025}
                  onClose={() => setSelectedSubjectForAssignment(null)}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}