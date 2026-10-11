
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Ticket

app = FastAPI(title="CloudDesk API")


# Database connection for each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Request models
class TicketCreate(BaseModel):
    title: str
    description: str
    status: str = "Open"
    priority: str = "Medium"


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


@app.get("/")
def home():
    return {"message": "Welcome to CloudDesk API"}


# View all tickets
@app.get("/tickets")
def get_tickets(db: Session = Depends(get_db)):
    return db.query(Ticket).order_by(Ticket.id).all()


# View a single ticket
@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)

    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return ticket


# Create a ticket
@app.post("/tickets", status_code=201)
def create_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db)
):
    new_ticket = Ticket(**ticket.model_dump())

    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return new_ticket


# Update a ticket
@app.put("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    updates: TicketUpdate,
    db: Session = Depends(get_db)
):
    ticket = db.get(Ticket, ticket_id)

    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)

    return ticket


# Delete a ticket
@app.delete("/tickets/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)

    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db.delete(ticket)
    db.commit()

    return {"message": "Ticket deleted successfully"}
