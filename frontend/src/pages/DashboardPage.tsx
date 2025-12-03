import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../store';
import { subjectApi, recordApi, authApi, teacherApi } from '../utils/api';
import RecordEditor from '../components/RecordEditor';
import RecordsTable from '../components/RecordsTable';
import type { RecordWithDetails, TeacherAssignment, MyClass, MySubject } from '../types';
import { ROLE_TYPE_LABELS } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { subjects, setSubjects, selectedSubject, setSelectedSubject } = useAppStore();
  
  const [records, setRecords] = useState<RecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordType, setRecordType] = useState<'all' | 'subject' | 'activity'>('all');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [schoolYear, setSchoolYear] = useState<number>(2025);
  const [editingRecord, setEditingRecord] = useState<RecordWithDetails | null>(null);

  // 교사 관련 상태
  const [myAssignments, setMyAssignments] = useState<TeacherAssignment[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [mySubjects, setMySubjects] = useState<MySubject[]>([]);
  const [activitySubjects, setActivitySubjects] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [recordType, selectedSubject, selectedGrade, selectedClass, selectedSemester, schoolYear]);

  const loadInitialData = async () => {
    try {
      const [subjectsData, userData] = await Promise.all([
        subjectApi.getAll(),
        authApi.getCurrentUser(),
      ]);
      
      setSubjects(subjectsData);
      useAuthStore.getState().updateUser(userData);

      // 교사/관리자인 경우 추가 데이터 로드
      if (userData.role === 'teacher' || userData.role === 'admin') {
        const [assignments, classes, teacherSubjects, activitySubs] = await Promise.all([
          teacherApi.getMyAssignments(schoolYear),
          teacherApi.getMyClasses(schoolYear),
          teacherApi.getMySubjects(schoolYear),
          teacherApi.getActivitySubjects(),
        ]);
        
        setMyAssignments(assignments);
        setMyClasses(classes);
        setMySubjects(teacherSubjects);
        setActivitySubjects(activitySubs);

        // 담당 학급이 있으면 첫 번째 학급 자동 선택
        if (classes.length > 0) {
          setSelectedGrade(classes[0].grade);
          setSelectedClass(classes[0].class_number);
        } else if (assignments.length > 0) {
          // 학급이 없으면 역할의 학년 선택
          const firstGrade = assignments.find(a => a.grade)?.grade;
          if (firstGrade) setSelectedGrade(firstGrade);
        }
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      let data: RecordWithDetails[] = [];
      
      if (user?.role === 'student') {
        // 학생: 자신의 기록만 조회
        data = await recordApi.getAll({ student_user_id: user.user_id });
      } else if (user?.role === 'teacher' || user?.role === 'admin') {
        // 교사/관리자: 권한 기반 조회
        const params: any = {
          school_year: schoolYear,
        };
        
        if (selectedSemester) params.semester = selectedSemester;
        if (selectedGrade) params.grade = selectedGrade;
        if (selectedClass) params.class_number = selectedClass;
        if (selectedSubject) params.subject_id = selectedSubject.id;
        if (recordType !== 'all') params.record_type = recordType;
        
        data = await teacherApi.getAccessibleRecords(params);
      }
      
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

  // 담당 학급 옵션 생성
  const getClassOptions = () => {
    if (user?.role === 'admin') {
      // 관리자는 전체 반 선택 가능
      return Array.from({ length: 15 }, (_, i) => i + 1);
    }
    // 교사는 담당 학급만
    const classesForGrade = myClasses.filter(c => c.grade === selectedGrade);
    if (classesForGrade.length > 0) {
      return classesForGrade.map(c => c.class_number);
    }
    // 학년부장/생기부관리자는 전체 반 선택 가능
    const hasGradeAccess = myAssignments.some(
      a => a.grade === selectedGrade && ['grade_head', 'record_manager'].includes(a.role_type)
    );
    if (hasGradeAccess) {
      return Array.from({ length: 15 }, (_, i) => i + 1);
    }
    return [];
  };

  // 담당 과목 옵션 생성
  const getSubjectOptions = () => {
    if (user?.role === 'admin') {
      return subjects;
    }
    
    // 담임/부담임/학년부장/생기부관리자는 모든 과목 조회 가능
    const hasFullAccess = myAssignments.some(a => 
      ['homeroom_teacher', 'assistant_homeroom', 'grade_head', 'record_manager'].includes(a.role_type) &&
      a.grade === selectedGrade &&
      (a.class_number === selectedClass || !a.class_number)
    );
    
    if (hasFullAccess) {
      return subjects;
    }
    
    // 교과교사는 담당 과목만
    const mySubjectIds = mySubjects
      .filter(s => s.grade === selectedGrade && (!s.class_number || s.class_number === selectedClass))
      .map(s => s.id);
    
    return subjects.filter(s => mySubjectIds.includes(s.id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">쌩기부</h1>
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
        {/* 교사 역할 안내 */}
        {isTeacherOrAdmin && myAssignments.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">내 담당 역할</h3>
            <div className="flex flex-wrap gap-2">
              {myAssignments.map((a, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {ROLE_TYPE_LABELS[a.role_type]}
                  {a.grade && ` ${a.grade}학년`}
                  {a.class_number && ` ${a.class_number}반`}
                  {a.subject_name && ` (${a.subject_name})`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filters - Only for teachers and admin */}
        {isTeacherOrAdmin && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">조회 옵션</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {/* 학년도 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학년도</label>
                <select
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              {/* 학기 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={1}>1학기</option>
                  <option value={2}>2학기</option>
                </select>
              </div>

              {/* 기록 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기록 유형</label>
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="all">전체</option>
                  <option value="subject">교과 세특</option>
                  <option value="activity">활동 기록</option>
                </select>
              </div>

              {/* 학년 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                <select
                  value={selectedGrade || ''}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value ? Number(e.target.value) : null);
                    setSelectedClass(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">전체</option>
                  {user?.role === 'admin' ? (
                    <>
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                    </>
                  ) : (
                    [...new Set(myAssignments.map(a => a.grade).filter(Boolean))].map(g => (
                      <option key={g} value={g}>{g}학년</option>
                    ))
                  )}
                </select>
              </div>

              {/* 반 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
                <select
                  value={selectedClass || ''}
                  onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={!selectedGrade}
                >
                  <option value="">전체</option>
                  {getClassOptions().map(c => (
                    <option key={c} value={c}>{c}반</option>
                  ))}
                </select>
              </div>

              {/* 과목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
                <select
                  value={selectedSubject?.id || ''}
                  onChange={(e) => {
                    const subject = subjects.find(s => s.id === Number(e.target.value));
                    setSelectedSubject(subject || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">전체</option>
                  {getSubjectOptions().map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.subject_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 조회 버튼 */}
            <div className="mt-4">
              <button
                onClick={loadRecords}
                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                조회
              </button>
            </div>
          </div>
        )}

        {/* 역할 미배정 안내 */}
        {isTeacherOrAdmin && myAssignments.length === 0 && user?.role === 'teacher' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ 역할이 배정되지 않았습니다</h3>
            <p className="text-yellow-700">
              관리자에게 담당 학급/과목 배정을 요청해주세요. 
              역할이 배정되면 해당 기록을 조회하고 편집할 수 있습니다.
            </p>
          </div>
        )}

        {/* Records Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">
              기록 목록 ({records.length}건)
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>조회된 기록이 없습니다.</p>
              {isTeacherOrAdmin && (
                <p className="mt-2 text-sm">필터 조건을 변경하거나 데이터를 임포트해주세요.</p>
              )}
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