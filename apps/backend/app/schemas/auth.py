from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

# Simple email validation regex
EMAIL_REGEX = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_active: bool
    created_at: str
    
    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class LogoutResponse(BaseModel):
    success: bool
    message: str
