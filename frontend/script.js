
const API_URL = "http://127.0.0.1:8000";

let tickets = [];

const ticketForm = document.getElementById("ticket-form");
const ticketList = document.getElementById("ticket-list");
const searchInput = document.getElementById("search");

// Safely display user-provided text in HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Fetch tickets from PostgreSQL through FastAPI
async function loadTickets() {
    try {
        const response = await fetch(`${API_URL}/tickets`);

        if (!response.ok) {
            throw new Error("Could not load tickets");
        }

        tickets = await response.json();
        updateDashboard();
        displayTickets();
    } catch (error) {
        ticketList.textContent =
            "Unable to load tickets. Check that FastAPI is running.";
        console.error(error);
    }
}

// Update dashboard statistics
function updateDashboard() {
    document.getElementById("total-tickets").textContent =
        tickets.length;

    document.getElementById("open-tickets").textContent =
        tickets.filter(ticket => ticket.status === "Open").length;

    document.getElementById("closed-tickets").textContent =
        tickets.filter(ticket => ticket.status === "Closed").length;
}

// Display tickets and apply search
function displayTickets() {
    const query = searchInput.value.toLowerCase();

    const filtered = tickets.filter(ticket =>
        ticket.title.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        ticketList.textContent = "No matching tickets found.";
        return;
    }

    ticketList.innerHTML = filtered.map(ticket => {
        const priorityClass = ["High", "Medium", "Low"]
            .includes(ticket.priority)
            ? `priority-${ticket.priority.toLowerCase()}`
            : "";

        return `
            <div class="ticket-card">
                <h3>#${ticket.id} - ${escapeHTML(ticket.title)}</h3>
                <p>${escapeHTML(ticket.description)}</p>

                <div class="ticket-meta">
                    <span class="badge">
                        ${escapeHTML(ticket.status)}
                    </span>

                    <span class="badge ${priorityClass}">
                        ${escapeHTML(ticket.priority)} Priority
                    </span>
                </div>

                <div class="ticket-actions">
                    <button data-action="edit" data-id="${ticket.id}">
                        Edit
                    </button>

                    <button data-action="close" data-id="${ticket.id}">
                        Close Ticket
                    </button>

                    <button class="delete-btn"
                            data-action="delete"
                            data-id="${ticket.id}">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// Create a new ticket
ticketForm.addEventListener("submit", async event => {
    event.preventDefault();

    const newTicket = {
        title: document.getElementById("title").value.trim(),
        description: document.getElementById("description").value.trim(),
        priority: document.getElementById("priority").value,
        status: "Open"
    };

    try {
        const response = await fetch(`${API_URL}/tickets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newTicket)
        });

        if (!response.ok) {
            throw new Error("Failed to create ticket");
        }

        ticketForm.reset();
        await loadTickets();
    } catch (error) {
        alert("Could not create ticket.");
        console.error(error);
    }
});

// Search tickets as the user types
searchInput.addEventListener("input", displayTickets);

// Handle ticket actions
ticketList.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const ticket = tickets.find(item => item.id === id);

    if (!ticket) return;

    try {
        if (action === "delete") {
            if (!confirm(`Delete ticket #${id}?`)) return;

            const response = await fetch(`${API_URL}/tickets/${id}`, {
                method: "DELETE"
            });

            if (!response.ok) throw new Error("Delete failed");
        }

        if (action === "close") {
            const response = await fetch(`${API_URL}/tickets/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "Closed" })
            });

            if (!response.ok) throw new Error("Update failed");
        }

        if (action === "edit") {
            const title = prompt("Ticket title:", ticket.title);
            if (title === null) return;

            const description = prompt(
                "Ticket description:",
                ticket.description
            );
            if (description === null) return;

            if (!title.trim() || !description.trim()) {
                alert("Title and description cannot be empty.");
                return;
            }

            const response = await fetch(`${API_URL}/tickets/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim()
                })
            });

            if (!response.ok) throw new Error("Edit failed");
        }

        await loadTickets();
    } catch (error) {
        alert("Ticket action failed.");
        console.error(error);
    }
});

// Load tickets when the page opens
loadTickets();
