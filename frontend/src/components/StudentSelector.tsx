// =====================================================
// 학생 선택 컴포넌트
// =====================================================

import { useState, useEffect, useMemo } from 'react';
import { formatStudentNumber } from '../utils/studentSort';
import type { StudentInfo } from '../types';

interface Props {
  selectedStudents: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  excludeStudentIds?: Set<string>;
}

export default function StudentSelector({ 
  selectedStudents, 
  onSelectionChange,
  excludeStudentIds = new Set()
}: Props) {
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState<number | ''>('');
  const [filterClass, setFilterClass] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/assignments/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAllStudents(data.data || []);
    } catch (err) {
      console.error('학생 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return allStudents.filter(student => {
      if (excludeStudentIds.has(student.user_id)) return false;
      if (filterGrade !== '' && student.grade !== filterGrade) return false;
      if (filterClass !== '' && student.class_number !== filterClass) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const studentNumber = formatStudentNumber(student.grade, student.class_number, student.number_in_class);
        const matchesName = (student.full_name || '').toLowerCase().includes(term);
        const matchesNumber = studentNumber.includes(term);
        if (!matchesName && !matchesNumber) return false;
      }
      return true;
    });
  }, [allStudents, excludeStudentIds, filterGrade, filterClass, searchTerm]);

  const handleToggleStudent = (userId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length && filteredStudents.length > 0) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filteredStudents.map(s => s.user_id)));
    }
  };

  const availableClasses = useMemo(() => {
    if (filterGrade === '') return [];
    const classes = new Set(allStudents.filter(s => s.grade === filterGrade).map(s => s.class_number));
    return Array.from(classes).sort((a, b) => a - b);
  }, [allStudents, filterGrade]);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">학생 목록 로딩 중...</div>;
  }

  return (
    <div>
      {/* 필터 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterGrade}
          onChange={(e) => { setFilterGrade(e.target.value === '' ? '' : Number(e.target.value)); setFilterClass(''); }}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">전체 학년</option>
          <option value={1}>1학년</option>
          <option value={2}>2학년</option>
          <option value={3}>3학년</option>
        </select>

        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={filterGrade === ''}
          className="px-3 py-2 border rounded-md disabled:bg-gray-100"
        >
          <option value="">전체 반</option>
          {availableClasses.map(cls => (
            <option key={cls} value={cls}>{cls}반</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="이름 또는 학번 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border rounded-md"
        />
      </div>

      {/* 선택 정보 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
            onChange={handleSelectAll}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-600">전체 선택 ({filteredStudents.length}명)</span>
        </label>
        {selectedStudents.size > 0 && (
          <span className="text-sm text-blue-600 font-medium">{selectedStudents.size}명 선택됨</span>
        )}
      </div>

      {/* 학생 목록 */}
      <div className="border rounded-md max-h-80 overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">조건에 맞는 학생이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-2 w-10"></th>
                <th className="p-2 text-left text-sm">학번</th>
                <th className="p-2 text-left text-sm">학년/반/번호</th>
                <th className="p-2 text-left text-sm">이름</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr 
                  key={student.user_id}
                  onClick={() => handleToggleStudent(student.user_id)}
                  className={`cursor-pointer ${selectedStudents.has(student.user_id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedStudents.has(student.user_id)}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="p-2 font-mono text-sm">
                    {formatStudentNumber(student.grade, student.class_number, student.number_in_class)}
                  </td>
                  <td className="p-2 text-sm text-gray-600">
                    {student.grade}-{student.class_number}-{student.number_in_class}
                  </td>
                  <td className="p-2">{student.full_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}