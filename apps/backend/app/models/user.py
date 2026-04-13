from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text # type: ignore
from sqlalchemy.orm import relationship # type: ignore
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base # type: ignore

class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True, 
        default=uuid.uuid4
    )
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String, nullable=True) # Nullable for OAuth users
    name = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=True) # github, google, etc.
    provider_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
