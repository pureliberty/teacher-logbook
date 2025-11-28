import { useState, useEffect, useRef } from 'react';
import { RecordWithDetails, Comment, RecordVersion } from '../types';
import { recordApi } from '../utils/api';
import { calculateCounts, getByteCountColor } from '../utils/byteCount';
import { useAuthStore } from '../store';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface RecordEditorProps {
  record: RecordWithDetails;
  onClose: () => void;
}

export default function RecordEditor({ record, onClose }: RecordEditorProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState(record.content || '');
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<RecordVersion[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const lockIntervalRef = useRef<NodeJS.Timeout>();
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const canEdit = isTeacherOrAdmin || record.is_editable_by_student;

  useEffect(() => {
    loadData();
    return () => {
      if (lockIntervalRef.current) {
        clearInterval(lockIntervalRef.current);
      }
      if (isLocked) {
        recordApi.unlock(record.id).catch(console.error);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [commentsData, versionsData] = await Promise.all([
        recordApi.getComments(record.id),
        recordApi.getVersions(record.id),
      ]);
      setComments(commentsData);
      setVersions(versionsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleAcquireLock = async () => {
    if (!canEdit) {
      setError('편집 권한이 없습니다.');
      return;
    }

    try {
      await recordApi.lock(record.id);
      setIsLocked(true);
      setError('');
      
      // Extend lock every 25 minutes
      lockIntervalRef.current = setInterval(async () => {
        try {
          await recordApi.extendLock(record.id);
        } catch (err) {
          console.error('Failed to extend lock:', err);
          setIsLocked(false);
          if (lockIntervalRef.current) {
            clearInterval(lockIntervalRef.current);
          }
        }
      }, 25 * 60 * 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || '편집 잠금을 획득하지 못했습니다.');
    }
  };

  const handleSave = async () => {
    if (!isLocked) {
      setError('편집 잠금이 필요합니다.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await recordApi.update(record.id, { content });
      setSuccess('저장되었습니다.');
      setIsLocked(false);
      
      if (lockIntervalRef.current) {
        clearInterval(lockIntervalRef.current);
      }
      
      // Reload versions
      const versionsData = await recordApi.getVersions(record.id);
      setVersions(versionsData);
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const comment = await recordApi.addComment(record.id, newComment);
      setComments([comment, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const { charCount, byteCount } = calculateCounts(content);
  const byteColorClass = getByteCountColor(byteCount);

  // Render content with LaTeX
  const renderContent = (text: string) => {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Match display math: $$...$$
    const displayMathRegex = /\$\$(.*?)\$\$/g;
    // Match inline math: $...$
    const inlineMathRegex = /\$(.*?)\$/g;

    let match;
    const content = text;

    // First, find all display math blocks
    const displayMatches: Array<{ start: number; end: number; content: string }> = [];
    while ((match = displayMathRegex.exec(content)) !== null) {
      displayMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Then process the text
    let currentIndex = 0;
    for (const displayMatch of displayMatches) {
      // Add text before display math
      if (currentIndex < displayMatch.start) {
        const textBefore = content.substring(currentIndex, displayMatch.start);
        parts.push(...renderTextWithInlineMath(textBefore, parts.length));
      }

      // Add display math
      parts.push(
        <div key={parts.length} className="my-2">
          <BlockMath math={displayMatch.content} />
        </div>
      );

      currentIndex = displayMatch.end;
    }

    // Add remaining text
    if (currentIndex < content.length) {
      const remainingText = content.substring(currentIndex);
      parts.push(...renderTextWithInlineMath(remainingText, parts.length));
    }

    return parts;
  };

  const renderTextWithInlineMath = (text: string, startKey: number) => {
    const parts: React.ReactNode[] = [];
    const inlineMathRegex = /\$(.*?)\$/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineMathRegex.exec(text)) !== null) {
      // Add text before inline math
      if (match.index > lastIndex) {
        parts.push(
          <span key={startKey + parts.length}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Add inline math
      parts.push(
        <InlineMath key={startKey + parts.length} math={match[1]} />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={startKey + parts.length}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                학생 기록 {isLocked && '(편집 중)'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {record.student_name} - {record.subject_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          {error && <div className="alert-error mb-4">{error}</div>}
          {success && <div className="alert-success mb-4">{success}</div>}

          {/* Stats */}
          <div className="flex gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-600">글자수:</span>
              <span className="ml-2 font-mono font-semibold">
                {charCount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">바이트:</span>
              <span className={`ml-2 font-mono font-semibold ${byteColorClass}`}>
                {byteCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {canEdit && !isLocked && (
              <button
                onClick={handleAcquireLock}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              >
                편집 시작
              </button>
            )}
            
            {isLocked && (
              <>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {previewMode ? '편집 모드' : '미리보기'}
                </button>
              </>
            )}
            
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              수정 이력 ({versions.length})
            </button>
            
            <button
              onClick={() => setShowComments(!showComments)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              댓글 ({comments.length})
            </button>
          </div>

          {/* Editor / Preview */}
          {previewMode ? (
            <div className="prose max-w-none p-4 border border-gray-300 rounded-md bg-gray-50 min-h-[300px]">
              {renderContent(content)}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!isLocked}
              className="record-textarea w-full"
              style={{ minHeight: '300px' }}
              placeholder="내용을 입력하세요. LaTeX 수식은 $수식$ (인라인) 또는 $$수식$$ (블록)으로 입력할 수 있습니다."
            />
          )}

          <div className="text-xs text-gray-500 mt-2">
            <p>💡 수식 입력: $x^2$ (인라인) 또는 $$\frac{"{"}a{"}"}{"{"} b{"}"}$$ (블록)</p>
          </div>

          {/* Versions */}
          {showVersions && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">수정 이력</h3>
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {versions.map((version) => (
                  <div key={version.id} className="bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold">{version.edited_by}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {new Date(version.created_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {version.edit_type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {version.content?.substring(0, 200)}
                      {version.content && version.content.length > 200 ? '...' : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {version.char_count} 글자, {version.byte_count} 바이트
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {showComments && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">댓글</h3>
              
              {/* Add Comment */}
              <div className="mb-4">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
                <button
                  onClick={handleAddComment}
                  className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  댓글 추가
                </button>
              </div>

              {/* Comments List */}
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold">{comment.user_id}</span>
                      <span className="text-sm text-gray-600">
                        {new Date(comment.created_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {comment.comment_text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
