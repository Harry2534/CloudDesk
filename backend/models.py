
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# Registered CloudDesk users
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # New registrations always receive the employee role.
    role = Column(String(20), default="employee", nullable=False)

    created_tickets = relationship(
        "Ticket",
        back_populates="creator",
        foreign_keys="Ticket.created_by_id"
    )

    assigned_tickets = relationship(
        "Ticket",
        back_populates="assignee",
        foreign_keys="Ticket.assigned_to_id"
    )


# IT support tickets
class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="Open", nullable=False)
    priority = Column(String(50), default="Medium", nullable=False)

    # Legacy text assignment field; retained during migration.
    assigned_to = Column(String(100), nullable=True)

    # User who originally created the ticket.
    created_by_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    # Registered technician assigned to the ticket.
    assigned_to_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    creator = relationship(
        "User",
        back_populates="created_tickets",
        foreign_keys=[created_by_id]
    )

    assignee = relationship(
        "User",
        back_populates="assigned_tickets",
        foreign_keys=[assigned_to_id]
    )
