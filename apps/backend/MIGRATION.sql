"""
Migration to add missing columns to users table
This adds is_active and updated_at columns to support new user model
"""

# Run this manually in your MySQL/PostgreSQL database:
# ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
# ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

# Type Conversion for UUID support (PostgreSQL):
# ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(36) USING id::VARCHAR(36);
# ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::VARCHAR(36);
# ALTER TABLE files ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::VARCHAR(36);

# Type Conversion for UUID support (MySQL):
# ALTER TABLE users MODIFY id VARCHAR(36);
# ALTER TABLE projects MODIFY user_id VARCHAR(36);
# ALTER TABLE files MODIFY user_id VARCHAR(36);
