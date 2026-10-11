
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

# Create the FastAPI application
app = FastAPI(
    title="CloudDesk API",
    description="Cloud-based IT Support Ticket System",
    version="1.0.0"
)


# Define the structure of a support ticket
class Ticket(BaseModel):
    title: str
    description: str
    status: str = "Open"
    priority: str = "Medium"


# Define optional fields for updating a ticket
class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


# Temporary in-memory ticket database
tickets = [
    {
        "id": 1,
        "title": "Cannot log in",
        "description": "User cannot access their account",
        "status": "Open",
        "priority": "High"
    },
    {
        "id": 2,
        "title": "Printer not working",
        "description": "Office printer is offline",
        "status": "In Progress",
        "priority": "Medium"
    }
]

# Track the next available ticket ID
next_ticket_id = 3


# Home endpoint
@app.get("/")
def home():
    return {
        "message": "Welcome to CloudDesk API",
        "status": "running"
    }


# READ: Retrieve all tickets
@app.get("/tickets")
def get_tickets():
    return tickets


# READ: Retrieve a specific ticket
@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    for ticket in tickets:
        if ticket["id"] == ticket_id:
            return ticket

    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )


# CREATE: Add a new support ticket
@app.post("/tickets", status_code=201)
def create_ticket(ticket: Ticket):
    global next_ticket_id

    new_ticket = {
        "id": next_ticket_id,
        **ticket.model_dump()
    }

    tickets.append(new_ticket)
    next_ticket_id += 1

    return new_ticket


# UPDATE: Modify an existing ticket
@app.put("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, updated_ticket: TicketUpdate):
    for ticket in tickets:
        if ticket["id"] == ticket_id:
            changes = updated_ticket.model_dump(
                exclude_unset=True
            )

            ticket.update(changes)
            return ticket

    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )


# DELETE: Remove an existing ticket
@app.delete("/tickets/{ticket_id}")
def delete_ticket(ticket_id: int):
    for index, ticket in enumerate(tickets):
        if ticket["id"] == ticket_id:
            tickets.pop(index)

            return {
                "message": "Ticket deleted successfully"
            }

    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )
