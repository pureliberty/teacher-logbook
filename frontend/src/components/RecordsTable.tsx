import { RecordWithDetails } from '../types';
import { calculateCounts, getByteCountColor } from '../utils/byteCount';

interface RecordsTableProps {
  records: RecordWithDetails[];
  onEdit: (record: RecordWithDetails) => void;
  isTeacher: boolean;
}

export default function RecordsTable({ records, onEdit, isTeacher }: RecordsTableProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-24">학번</th>
            <th className="w-32">이름</th>
            <th className="w-32">과목</th>
            <th>내용</th>
            <th className="w-24">글자수</th>
            <th className="w-24">바이트</th>
            <th className="w-32">상태</th>
            <th className="w-24">작업</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const { charCount, byteCount } = calculateCounts(record.content || '');
            const byteColorClass = getByteCountColor(byteCount);
            
            return (
              <tr key={record.id}>
                <td className="font-mono text-xs">{record.student_user_id}</td>
                <td>{record.student_name || '-'}</td>
                <td>{record.subject_name}</td>
                <td className="max-w-md">
                  <div className="truncate text-gray-700">
                    {record.content ? (
                      record.content.substring(0, 100) + (record.content.length > 100 ? '...' : '')
                    ) : (
                      <span className="text-gray-400">내용 없음</span>
                    )}
                  </div>
                </td>
                <td className="text-right font-mono text-sm">
                  {charCount.toLocaleString()}
                </td>
                <td className={`text-right font-mono text-sm ${byteColorClass}`}>
                  {byteCount.toLocaleString()}
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    {record.is_locked && (
                      <span className="locked-indicator">
                        🔒 {record.locked_by}
                      </span>
                    )}
                    {!isTeacher && record.is_editable_by_student && (
                      <span className="text-xs text-green-600">편집 가능</span>
                    )}
                  </div>
                </td>
                <td>
                  <button
                    onClick={() => onEdit(record)}
                    className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                    disabled={record.is_locked && record.locked_by !== localStorage.getItem('user_id')}
                  >
                    {record.is_locked ? '보기' : '편집'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
