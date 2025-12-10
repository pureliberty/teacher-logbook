"""
공유 Dependency 모듈
- 순환 import 방지
- 코드 중복 제거
- 모든 라우터에서 공통으로 사용
"""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from jose import JWTError, jwt

# ==================== 환경 설정 ====================
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable not set")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# ==================== 데이터베이스 ====================
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ==================== OAuth2 ====================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# ==================== Dependency 함수 ====================
def get_db():
    """DB 세션 Dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    """현재 사용자 인증 Dependency"""
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
    except JWTError:
        raise credentials_exception
    
    user = db.execute(
        text("SELECT * FROM users WHERE user_id = :user_id"),
        {"user_id": user_id}
    ).fetchone()
    
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user = Depends(get_current_user)):
    """관리자 권한 확인 Dependency"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_teacher_or_admin(current_user = Depends(get_current_user)):
    """교사 또는 관리자 권한 확인 Dependency"""
    if current_user.role not in ['teacher', 'admin']:
        raise HTTPException(status_code=403, detail="Teacher or admin access required")
    return current_user