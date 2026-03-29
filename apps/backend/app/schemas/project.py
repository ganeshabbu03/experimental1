from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None

class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    user_id: str
    name: str
    description: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str
    
    @field_validator('user_id', mode='before')
    @classmethod
    def validate_user_id(cls, v):
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True
