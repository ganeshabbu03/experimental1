from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import String, cast
from sqlalchemy.exc import IntegrityError
from app.database import SessionLocal
from app.models.user import User
from app.models.project import Project
from app.models.file import File
from app.routes.auth import get_current_user
from app.schemas.project import ProjectCreateRequest, ProjectUpdateRequest, ProjectResponse
from app.schemas.file import FileCreateRequest, FileUpdateRequest, FileResponse, FileTreeResponse

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _file_project_filter(project_id: int):
    # Some older deployed databases store files.project_id as text instead of integer.
    return cast(File.project_id, String) == str(project_id)


def _file_parent_filter(parent_id: int | None):
    if parent_id is None:
        return File.parent_id.is_(None)
    return cast(File.parent_id, String) == str(parent_id)


def _serialize_file(file: File) -> FileResponse:
    return FileResponse(
        id=int(file.id),
        project_id=int(file.project_id),
        parent_id=int(file.parent_id) if file.parent_id is not None else None,
        name=file.name,
        file_type=file.file_type,
        content=file.content,
        is_active=file.is_active,
        created_at=file.created_at.isoformat(),
        updated_at=file.updated_at.isoformat()
    )


def _next_legacy_file_id(db: Session) -> int:
    # Legacy databases may store `files.id` as TEXT without auto-generation.
    # Pick the next numeric id that can be safely cast to int in API responses.
    max_id = 0
    for (raw_id,) in db.query(File.id).all():
        try:
            parsed = int(raw_id)
        except (TypeError, ValueError):
            continue
        if parsed > max_id:
            max_id = parsed
    return max_id + 1


def _is_missing_files_id_error(exc: IntegrityError) -> bool:
    message = str(getattr(exc, "orig", exc)).lower()
    return (
        "files" in message
        and "id" in message
        and (
            "not null" in message
            or "not-null" in message
            or "notnullviolation" in message
            or ("null value in column" in message and "violates" in message)
        )
    )


def _is_duplicate_files_id_error(exc: IntegrityError) -> bool:
    message = str(getattr(exc, "orig", exc)).lower()
    return (
        "files" in message
        and "id" in message
        and ("duplicate" in message or "unique" in message or "already exists" in message)
    )

# ==================== PROJECTS ====================

@router.post("/", response_model=ProjectResponse)
def create_project(
    data: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new project"""
    project = Project(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        is_active=True
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        is_active=project.is_active,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat()
    )

@router.get("/", response_model=list[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects for current user"""
    projects = db.query(Project).filter(
        Project.user_id == current_user.id,
        Project.is_active == True
    ).all()
    
    return [
        ProjectResponse(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            description=p.description,
            is_active=p.is_active,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat()
        )
        for p in projects
    ]

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        is_active=project.is_active,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat()
    )

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if data.name:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    
    db.commit()
    db.refresh(project)
    
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        is_active=project.is_active,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat()
    )

@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a project (soft delete)"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.is_active = False
    db.commit()
    
    return {"success": True, "message": "Project deleted"}

# ==================== FILES ====================

@router.post("/{project_id}/files", response_model=FileResponse)
def create_file(
    project_id: int,
    data: FileCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a file or folder in project"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify parent file exists if provided
    if data.parent_id is not None:
        parent = db.query(File).filter(
            File.id == data.parent_id,
            _file_project_filter(project_id)
        ).first()
        
        if not parent:
            raise HTTPException(status_code=404, detail="Parent file not found")
    
    file_payload = dict(
        user_id=current_user.id,
        project_id=project_id,
        parent_id=data.parent_id,
        name=data.name,
        file_type=data.file_type,
        content=data.content,
        is_active=True
    )
    file = File(**file_payload)

    db.add(file)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if not _is_missing_files_id_error(exc):
            raise

        # Fallback for legacy schemas where files.id has no DB-side default.
        for _ in range(3):
            file = File(id=_next_legacy_file_id(db), **file_payload)
            db.add(file)
            try:
                db.commit()
                break
            except IntegrityError as retry_exc:
                db.rollback()
                if _is_duplicate_files_id_error(retry_exc):
                    continue
                raise
        else:
            raise HTTPException(
                status_code=500,
                detail="Could not allocate file id for legacy database schema",
            ) from exc

    db.refresh(file)

    return _serialize_file(file)

@router.get("/{project_id}/files", response_model=list[FileResponse])
def list_files(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all files in project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    files = db.query(File).filter(
        _file_project_filter(project_id),
        File.is_active == True
    ).all()
    
    return [_serialize_file(f) for f in files]

@router.get("/{project_id}/files/tree", response_model=list[FileTreeResponse])
def get_file_tree(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get file tree structure for project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    def build_tree(parent_id=None):
        files = db.query(File).filter(
            _file_project_filter(project_id),
            _file_parent_filter(parent_id),
            File.is_active == True
        ).all()
        
        tree = []
        for f in files:
            node = FileTreeResponse(
                id=f.id,
                name=f.name,
                file_type=f.file_type,
                children=build_tree(f.id)
            )
            tree.append(node)
        
        return tree
    
    return build_tree()

@router.get("/{project_id}/files/{file_id}", response_model=FileResponse)
def get_file(
    project_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific file"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    file = db.query(File).filter(
        File.id == file_id,
        _file_project_filter(project_id)
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return _serialize_file(file)

@router.put("/{project_id}/files/{file_id}", response_model=FileResponse)
def update_file(
    project_id: int,
    file_id: int,
    data: FileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a file"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    file = db.query(File).filter(
        File.id == file_id,
        _file_project_filter(project_id)
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if data.name:
        file.name = data.name
    if data.content is not None:
        file.content = data.content
    
    db.commit()
    db.refresh(file)
    
    return _serialize_file(file)

@router.delete("/{project_id}/files/{file_id}")
def delete_file(
    project_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a file (soft delete)"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    file = db.query(File).filter(
        File.id == file_id,
        _file_project_filter(project_id)
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Soft delete file and all children
    def delete_recursive(current_file_id):
        children = db.query(File).filter(
            _file_project_filter(project_id),
            _file_parent_filter(current_file_id),
            File.is_active == True
        ).all()
        for child in children:
            delete_recursive(child.id)
        file = db.query(File).filter(File.id == current_file_id).first()
        if file:
            file.is_active = False
    
    delete_recursive(file_id)
    db.commit()
    
    return {"success": True, "message": "File deleted"}
