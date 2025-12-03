// =====================================================
// 학생 정렬 유틸리티
// =====================================================

import type { StudentInfo } from '../types';

/**
 * 학생 목록을 학번순으로 정렬
 * 학년 → 학급 → 번호 오름차순
 */
export function sortStudentsByNumber<T extends Pick<StudentInfo, 'grade' | 'class_number' | 'number_in_class'>>(
  students: T[]
): T[] {
  return [...students].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.class_number !== b.class_number) return a.class_number - b.class_number;
    return a.number_in_class - b.number_in_class;
  });
}

/**
 * 학번 문자열 생성
 * 예: 1학년 2반 5번 → "10205"
 */
export function formatStudentNumber(
  grade: number,
  classNumber: number,
  numberInClass: number
): string {
  return `${grade}${String(classNumber).padStart(2, '0')}${String(numberInClass).padStart(2, '0')}`;
}