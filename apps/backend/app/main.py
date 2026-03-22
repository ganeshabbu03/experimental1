from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

from app.routes import auth, profile, projects, oauth, terminal
from app.routes.plugins_router import router as plugins_router
from app.database import Base, engine
from app.db_bootstrap import ensure_schema_compatibility
from app.models.user import User
from app.models.project import Project
from app.models.file import File

# Create all tables on startup
try:
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility(engine)
except Exception as exc:
    print(f"[warn] Database schema bootstrap failed during startup: {exc}")

app = FastAPI(title="Deexen Backend API", version="1.0.0")

# Add CORS middleware
frontend_url = os.getenv("FRONTEND_URL", "")
cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
if frontend_url:
    allowed_origins.append(frontend_url)
if cors_origins_env:
    allowed_origins.extend(
        [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    )

# Keep order stable while removing duplicates.
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://[a-z0-9-]+\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add SessionMiddleware for OAuth
app.add_middleware(SessionMiddleware, secret_key="deexen-session-secret-key-change-in-production")

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"status": "ok", "service": "deexen-backend"}

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(profile.router, prefix="/profile", tags=["Profile"])
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(oauth.router, prefix="/oauth", tags=["OAuth"])
app.include_router(terminal.router, prefix="/terminal", tags=["Terminal"])
app.include_router(plugins_router, prefix="/plugins", tags=["Plugins"])
