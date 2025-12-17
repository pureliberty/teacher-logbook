"""
과목-학급-학생 배정 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, Field

router = APIRouter()

# ==================== Pydantic Models ====================

class ClassInfo(BaseModel):
    grade: int = Field(..., ge=1, le=3)
    class_number: int = Field(..., ge=1)

class AssignClassesToSubjectRequest(BaseModel):
    subject_id: int
    classes: List[ClassInfo]
    school_year: Optional[int] = 2025

class AssignStudentsToSubjectRequest(BaseModel):
    subject_id: int
    student_ids: List[str]
    school_year: Optional[int] = 2025

class RemoveStudentsRequest(BaseModel):
    subject_id: int
    student_ids: List[str]
    school_year: Optional[int] = 2025

class RemoveClassRequest(BaseModel):
    subject_id: int
    grade: int
    class_number: int
    school_year: Optional[int] = 2025

class StudentInfo(BaseModel):
    user_id: str
    full_name: Optional[str]
    grade: Optional[int]
    class_number: Optional[int]
    number_in_class: Optional[int]
    assigned_type: Optional[str] = None

class PaginatedStudentsResponse(BaseModel):
    data: List[StudentInfo]
    total_count: int
    page: int
    page_size: int
    total_pages: int


from dependencies import get_db, get_current_user


# ==================== API 엔드포인트 ====================

@router.post("/classes-to-subject")
async def assign_classes_to_subject(
    request: AssignClassesToSubjectRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목에 학급 배정 (해당 학급 학생 자동 배정)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    school_year = request.school_year or 2025
    assigned_classes = 0
    assigned_students = 0
    
    try:
        for cls in request.classes:
            # 1. 학급 배정
            db.execute(
                text("""
                    INSERT INTO subject_class_assignments 
                    (subject_id, grade, class_number, school_year, created_by)
                    VALUES (:subject_id, :grade, :class_number, :school_year, :created_by)
                    ON CONFLICT (subject_id, grade, class_number, school_year) DO NOTHING
                """),
                {
                    "subject_id": request.subject_id,
                    "grade": cls.grade,
                    "class_number": cls.class_number,
                    "school_year": school_year,
                    "created_by": current_user.user_id
                }
            )
            assigned_classes += 1
            
            # 2. 해당 학급 학생들 조회
            students = db.execute(
                text("""
                    SELECT user_id FROM users 
                    WHERE role = 'student' 
                    AND grade = :grade 
                    AND class_number = :class_number
                """),
                {"grade": cls.grade, "class_number": cls.class_number}
            ).fetchall()
            
            # 3. 학생들 배정
            for student in students:
                db.execute(
                    text("""
                        INSERT INTO subject_student_assignments 
                        (subject_id, student_user_id, school_year, assigned_type, created_by)
                        VALUES (:subject_id, :student_user_id, :school_year, 'class', :created_by)
                        ON CONFLICT (subject_id, student_user_id, school_year) DO NOTHING
                    """),
                    {
                        "subject_id": request.subject_id,
                        "student_user_id": student.user_id,
                        "school_year": school_year,
                        "created_by": current_user.user_id
                    }
                )
                assigned_students += 1
        
        db.commit()
        return {
            "success": True,
            "message": f"{assigned_classes}개 학급, {assigned_students}명 학생 배정 완료",
            "assigned_classes": assigned_classes,
            "assigned_students": assigned_students
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/students-to-subject")
async def assign_students_to_subject(
    request: AssignStudentsToSubjectRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목에 학생 개별 배정"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    school_year = request.school_year or 2025
    assigned_count = 0
    
    try:
        for student_id in request.student_ids:
            db.execute(
                text("""
                    INSERT INTO subject_student_assignments 
                    (subject_id, student_user_id, school_year, assigned_type, created_by)
                    VALUES (:subject_id, :student_user_id, :school_year, 'individual', :created_by)
                    ON CONFLICT (subject_id, student_user_id, school_year) DO NOTHING
                """),
                {
                    "subject_id": request.subject_id,
                    "student_user_id": student_id,
                    "school_year": school_year,
                    "created_by": current_user.user_id
                }
            )
            assigned_count += 1
        
        db.commit()
        return {
            "success": True,
            "message": f"{assigned_count}명 학생 배정 완료",
            "assigned_count": assigned_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remove-students")
async def remove_students_from_subject(
    request: RemoveStudentsRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목에서 학생 제외"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    school_year = request.school_year or 2025
    removed_count = 0
    
    try:
        for student_id in request.student_ids:
            result = db.execute(
                text("""
                    DELETE FROM subject_student_assignments 
                    WHERE subject_id = :subject_id 
                    AND student_user_id = :student_user_id 
                    AND school_year = :school_year
                """),
                {
                    "subject_id": request.subject_id,
                    "student_user_id": student_id,
                    "school_year": school_year
                }
            )
            removed_count += result.rowcount
        
        db.commit()
        return {
            "success": True,
            "message": f"{removed_count}명 학생 제외 완료",
            "removed_count": removed_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remove-class")
async def remove_class_from_subject(
    request: RemoveClassRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목에서 학급 제외 (학급 배정된 학생도 제외)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    school_year = request.school_year or 2025
    
    try:
        # 1. 학급 배정 삭제
        db.execute(
            text("""
                DELETE FROM subject_class_assignments 
                WHERE subject_id = :subject_id 
                AND grade = :grade 
                AND class_number = :class_number 
                AND school_year = :school_year
            """),
            {
                "subject_id": request.subject_id,
                "grade": request.grade,
                "class_number": request.class_number,
                "school_year": school_year
            }
        )
        
        # 2. 해당 학급 학생들 조회
        students = db.execute(
            text("""
                SELECT user_id FROM users 
                WHERE role = 'student' 
                AND grade = :grade 
                AND class_number = :class_number
            """),
            {"grade": request.grade, "class_number": request.class_number}
        ).fetchall()
        
        # 3. 학급 배정 타입인 학생만 제외
        removed_students = 0
        for student in students:
            result = db.execute(
                text("""
                    DELETE FROM subject_student_assignments 
                    WHERE subject_id = :subject_id 
                    AND student_user_id = :student_user_id 
                    AND school_year = :school_year 
                    AND assigned_type = 'class'
                """),
                {
                    "subject_id": request.subject_id,
                    "student_user_id": student.user_id,
                    "school_year": school_year
                }
            )
            removed_students += result.rowcount
        
        db.commit()
        return {
            "success": True,
            "message": f"학급 제외 완료, {removed_students}명 학생 제외",
            "removed_students": removed_students
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subject/{subject_id}/students")
async def get_students_by_subject(
    subject_id: int,
    school_year: Optional[int] = 2025,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목에 배정된 학생 목록 (학번순 정렬)"""
    
    # 전체 개수
    count_result = db.execute(
        text("""
            SELECT COUNT(*) FROM subject_student_assignments 
            WHERE subject_id = :subject_id AND school_year = :school_year
        """),
        {"subject_id": subject_id, "school_year": school_year}
    ).scalar()
    
    # 데이터 조회 (학번순 정렬)
    result = db.execute(
        text("""
            SELECT 
                u.user_id, u.full_name, u.grade, u.class_number, u.number_in_class,
                ssa.assigned_type
            FROM subject_student_assignments ssa
            JOIN users u ON ssa.student_user_id = u.user_id
            WHERE ssa.subject_id = :subject_id 
            AND ssa.school_year = :school_year
            ORDER BY u.grade, u.class_number, u.number_in_class
            LIMIT :limit OFFSET :offset
        """),
        {
            "subject_id": subject_id,
            "school_year": school_year,
            "limit": page_size,
            "offset": (page - 1) * page_size
        }
    ).fetchall()
    
    students = [
        {
            "user_id": row.user_id,
            "full_name": row.full_name,
            "grade": row.grade,
            "class_number": row.class_number,
            "number_in_class": row.number_in_class,
            "assigned_type": row.assigned_type
        }
        for row in result
    ]
    
    total_pages = (count_result + page_size - 1) // page_size if count_result else 0
    
    return {
        "data": students,
        "total_count": count_result or 0,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/subject/{subject_id}/classes")
async def get_classes_by_subject(
    subject_id: int,
    school_year: Optional[int] = 2025,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목에 배정된 학급 목록"""
    
    result = db.execute(
        text("""
            SELECT * FROM subject_class_assignments 
            WHERE subject_id = :subject_id AND school_year = :school_year
            ORDER BY grade, class_number
        """),
        {"subject_id": subject_id, "school_year": school_year}
    ).fetchall()
    
    return {
        "success": True,
        "data": [dict(row._mapping) for row in result]
    }


@router.get("/students")
async def get_all_students(
    grade: Optional[int] = None,
    class_number: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """전체 학생 목록 (배정 선택용)"""
    
    query = """
        SELECT user_id, full_name, grade, class_number, number_in_class 
        FROM users 
        WHERE role = 'student'
    """
    params = {}
    
    if grade:
        query += " AND grade = :grade"
        params["grade"] = grade
    if class_number:
        query += " AND class_number = :class_number"
        params["class_number"] = class_number
    
    query += " ORDER BY grade, class_number, number_in_class"
    
    result = db.execute(text(query), params).fetchall()
    
    return {
        "success": True,
        "data": [dict(row._mapping) for row in result]
    }