import os
import sys
import sqlite3
import json
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

# Enable UTF-8 print encoding for Windows terminals
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def migrate():
    """
    Migrates sessions and chat history from local SQLite (portfolio.db) to Supabase PostgreSQL.
    """
    base_dir = Path(__file__).resolve().parent
    env_path = base_dir / ".env"
    load_dotenv(dotenv_path=env_path)

    sqlite_path = base_dir / "portfolio.db"
    if not sqlite_path.exists():
        print(f"❌ Local SQLite database file not found at: {sqlite_path}")
        print("Please ensure portfolio.db is placed in the backend/ directory.")
        return

    # 1. Read SQLite sessions
    print(f"📖 Reading sessions from local SQLite: {sqlite_path}...")
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()
    
    # Check table structure
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
    if not cursor.fetchone():
        print("❌ No 'sessions' table found in local SQLite database.")
        conn.close()
        return

    cursor.execute("PRAGMA table_info(sessions)")
    columns = [col[1] for col in cursor.fetchall()]
    has_chat_history = "chat_history" in columns

    query = "SELECT id, name, tickers, constraints" + (", chat_history" if has_chat_history else "") + ", created_at, updated_at FROM sessions"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    print(f"Found {len(rows)} sessions in local SQLite database.")
    if len(rows) == 0:
        print("No sessions to migrate.")
        return

    # 2. Connect to Supabase PostgreSQL
    database_url = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres.ugdktlbidiehftyucuhv:2DFtxw.2Fbqhu5r@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
    )
    if not database_url.startswith("sqlite") and "sslmode" not in database_url:
        delimiter = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{delimiter}sslmode=require"

    print(f"🔗 Connecting to Supabase PostgreSQL...")
    engine = create_engine(database_url, pool_pre_ping=True)
    models.Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    migrated_count = 0
    try:
        # Get existing session names in Supabase to avoid duplicates
        existing_sessions = {s.name for s in db.query(models.PortfolioSession).all()}

        for row in rows:
            name = row[1]
            tickers_str = row[2] if isinstance(row[2], str) else json.dumps(row[2])
            constraints_str = row[3] if isinstance(row[3], str) else json.dumps(row[3])
            chat_history_str = (row[4] if isinstance(row[4], str) else json.dumps(row[4])) if has_chat_history else json.dumps([])
            created_at = row[5] if has_chat_history else row[4]
            updated_at = row[6] if has_chat_history else row[5]

            # If already exists with exact same name, update or create with unique name
            if name in existing_sessions:
                print(f"  ⚡ Session '{name}' already exists in Supabase. Skipping or merging...")
                continue

            new_session = models.PortfolioSession(
                name=name,
                tickers=tickers_str,
                constraints=constraints_str,
                chat_history=chat_history_str,
                created_at=created_at,
                updated_at=updated_at
            )
            db.add(new_session)
            migrated_count += 1
            print(f"  ✅ Migrated: '{name}'")

        db.commit()
        print(f"\n🎉 Migration complete! Successfully migrated {migrated_count} sessions to Supabase PostgreSQL.")
    except Exception as e:
        db.rollback()
        print(f"❌ Migration error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
