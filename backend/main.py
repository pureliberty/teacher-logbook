from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from openpyxl import Workbook, load_workbook
from io import BytesIO
import redis
import os
import re
import bcrypt

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://logbook_user:logbook_pass_2025@postgres:5432/teacher_logbook")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis setup
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# FastAPI app
app = FastAPI(title="Teacher Logbook API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    role: str
    full_name: Optional[str]


class TokenData(BaseModel):
    user_id: Optional[str] = None


class UserBase(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    role: str


class UserCreate(BaseModel):
    user_id: str
    password: str
    full_name: Optional[str] = None
    role: str
    grade: Optional[int] = None
    class_number: Optional[int] = None
    number_in_class: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None


class User(UserBase):
    id: int
    grade: Optional[int] = None
    class_number: Optional[int] = None
    number_in_class: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SubjectCreate(BaseModel):
    subject_name: str
    subject_code: str
    description: Optional[str] = None


class Subject(BaseModel):
    id: int
    subject_name: str
    subject_code: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RecordCreate(BaseModel):
    student_user_id: str
    subject_id: int
    content: str


class RecordUpdate(BaseModel):
    content: str


class Record(BaseModel):
    id: int
    student_user_id: str
    subject_id: int
    content: Optional[str] = None
    char_count: int
    byte_count: int
    is_editable_by_student: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecordWithDetails(Record):
    student_name: Optional[str] = None
    subject_name: Optional[str] = None
    is_locked: bool = False
    locked_by: Optional[str] = None


class CommentCreate(BaseModel):
    record_id: int
    comment_text: str


class Comment(BaseModel):
    id: int
    record_id: int
    user_id: str
    comment_text: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecordVersion(BaseModel):
    id: int
    record_id: int
    content: Optional[str]
    char_count: int
    byte_count: int
    edited_by: str
    edit_type: str
    created_at: datetime

    class Config:
        from_attributes = True


# Utility functions
def calculate_byte_count(text: str) -> tuple[int, int]:
    """
    Calculate character count and byte count.
    Byte count = (Korean chars * 3) + (Other chars * 1) + (Newlines * 2)
    """
    if not text:
        return 0, 0
    
    char_count = len(text)
    korean_count = len(re.findall(r'[가-힣]', text))
    newline_count = text.count('\n')
    other_count = char_count - korean_count - newline_count
    
    byte_count = (korean_count * 3) + other_count + (newline_count * 2)
    
    return char_count, byte_count


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Auth dependency
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception
    
    user = db.execute(
        "SELECT * FROM users WHERE user_id = :user_id",
        {"user_id": token_data.user_id}
    ).fetchone()
    
    if user is None:
        raise credentials_exception
    return user


# Lock management functions
def acquire_lock(record_id: int, user_id: str, duration_minutes: int = 30) -> bool:
    """Acquire edit lock for a record"""
    lock_key = f"record_lock:{record_id}"
    
    # Check if already locked
    existing_lock = redis_client.get(lock_key)
    if existing_lock and existing_lock != user_id:
        return False
    
    # Set lock with expiration
    redis_client.setex(lock_key, duration_minutes * 60, user_id)
    return True


def release_lock(record_id: int, user_id: str) -> bool:
    """Release edit lock for a record"""
    lock_key = f"record_lock:{record_id}"
    
    # Only release if current user owns the lock
    current_lock = redis_client.get(lock_key)
    if current_lock == user_id:
        redis_client.delete(lock_key)
        return True
    return False


def get_lock_owner(record_id: int) -> Optional[str]:
    """Get the current lock owner for a record"""
    lock_key = f"record_lock:{record_id}"
    return redis_client.get(lock_key)


def extend_lock(record_id: int, user_id: str, duration_minutes: int = 30) -> bool:
    """Extend lock duration"""
    lock_key = f"record_lock:{record_id}"
    current_lock = redis_client.get(lock_key)
    
    if current_lock == user_id:
        redis_client.expire(lock_key, duration_minutes * 60)
        return True
    return False


# API Routes

@app.get("/")
async def root():
    return {"message": "Teacher Logbook API", "version": "1.0.0"}


@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Query user
    user = db.execute(
        "SELECT * FROM users WHERE user_id = :user_id",
        {"user_id": form_data.username}
    ).fetchone()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.user_id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.user_id,
        "role": user.role,
        "full_name": user.full_name
    }


@app.get("/users/me", response_model=User)
async def read_users_me(current_user = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "grade": current_user.grade,
        "class_number": current_user.class_number,
        "number_in_class": current_user.number_in_class,
        "created_at": current_user.created_at
    }


@app.put("/users/me", response_model=User)
async def update_user_me(
    user_update: UserUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    update_data = {}
    if user_update.full_name:
        update_data["full_name"] = user_update.full_name
    if user_update.password:
        update_data["password_hash"] = get_password_hash(user_update.password)
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        # Build UPDATE query dynamically
        set_clause = ", ".join([f"{k} = :{k}" for k in update_data.keys()])
        query = f"UPDATE users SET {set_clause} WHERE user_id = :user_id RETURNING *"
        update_data["user_id"] = current_user.user_id
        
        result = db.execute(query, update_data)
        db.commit()
        updated_user = result.fetchone()
        
        return {
            "id": updated_user.id,
            "user_id": updated_user.user_id,
            "full_name": updated_user.full_name,
            "role": updated_user.role,
            "grade": updated_user.grade,
            "class_number": updated_user.class_number,
            "number_in_class": updated_user.number_in_class,
            "created_at": updated_user.created_at
        }
    
    return current_user


@app.get("/subjects", response_model=List[Subject])
async def get_subjects(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = db.execute("SELECT * FROM subjects ORDER BY subject_name")
    subjects = result.fetchall()
    return [
        {
            "id": s.id,
            "subject_name": s.subject_name,
            "subject_code": s.subject_code,
            "description": s.description
        }
        for s in subjects
    ]


@app.post("/subjects", response_model=Subject)
async def create_subject(
    subject: SubjectCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only admin can create subjects
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admin can create subjects")
    
    try:
        result = db.execute(
            """
            INSERT INTO subjects (subject_name, subject_code, description)
            VALUES (:subject_name, :subject_code, :description)
            RETURNING *
            """,
            {
                "subject_name": subject.subject_name,
                "subject_code": subject.subject_code,
                "description": subject.description
            }
        )
        db.commit()
        new_subject = result.fetchone()
        
        return {
            "id": new_subject.id,
            "subject_name": new_subject.subject_name,
            "subject_code": new_subject.subject_code,
            "description": new_subject.description
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# Continue in next file...
# This file continues from main.py - append these routes to main.py

@app.get("/records", response_model=List[RecordWithDetails])
async def get_records(
    student_user_id: Optional[str] = None,
    subject_id: Optional[int] = None,
    grade: Optional[int] = None,
    class_number: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get records with filtering"""
    
    # Students can only view their own records
    if current_user.role == 'student':
        student_user_id = current_user.user_id
    
    # Build query
    query = """
        SELECT r.*, u.full_name as student_name, s.subject_name
        FROM records r
        LEFT JOIN users u ON r.student_user_id = u.user_id
        LEFT JOIN subjects s ON r.subject_id = s.id
        WHERE 1=1
    """
    params = {}
    
    if student_user_id:
        query += " AND r.student_user_id = :student_user_id"
        params["student_user_id"] = student_user_id
    
    if subject_id:
        query += " AND r.subject_id = :subject_id"
        params["subject_id"] = subject_id
    
    if grade:
        query += " AND u.grade = :grade"
        params["grade"] = grade
    
    if class_number:
        query += " AND u.class_number = :class_number"
        params["class_number"] = class_number
    
    query += " ORDER BY u.grade, u.class_number, u.number_in_class, s.subject_name"
    
    result = db.execute(query, params)
    records = result.fetchall()
    
    # Check lock status for each record
    records_with_lock = []
    for r in records:
        lock_owner = get_lock_owner(r.id)
        records_with_lock.append({
            "id": r.id,
            "student_user_id": r.student_user_id,
            "subject_id": r.subject_id,
            "content": r.content,
            "char_count": r.char_count,
            "byte_count": r.byte_count,
            "is_editable_by_student": r.is_editable_by_student,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "student_name": r.student_name,
            "subject_name": r.subject_name,
            "is_locked": lock_owner is not None,
            "locked_by": lock_owner
        })
    
    return records_with_lock


@app.get("/records/{record_id}", response_model=RecordWithDetails)
async def get_record(
    record_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific record"""
    
    result = db.execute(
        """
        SELECT r.*, u.full_name as student_name, s.subject_name
        FROM records r
        LEFT JOIN users u ON r.student_user_id = u.user_id
        LEFT JOIN subjects s ON r.subject_id = s.id
        WHERE r.id = :record_id
        """,
        {"record_id": record_id}
    )
    record = result.fetchone()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Students can only view their own records
    if current_user.role == 'student' and record.student_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    lock_owner = get_lock_owner(record.id)
    
    return {
        "id": record.id,
        "student_user_id": record.student_user_id,
        "subject_id": record.subject_id,
        "content": record.content,
        "char_count": record.char_count,
        "byte_count": record.byte_count,
        "is_editable_by_student": record.is_editable_by_student,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "student_name": record.student_name,
        "subject_name": record.subject_name,
        "is_locked": lock_owner is not None,
        "locked_by": lock_owner
    }


@app.post("/records", response_model=Record)
async def create_record(
    record: RecordCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new record"""
    
    # Only teachers and admin can create records
    if current_user.role == 'student':
        raise HTTPException(status_code=403, detail="Students cannot create records")
    
    # Calculate counts
    char_count, byte_count = calculate_byte_count(record.content)
    
    try:
        result = db.execute(
            """
            INSERT INTO records (student_user_id, subject_id, content, char_count, byte_count)
            VALUES (:student_user_id, :subject_id, :content, :char_count, :byte_count)
            RETURNING *
            """,
            {
                "student_user_id": record.student_user_id,
                "subject_id": record.subject_id,
                "content": record.content,
                "char_count": char_count,
                "byte_count": byte_count
            }
        )
        db.commit()
        new_record = result.fetchone()
        
        # Create version history
        db.execute(
            """
            INSERT INTO record_versions (record_id, content, char_count, byte_count, edited_by, edit_type)
            VALUES (:record_id, :content, :char_count, :byte_count, :edited_by, :edit_type)
            """,
            {
                "record_id": new_record.id,
                "content": record.content,
                "char_count": char_count,
                "byte_count": byte_count,
                "edited_by": current_user.user_id,
                "edit_type": "create"
            }
        )
        db.commit()
        
        return {
            "id": new_record.id,
            "student_user_id": new_record.student_user_id,
            "subject_id": new_record.subject_id,
            "content": new_record.content,
            "char_count": new_record.char_count,
            "byte_count": new_record.byte_count,
            "is_editable_by_student": new_record.is_editable_by_student,
            "created_at": new_record.created_at,
            "updated_at": new_record.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/records/{record_id}/lock")
async def lock_record(
    record_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Acquire lock for editing a record"""
    
    # Check if record exists
    result = db.execute("SELECT * FROM records WHERE id = :id", {"id": record_id})
    record = result.fetchone()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Check permissions
    if current_user.role == 'student':
        if record.student_user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if not record.is_editable_by_student:
            raise HTTPException(status_code=403, detail="Record not editable by student")
    
    # Try to acquire lock
    if acquire_lock(record_id, current_user.user_id):
        return {"message": "Lock acquired", "locked_by": current_user.user_id}
    else:
        lock_owner = get_lock_owner(record_id)
        raise HTTPException(
            status_code=423,
            detail=f"Record is locked by {lock_owner}"
        )


@app.delete("/records/{record_id}/lock")
async def unlock_record(
    record_id: int,
    current_user = Depends(get_current_user)
):
    """Release lock on a record"""
    
    if release_lock(record_id, current_user.user_id):
        return {"message": "Lock released"}
    else:
        raise HTTPException(status_code=400, detail="You don't own this lock")


@app.put("/records/{record_id}/lock/extend")
async def extend_record_lock(
    record_id: int,
    current_user = Depends(get_current_user)
):
    """Extend lock duration"""
    
    if extend_lock(record_id, current_user.user_id):
        return {"message": "Lock extended"}
    else:
        raise HTTPException(status_code=400, detail="You don't own this lock")


@app.put("/records/{record_id}", response_model=Record)
async def update_record(
    record_id: int,
    record_update: RecordUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a record"""
    
    # Check if record exists
    result = db.execute("SELECT * FROM records WHERE id = :id", {"id": record_id})
    record = result.fetchone()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Check permissions
    if current_user.role == 'student':
        if record.student_user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if not record.is_editable_by_student:
            raise HTTPException(status_code=403, detail="Record not editable by student")
    
    # Check lock
    lock_owner = get_lock_owner(record_id)
    if lock_owner and lock_owner != current_user.user_id:
        raise HTTPException(status_code=423, detail=f"Record is locked by {lock_owner}")
    
    # Calculate counts
    char_count, byte_count = calculate_byte_count(record_update.content)
    
    try:
        # Update record
        result = db.execute(
            """
            UPDATE records
            SET content = :content, char_count = :char_count, byte_count = :byte_count,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
            RETURNING *
            """,
            {
                "id": record_id,
                "content": record_update.content,
                "char_count": char_count,
                "byte_count": byte_count
            }
        )
        db.commit()
        updated_record = result.fetchone()
        
        # Create version history
        db.execute(
            """
            INSERT INTO record_versions (record_id, content, char_count, byte_count, edited_by, edit_type)
            VALUES (:record_id, :content, :char_count, :byte_count, :edited_by, :edit_type)
            """,
            {
                "record_id": record_id,
                "content": record_update.content,
                "char_count": char_count,
                "byte_count": byte_count,
                "edited_by": current_user.user_id,
                "edit_type": "update"
            }
        )
        db.commit()
        
        # Release lock
        release_lock(record_id, current_user.user_id)
        
        return {
            "id": updated_record.id,
            "student_user_id": updated_record.student_user_id,
            "subject_id": updated_record.subject_id,
            "content": updated_record.content,
            "char_count": updated_record.char_count,
            "byte_count": updated_record.byte_count,
            "is_editable_by_student": updated_record.is_editable_by_student,
            "created_at": updated_record.created_at,
            "updated_at": updated_record.updated_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/records/{record_id}/permissions")
async def update_record_permissions(
    record_id: int,
    is_editable: bool,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update student edit permissions for a record"""
    
    # Only teachers and admin can change permissions
    if current_user.role == 'student':
        raise HTTPException(status_code=403, detail="Students cannot change permissions")
    
    try:
        db.execute(
            """
            UPDATE records
            SET is_editable_by_student = :is_editable, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
            """,
            {"id": record_id, "is_editable": is_editable}
        )
        db.commit()
        
        return {"message": "Permissions updated", "is_editable_by_student": is_editable}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/records/{record_id}/versions", response_model=List[RecordVersion])
async def get_record_versions(
    record_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get version history for a record"""
    
    # Check if record exists
    result = db.execute("SELECT * FROM records WHERE id = :id", {"id": record_id})
    record = result.fetchone()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Students can only view versions of their own records
    if current_user.role == 'student' and record.student_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = db.execute(
        """
        SELECT * FROM record_versions
        WHERE record_id = :record_id
        ORDER BY created_at DESC
        """,
        {"record_id": record_id}
    )
    versions = result.fetchall()
    
    return [
        {
            "id": v.id,
            "record_id": v.record_id,
            "content": v.content,
            "char_count": v.char_count,
            "byte_count": v.byte_count,
            "edited_by": v.edited_by,
            "edit_type": v.edit_type,
            "created_at": v.created_at
        }
        for v in versions
    ]


@app.get("/records/{record_id}/comments", response_model=List[Comment])
async def get_record_comments(
    record_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comments for a record"""
    
    # Check if record exists
    result = db.execute("SELECT * FROM records WHERE id = :id", {"id": record_id})
    record = result.fetchone()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Students can only view comments on their own records
    if current_user.role == 'student' and record.student_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = db.execute(
        """
        SELECT * FROM comments
        WHERE record_id = :record_id
        ORDER BY created_at DESC
        """,
        {"record_id": record_id}
    )
    comments = result.fetchall()
    
    return [
        {
            "id": c.id,
            "record_id": c.record_id,
            "user_id": c.user_id,
            "comment_text": c.comment_text,
            "created_at": c.created_at
        }
        for c in comments
    ]


@app.post("/records/{record_id}/comments", response_model=Comment)
async def create_comment(
    record_id: int,
    comment: CommentCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a comment to a record"""
    
    # Check if record exists
    result = db.execute("SELECT * FROM records WHERE id = :id", {"id": record_id})
    record = result.fetchone()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Students can only comment on their own records
    if current_user.role == 'student' and record.student_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        result = db.execute(
            """
            INSERT INTO comments (record_id, user_id, comment_text)
            VALUES (:record_id, :user_id, :comment_text)
            RETURNING *
            """,
            {
                "record_id": record_id,
                "user_id": current_user.user_id,
                "comment_text": comment.comment_text
            }
        )
        db.commit()
        new_comment = result.fetchone()
        
        return {
            "id": new_comment.id,
            "record_id": new_comment.record_id,
            "user_id": new_comment.user_id,
            "comment_text": new_comment.comment_text,
            "created_at": new_comment.created_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# Admin routes
@app.get("/admin/users", response_model=List[User])
async def get_all_users(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all users (admin only)"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = db.execute("SELECT * FROM users ORDER BY user_id")
    users = result.fetchall()
    
    return [
        {
            "id": u.id,
            "user_id": u.user_id,
            "full_name": u.full_name,
            "role": u.role,
            "grade": u.grade,
            "class_number": u.class_number,
            "number_in_class": u.number_in_class,
            "created_at": u.created_at
        }
        for u in users
    ]


@app.post("/admin/users", response_model=User)
async def create_user(
    user: UserCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        password_hash = get_password_hash(user.password)
        
        result = db.execute(
            """
            INSERT INTO users (user_id, password_hash, full_name, role, grade, class_number, number_in_class)
            VALUES (:user_id, :password_hash, :full_name, :role, :grade, :class_number, :number_in_class)
            RETURNING *
            """,
            {
                "user_id": user.user_id,
                "password_hash": password_hash,
                "full_name": user.full_name,
                "role": user.role,
                "grade": user.grade,
                "class_number": user.class_number,
                "number_in_class": user.number_in_class
            }
        )
        db.commit()
        new_user = result.fetchone()
        
        return {
            "id": new_user.id,
            "user_id": new_user.user_id,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "grade": new_user.grade,
            "class_number": new_user.class_number,
            "number_in_class": new_user.number_in_class,
            "created_at": new_user.created_at
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/admin/users/bulk-upload")
async def bulk_upload_users(
    users: List[UserCreate],
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk upload users (admin only)"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    created_count = 0
    errors = []
    
    for user in users:
        try:
            password_hash = get_password_hash(user.password)
            
            db.execute(
                """
                INSERT INTO users (user_id, password_hash, full_name, role, grade, class_number, number_in_class)
                VALUES (:user_id, :password_hash, :full_name, :role, :grade, :class_number, :number_in_class)
                """,
                {
                    "user_id": user.user_id,
                    "password_hash": password_hash,
                    "full_name": user.full_name,
                    "role": user.role,
                    "grade": user.grade,
                    "class_number": user.class_number,
                    "number_in_class": user.number_in_class
                }
            )
            db.commit()
            created_count += 1
        except Exception as e:
            db.rollback()
            errors.append({"user_id": user.user_id, "error": str(e)})
    
    return {
        "message": f"Created {created_count} users",
        "created_count": created_count,
        "errors": errors
    }

# =========================== 사용자 비밀번호 초기화 ============================
@app.put("/api/admin/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    new_password: str = Body(..., embed=True),
    current_user = dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reset a user's password (admin only)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access Only")
    
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 비밀번호 해시 생성
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    user.password_hash = hashed.decode('utf-8')
    
    db.commit()
    
    return {
        "message": f"Password reset for {user_id}"
    }

# =========================== Excel 템플릿 다운로드  ===========================
@app.get("/api/admin/download-template/{template_type}")
def download_excel_template(
    template_type: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access Only")
    
    wb = Workbook()
    
    if template_type == "users":
        ws = wb.active
        ws.title = "Users"
        
        # 헤더 작성
        headers = ["user_id", "password", "full_name", "role", "student_number", "grade", "class_number", "number_in_class"]
        ws.append(headers)
        
        # 예시 데이터 (교사)
        ws.append(["T0300", "1234!", "김선생", "teacher", "", "", "", ""])
        ws.append(["T0301", "1234!", "이선생", "teacher", "", "", "", ""])
        
        # 예시 데이터 (학생)
        ws.append(["S20201", "1234!", "홍길동", "student", "20201", "2", "2", "1"])
        ws.append(["S20202", "1234!", "김철수", "student", "20202", "2", "2", "2"])
        
        # 열 너비 조정
        ws.column_dimensions['A'].width = 15
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 10
        ws.column_dimensions['E'].width = 15
        ws.column_dimensions['F'].width = 8
        ws.column_dimensions['G'].width = 12
        ws.column_dimensions['H'].width = 15
    
    elif template_type == "subjects":
        ws = wb.active
        ws.title = "Subjects"
        
        # 헤더
        headers = ["subject_name", "subject_name", "description"]
        ws.append(headers)
        
        # 예시 데이터
        ws.append(["KOR", "국어", "국어 과목"])
        ws.append(["MATH", "수학", "수학 과목"])
        ws.append(["ENG", "영어", "영어 과목"])
        
        # 열 너비 조정
        ws.column_dimensions['A'].width = 15
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['C'].width = 30
        
    else:
        raise HTTPException(status_code=400, detail="Invalid template type")
    
    # 메모리에 저장
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"{template_type}_template.xlsx"
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    
# =========================== Excel 파일  업로드 및 임포트  ===========================
@app.post("/api/admin/import-excel/{import_type}")
async def import_excel(
    import_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access Only")
    
    # 엑셀 파일 읽기
    contents = await file.read()
    wb = load_workbook(BytesIO(contents))
    ws = wb.active
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": []
    }

    if import_type == "users":
        # 헤더 건너뛰기
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        
        for idx, row in enumerate(rows, start=2):
            try:
                user_id, password, full_name, role, student_number, grade, class_number, number_in_class = row
            
                # 필수 필드 검증
                if not user_id or not password or not role:
                    results["errors"].append(f"Row {idx}: Missing required fields")
                    results["failed"] += 1
                    continue

                # 역할 검증
                if role not in ["admin", "teacher", "student"]:
                    results["errors"].append(f"Row {idx}: Invalid role '{role}'")
                    results["failed"] += 1
                    continue
                
                # 학생인 경우 추가 필드 검증
                if role == "student":
                    if not student_number or not grade or not class_number or not number_in_class:
                        results["errors"].append(f"Row {idx}: Students require student_number, grade, class_number, number_in_class")
                        results["failed"] += 1
                        continue
                
                # 기존 사용자 확인
                existing_user = db.query(User).filter(User.user_id == user_id).first()
                
                if existing_user:
                    # 업데이트
                    existing_user.full_name = full_name
                    if password: # 비밀번호 제공된 경우만 업데이트
                        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
                        existing_user.password_hash = hashed.decode('utf-8')
                    existing_user.role = role
                    existing_user.student_number = student_number
                    existing_user.grade = grade
                    existing_user.class_number = class_number
                    existing_user.number_in_class = number_in_class
                else:
                    # 새 사용자 생성
                    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
                    new_user = User(
                        user_id=user_id,
                        password_hash=hashed.decode('utf-8'),
                        full_name=full_name,
                        role=role,
                        student_number=student_number,
                        grade=grade,
                        class_number=class_number,
                        number_in_class=number_in_class
                    )
                    db.add(new_user)

                results["success"] += 1
            
            except Exception as e:
                results["errors"].append(f"Row {idx}: {str(e)}")
                results["failed"] += 1
        
        db.commit()
    
    elif import_tyope == "subjects":
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        
        for idx, row in enumerate(rows, start=2):
            try:
                subject_code, subject_name, description = row
                
                # 필수 필드 검증
                if not subject_code or not subject_name:
                    results["errors"].append(f"Row {idx}: Missing required fields")
                    results["failed"] += 1
                    continue
                
                # 기존 과목 확인
                existing_subject = db.query(Subject).filter(Subject.subject_code == subject_code).first()
                
                if existing_subject:
                    # 업데이트
                    existing_subject.subject_name = subject_name
                    existing_subject.description = description
                else:
                    # 새 과목 생성
                    new_subject = Subject(
                        subject_code=subject_code,
                        subject_name=subject_name,
                        description=description
                    )
                    db.add(new_subject)
                
                results["success"] += 1
            
            except Exception as e:
                results["errors"].append(f"Row {idx}: {str(e)}")
                results["failed"] += 1
            
        db.commit()
        
    else:
        raise HTTPException(status_code=400, detail="Invalid import type")
    
    return results

# =========================== 사용자 일괄 삭제  ===========================
@app.post("/api/admin/users/bulk-delete")
def bulk_delete_users(
    user_ids: List[str] = Body(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access Only")
    
    deleted_count = 0
    
    for user_id in user_ids:
            user = db.query(User).filter(User.user_id == user_id).first()
            if user:
                db.delete(user)
                deleted_count += 1
            
    db.commit()
    
    return {
        "message": f"{deleted_count} users deleted"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
