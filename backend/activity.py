import os
from fastapi import APIRouter, Header, HTTPException, status
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

# JWT 설정 (main.py와 동일하게 설정)
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


@router.post("/token/refresh")
async def refresh_token(authorization: str = Header(None)):
    """현재 유효한 토큰을 가진 사용자에게 새 토큰 발급"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split(" ")[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # 새 토큰 생성
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_payload = {
            "sub": user_id,
            "exp": expire,
            "role": payload.get("role"),
            "name": payload.get("name")
        }
        new_token = jwt.encode(new_payload, SECRET_KEY, algorithm=ALGORITHM)
        
        return {"access_token": new_token, "token_type": "bearer"}
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )