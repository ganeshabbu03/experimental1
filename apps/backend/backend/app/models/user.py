from sqlalchemy import Column, Integer, String, DateTime, Boolean # type: ignore
from sqlalchemy.orm import relationship # type: ignore
from datetime import datetime
from app.database import Base # type: ignore

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String, nullable=True) # Nullable for OAuth users
    name = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=True) # github, google, etc.
    provider_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
