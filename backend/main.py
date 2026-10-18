
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import SessionLocal
from models import Ticket, User


app = FastAPI(title="CloudDesk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


# Create and close a database session for each request.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Authentication request models
class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Ticket request models
class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    priority: str = "Medium"


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None
    status: Optional[str] = None


def user_response(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


def ticket_response(ticket: Ticket):
    return {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "created_by_id": ticket.created_by_id,
        "assigned_to_id": ticket.assigned_to_id,
        "assigned_to": ticket.assignee.name if ticket.assignee else None,
    }


@app.get("/")
def home():
    return {"message": "CloudDesk API v1.3"}


# Register an employee account.
@app.post("/register", status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    email = str(data.email).lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role="employee",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user_response(user)


# Log in and receive an access token.
@app.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == str(data.email).lower()
    ).first()

    if user is None or not verify_password(
        data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_response(user),
    }


# Get the logged-in user's details.
@app.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return user_response(current_user)


# List technicians for the assignment dropdown.
@app.get("/technicians")
def get_technicians(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "technician":
        raise HTTPException(
            status_code=403,
            detail="IT technician access required",
        )

    technicians = db.query(User).filter(
        User.role == "technician"
    ).order_by(User.name).all()

    return [user_response(user) for user in technicians]


# Employees see their own tickets; technicians see all tickets.
@app.get("/tickets")
def get_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)

    if current_user.role != "technician":
        query = query.filter(
            Ticket.created_by_id == current_user.id
        )

    tickets = query.order_by(Ticket.id).all()
    return [ticket_response(ticket) for ticket in tickets]


@app.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.get(Ticket, ticket_id)

    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if (
        current_user.role != "technician"
        and ticket.created_by_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return ticket_response(ticket)


# Logged-in users can create tickets.
@app.post("/tickets", status_code=201)
def create_ticket(
    data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = Ticket(
        title=data.title,
        description=data.description,
        priority=data.priority,
        status="Open",
        created_by_id=current_user.id,
    )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return ticket_response(ticket)


# Employees can edit their own ticket details.
# Technicians can also assign, edit and close tickets.
@app.put("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    updates: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.get(Ticket, ticket_id)

    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_technician = current_user.role == "technician"

    if not is_technician and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    changes = updates.model_dump(exclude_unset=True)

    # Only technicians can change status or assignments.
    if not is_technician and (
        "status" in changes or "assigned_to_id" in changes
    ):
        raise HTTPException(
            status_code=403,
            detail="Only technicians can change status or assignments",
        )

    if "status" in changes:
        if changes["status"] not in ("Open", "Closed"):
            raise HTTPException(
                status_code=400,
                detail="Status must be Open or Closed",
            )

    if "assigned_to_id" in changes:
        assignee_id = changes["assigned_to_id"]

        if assignee_id is not None:
            assignee = db.get(User, assignee_id)

            if assignee is None or assignee.role != "technician":
                raise HTTPException(
                    status_code=400,
                    detail="Assignment must be to a registered technician",
                )

    for field, value in changes.items():
        if field == "assigned_to_id":
            ticket.assigned_to_id = value
        elif value is not None:
            setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)

    return ticket_response(ticket)


# Only technicians can delete tickets.
@app.delete("/tickets/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "technician":
        raise HTTPException(
            status_code=403,
            detail="Only technicians can delete tickets",
        )

    ticket = db.get(Ticket, ticket_id)

    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db.delete(ticket)
    db.commit()

    return {"message": "Ticket deleted successfully"}
