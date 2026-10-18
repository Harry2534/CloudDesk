
import sys

from database import SessionLocal
from models import User


def promote_technician(email):
    with SessionLocal() as db:
        user = db.query(User).filter(
            User.email == email.strip().lower()
        ).first()

        if user is None:
            print("User not found. Register the account first.")
            return

        if user.role == "technician":
            print("This user is already an IT Technician.")
            return

        user.role = "technician"
        db.commit()

        print(f"{user.name} is now an IT Technician.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python promote_technician.py user@example.com")
        sys.exit(1)

    promote_technician(sys.argv[1])
