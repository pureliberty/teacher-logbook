// =====================================================
// 과목별 학급/학생 배정 관리 컴포넌트
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { formatStudentNumber } from '../utils/studentSort';
import StudentSelector from './StudentSelector';
import Pagination from './Pagination';
import type { StudentInfo, SubjectClassAssignment, ClassInfo } from '../types';

interface Props {
  subjectId: number;
  subjectName: string;
  schoolYear?: number;
  onClose?: () => void;
}

type TabMode = 'assigned' | 'class' | 'student';

const SCHOOL_CONFIG = { grades: [1, 2, 3] as const, classesPerGrade: 15 };

export default function SubjectAssignmentManager({ 
  subjectId, 
  subjectName, 
  schoolYear = 2025,
  onClose 
}: Props) {
  const [activeTab, setActiveTab] = useState<TabMode>('assigned');
  const [assignedClasses, setAssignedClasses] = useState<SubjectClassAssignment[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<StudentInfo[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<Set<string>>(new Set());
  const [selectedStudentsToRemove, setSelectedStudentsToRemove] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableClasses: ClassInfo[] = SCHOOL_CONFIG.grades.flatMap(grade =>
    Array.from({ length: SCHOOL_CONFIG.classesPerGrade }, (_, i) => ({ grade, classNumber: i + 1 }))
  );

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadAssignedClasses = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/assignments/subject/${subjectId}/classes?school_year=${schoolYear}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const classes = data.data || [];
      setAssignedClasses(classes);
      setSelectedClasses(new Set(classes.map((c: any) => `${c.grade}-${c.class_number}`)));
    } catch (err) {
      console.error('학급 로드 오류:', err);
    }
  }, [subjectId, schoolYear]);

  const loadAssignedStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/assignments/subject/${subjectId}/students?school_year=${schoolYear}&page=${page}&page_size=${pageSize}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setAssignedStudents(data.data || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      setError('학생 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, schoolYear, page, pageSize]);

  useEffect(() => {
    loadAssignedClasses();
    loadAssignedStudents();
  }, [loadAssignedClasses, loadAssignedStudents]);

  const handleToggleClass = (grade: number, classNumber: number) => {
    const key = `${grade}-${classNumber}`;
    const newSelected = new Set(selectedClasses);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedClasses(newSelected);
  };

  const handleSaveClassAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const currentKeys = new Set(selectedClasses);
      const previousKeys = new Set(assignedClasses.map(c => `${c.grade}-${c.class_number}`));
      
      // 해제할 학급
      for (const prevKey of previousKeys) {
        if (!currentKeys.has(prevKey)) {
          const [grade, classNumber] = prevKey.split('-').map(Number);
          await fetch('/api/assignments/remove-class', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject_id: subjectId, grade, class_number: classNumber, school_year: schoolYear })
          });
        }
      }

      // 새로 배정할 학급
      const newClasses = Array.from(currentKeys)
        .filter(key => !previousKeys.has(key))
        .map(key => { const [grade, classNumber] = key.split('-').map(Number); return { grade, class_number: classNumber }; });
      
      if (newClasses.length > 0) {
        await fetch('/api/assignments/classes-to-subject', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject_id: subjectId, classes: newClasses, school_year: schoolYear })
        });
      }

      await loadAssignedClasses();
      await loadAssignedStudents();
      setSuccess('학급 배정이 저장되었습니다.');
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudents = async () => {
    if (selectedStudentsToAdd.size === 0) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await fetch('/api/assignments/students-to-subject', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: subjectId, student_ids: Array.from(selectedStudentsToAdd), school_year: schoolYear })
      });
      setSelectedStudentsToAdd(new Set());
      await loadAssignedStudents();
      setSuccess(`${selectedStudentsToAdd.size}명 학생 추가 완료`);
    } catch (err) {
      setError('학생 추가 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudents = async () => {
    if (selectedStudentsToRemove.size === 0) return;
    if (!confirm(`${selectedStudentsToRemove.size}명을 제외하시겠습니까?`)) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await fetch('/api/assignments/remove-students', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: subjectId, student_ids: Array.from(selectedStudentsToRemove), school_year: schoolYear })
      });
      setSelectedStudentsToRemove(new Set());
      await loadAssignedStudents();
      setSuccess('학생 제외 완료');
    } catch (err) {
      setError('학생 제외 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAllAssigned = () => {
    if (selectedStudentsToRemove.size === assignedStudents.length && assignedStudents.length > 0) {
      setSelectedStudentsToRemove(new Set());
    } else {
      setSelectedStudentsToRemove(new Set(assignedStudents.map(s => s.user_id)));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{subjectName}</h2>
          <p className="text-sm text-gray-500">{schoolYear}학년도 배정 관리</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">✕</button>
        )}
      </div>

      {/* 메시지 */}
      {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {success && <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✓ {success}</div>}

      {/* 탭 */}
      <div className="flex border-b">
        <button onClick={() => setActiveTab('assigned')} className={`px-6 py-3 font-medium ${activeTab === 'assigned' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          배정된 학생 ({totalCount}명)
        </button>
        <button onClick={() => setActiveTab('class')} className={`px-6 py-3 font-medium ${activeTab === 'class' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          학급 단위 배정
        </button>
        <button onClick={() => setActiveTab('student')} className={`px-6 py-3 font-medium ${activeTab === 'student' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
          개별 학생 추가
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'assigned' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selectedStudentsToRemove.size === assignedStudents.length && assignedStudents.length > 0} onChange={handleSelectAllAssigned} className="w-4 h-4" />
                <span className="text-sm text-gray-600">{selectedStudentsToRemove.size > 0 ? `${selectedStudentsToRemove.size}명 선택됨` : '전체 선택'}</span>
              </label>
              <button onClick={handleRemoveStudents} disabled={selectedStudentsToRemove.size === 0 || loading} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm disabled:bg-gray-300">
                선택 학생 제외
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">로딩 중...</div>
            ) : assignedStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">배정된 학생이 없습니다.</div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border p-2 w-10"></th>
                    <th className="border p-2 text-left text-sm">학번</th>
                    <th className="border p-2 text-left text-sm">학년</th>
                    <th className="border p-2 text-left text-sm">반</th>
                    <th className="border p-2 text-left text-sm">번호</th>
                    <th className="border p-2 text-left text-sm">이름</th>
                    <th className="border p-2 text-left text-sm">배정 유형</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedStudents.map(student => (
                    <tr key={student.user_id} className={`hover:bg-gray-50 ${selectedStudentsToRemove.has(student.user_id) ? 'bg-red-50' : ''}`}>
                      <td className="border p-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStudentsToRemove.has(student.user_id)}
                          onChange={() => {
                            const newSet = new Set(selectedStudentsToRemove);
                            if (newSet.has(student.user_id)) newSet.delete(student.user_id);
                            else newSet.add(student.user_id);
                            setSelectedStudentsToRemove(newSet);
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border p-2 font-mono text-sm">{formatStudentNumber(student.grade, student.class_number, student.number_in_class)}</td>
                      <td className="border p-2 text-center">{student.grade}</td>
                      <td className="border p-2 text-center">{student.class_number}</td>
                      <td className="border p-2 text-center">{student.number_in_class}</td>
                      <td className="border p-2">{student.full_name || '-'}</td>
                      <td className="border p-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.assigned_type === 'class' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {student.assigned_type === 'class' ? '학급' : '개별'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {totalCount > pageSize && (
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
            )}
          </div>
        )}

        {activeTab === 'class' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">학급을 선택하면 해당 학급의 모든 학생이 자동으로 배정됩니다.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {SCHOOL_CONFIG.grades.map(grade => (
                <div key={grade} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 text-gray-700">{grade}학년</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {availableClasses.filter(c => c.grade === grade).map(c => {
                      const key = `${c.grade}-${c.classNumber}`;
                      const isSelected = selectedClasses.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleToggleClass(c.grade, c.classNumber)}
                          className={`p-2 text-sm rounded-md font-medium ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                        >
                          {c.classNumber}반
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSaveClassAssignments} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300">
              {loading ? '저장 중...' : '학급 배정 저장'}
            </button>
          </div>
        )}

        {activeTab === 'student' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">개별 학생을 검색하여 이 과목에 추가합니다.</p>
            <StudentSelector selectedStudents={selectedStudentsToAdd} onSelectionChange={setSelectedStudentsToAdd} excludeStudentIds={new Set(assignedStudents.map(s => s.user_id))} />
            <button onClick={handleAddStudents} disabled={selectedStudentsToAdd.size === 0 || loading} className="mt-4 w-full py-3 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:bg-gray-300">
              {loading ? '추가 중...' : `선택한 ${selectedStudentsToAdd.size}명 추가`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}