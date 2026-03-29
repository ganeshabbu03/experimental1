import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env file.")
    exit(1)

print(f"Connecting to database to update ID types...")
engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.connect() as conn:
        print("Starting migrations...")
        
        # PostgreSQL / MySQL specific type conversion
        # We use 'text' and 'cast' if needed. In Postgres, we need to use 'USING' if it's not implicitly castable.
        
        is_postgres = "postgresql" in DATABASE_URL.lower() or "postgres" in DATABASE_URL.lower()
        
        try:
            if is_postgres:
                print("Detected PostgreSQL. Using USING clause for type conversion.")
                # Update users.id
                conn.execute(text("ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(36) USING id::VARCHAR(36);"))
                # Update projects.id and projects.user_id
                conn.execute(text("ALTER TABLE projects ALTER COLUMN id TYPE INTEGER;")) # id remains integer
                conn.execute(text("ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::VARCHAR(36);"))
                # Update files.user_id
                conn.execute(text("ALTER TABLE files ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::VARCHAR(36);"))
            else:
                print("Detected MySQL or SQLite. Using standard ALTER TABLE.")
                # Note: SQLite doesn't support ALTER COLUMN TYPE easily.
                # This script is primarily for the production Postgres/MySQL environment.
                conn.execute(text("ALTER TABLE users MODIFY id VARCHAR(36);"))
                conn.execute(text("ALTER TABLE projects MODIFY user_id VARCHAR(36);"))
                conn.execute(text("ALTER TABLE files MODIFY user_id VARCHAR(36);"))
            
            conn.commit()
            print("Successfully updated database ID columns to VARCHAR(36)!")
        except Exception as e:
            print(f"Error during migration: {e}")
            print("You might need to MANUALLY run these SQL commands in your DB console:")
            print("ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(36) USING id::VARCHAR(36);")
            print("ALTER TABLE projects ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::VARCHAR(36);")
            print("ALTER TABLE files ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::VARCHAR(36);")

if __name__ == "__main__":
    run_migration()
