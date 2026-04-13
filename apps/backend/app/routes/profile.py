import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.auth import UserResponse
from supabase import create_client, Client

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
AVATAR_BUCKET = "avatars"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase storage is not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
        avatar_url=user.avatar_url,
    )

@router.get("/", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return _user_response(current_user)

@router.put("/", response_model=UserResponse)
def update_profile(
    name: str = None,
    avatar_url: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    if name:
        current_user.name = name
    if avatar_url is not None:
        current_user.avatar_url = avatar_url
    if name or avatar_url is not None:
        db.commit()
        db.refresh(current_user)

    return _user_response(current_user)

@router.post("/upload-avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an avatar image to Supabase Storage and persist the URL"""
    # Validate content type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: jpeg, png, webp, gif."
        )

    # Validate file size (2 MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 2 MB")

    supabase = get_supabase()

    # Build a deterministic path so re-uploads overwrite the previous avatar
    ext = (file.filename or "avatar").rsplit(".", 1)[-1].lower()
    storage_path = f"{current_user.id}/avatar.{ext}"

    try:
        # upsert=True overwrites an existing file at the same path
        supabase.storage.from_(AVATAR_BUCKET).upload(
            path=storage_path,
            file=contents,
            file_options={"content-type": file.content_type, "upsert": "true"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}")

    # Build the public URL
    public_url = supabase.storage.from_(AVATAR_BUCKET).get_public_url(storage_path)

    current_user.avatar_url = public_url
    db.commit()
    db.refresh(current_user)

    return _user_response(current_user)
