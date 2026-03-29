"""convert_user_id_to_uuid

Revision ID: 4e76d1ba7da0
Revises: 
Create Date: 2026-03-29 11:31:29.347874

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = '4e76d1ba7da0'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Step 0: Handle RLS policies (Supabase specific)
    op.execute('ALTER TABLE files DISABLE ROW LEVEL SECURITY')
    op.execute('DROP POLICY IF EXISTS "Users can view their own files" ON files')
    op.execute('DROP POLICY IF EXISTS "Users can insert their own files" ON files')
    op.execute('DROP POLICY IF EXISTS "Users can delete their own files" ON files')
    op.execute('DROP POLICY IF EXISTS "Users can update their own files" ON files')

    # Step 1: Cleanup legacy and drop all constraints immediately
    op.execute("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey")
    op.execute("ALTER TABLE files DROP CONSTRAINT IF EXISTS files_user_id_fkey")
    op.execute("ALTER TABLE files DROP CONSTRAINT IF EXISTS files_project_id_fkey")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey CASCADE")

    # DELETE data that contains invalid type strings (e.g. filename in id column)
    # Using regex !~ to exclude non-numeric strings from integer columns
    op.execute("DELETE FROM files WHERE id::text !~ '^[0-9]+$'")
    op.execute("DELETE FROM files WHERE user_id::text IN ('1','2','3','4')")
    op.execute("DELETE FROM projects WHERE user_id::text IN ('1','2','3','4')")
    op.execute("DELETE FROM users WHERE id::text IN ('1','2','3','4')")

    # Step 2: Drop Default before type conversion
    op.execute("ALTER TABLE users ALTER COLUMN id DROP DEFAULT")

    # Step 3: Convert columns to unified types with explicit casting
    op.execute("ALTER TABLE users ALTER COLUMN id TYPE UUID USING id::text::uuid")
    op.execute("ALTER TABLE projects ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid")
    op.execute("ALTER TABLE files ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid")
    
    # Restore internal IDs to integer
    op.execute("ALTER TABLE files ALTER COLUMN id TYPE INTEGER USING id::text::integer")
    op.execute("ALTER TABLE files ALTER COLUMN project_id TYPE INTEGER USING project_id::text::integer")

    # Step 4: Restore PK and Set UUID Default
    op.execute("ALTER TABLE users ADD PRIMARY KEY (id)")
    op.execute("ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()")

    # Step 5: Clean orphans
    op.execute("DELETE FROM projects WHERE user_id NOT IN (SELECT id FROM users)")
    op.execute("DELETE FROM files WHERE user_id NOT IN (SELECT id FROM users)")
    op.execute("DELETE FROM files WHERE project_id NOT IN (SELECT id FROM projects)")

    # Step 6: Restore FKs with ON DELETE CASCADE
    op.execute("ALTER TABLE projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE files ADD CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE files ADD CONSTRAINT files_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE")

    # Step 7: Restore RLS policies
    op.execute('ALTER TABLE files ENABLE ROW LEVEL SECURITY')
    op.execute('CREATE POLICY "Users can view their own files" ON files FOR SELECT USING (auth.uid() = user_id)')
    op.execute('CREATE POLICY "Users can insert their own files" ON files FOR INSERT WITH CHECK (auth.uid() = user_id)')
    op.execute('CREATE POLICY "Users can delete their own files" ON files FOR DELETE USING (auth.uid() = user_id)')
    op.execute('CREATE POLICY "Users can update their own files" ON files FOR UPDATE USING (auth.uid() = user_id)')

def downgrade() -> None:
    pass
