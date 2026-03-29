from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text # type: ignore
from sqlalchemy.orm import relationship # type: ignore
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database import Base # type: ignore
from app.models.file import File # type: ignore

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User", back_populates="projects")
    files = relationship("File", back_populates="project", cascade="all, delete-orphan")
