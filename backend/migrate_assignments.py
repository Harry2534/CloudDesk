
from sqlalchemy import inspect, text

from database import engine
from models import Base


# Create the users table if it does not already exist.
Base.metadata.tables["users"].create(
    bind=engine,
    checkfirst=True
)

# Add missing columns to the existing tickets table.
with engine.begin() as connection:
    inspector = inspect(connection)

    if not inspector.has_table("tickets"):
        raise RuntimeError(
            "Tickets table not found. Run create_tables.py first."
        )

    columns = {
        column["name"]
        for column in inspector.get_columns("tickets")
    }

    if "assigned_to" not in columns:
        connection.execute(
            text(
                "ALTER TABLE tickets "
                "ADD COLUMN assigned_to VARCHAR(100)"
            )
        )
        print("Added assigned_to column.")

    if "created_by_id" not in columns:
        connection.execute(
            text(
                "ALTER TABLE tickets "
                "ADD COLUMN created_by_id INTEGER "
                "REFERENCES users(id)"
            )
        )
        print("Added created_by_id column.")

    if "assigned_to_id" not in columns:
        connection.execute(
            text(
                "ALTER TABLE tickets "
                "ADD COLUMN assigned_to_id INTEGER "
                "REFERENCES users(id)"
            )
        )
        print("Added assigned_to_id column.")

print("CloudDesk database migration completed.")
