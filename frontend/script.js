
const API_URL = "/api";

let accessToken = null;
let currentUser = null;
let tickets = [];
let technicians = [];

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const userPanel = document.getElementById("user-panel");
const ticketForm = document.getElementById("ticket-form");
const ticketList = document.getElementById("ticket-list");
const searchInput = document.getElementById("search");
const ticketFilters = document.getElementById("ticket-filters");
const assignmentFilter = document.getElementById("assignment-filter");
const priorityFilter = document.getElementById("priority-filter");
const statusFilter = document.getElementById("status-filter");
const authMessage = document.getElementById("auth-message");
const appMessage = document.getElementById("app-message");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Add the login token to protected API requests.
async function apiRequest(path, options = {}) {
    const headers = { ...options.headers };

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    if (response.status === 401 && accessToken) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
            const data = await response.json();
            if (typeof data.detail === "string") {
                message = data.detail;
            }
        } catch {
            // Use the HTTP status message.
        }

        throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
}

function isTechnician() {
    return currentUser?.role === "technician";
}

function showAuth() {
    authSection.hidden = false;
    appSection.hidden = true;
    userPanel.hidden = true;
}

function showApp() {
    authSection.hidden = true;
    appSection.hidden = false;
    userPanel.hidden = false;

    document.getElementById("user-info").textContent =
        `${currentUser.name} (${isTechnician() ? "IT Technician" : "Employee"})`;

    document.getElementById("tickets-heading").textContent =
        isTechnician() ? "My Assigned Tickets" : "My Support Tickets";

    ticketFilters.hidden = !isTechnician();

    if (isTechnician()) {
        assignmentFilter.value = "mine";
        priorityFilter.value = "all";
        statusFilter.value = "all";
    }
}

function logout() {
    accessToken = null;
    currentUser = null;
    tickets = [];
    technicians = [];

    ticketList.textContent = "";
    appMessage.textContent = "";
    showAuth();
}

// Switch between login and registration forms.
let registrationMode = false;

document.getElementById("toggle-auth").addEventListener("click", () => {
    registrationMode = !registrationMode;

    document.getElementById("login-form").hidden = registrationMode;
    document.getElementById("register-form").hidden = !registrationMode;

    document.getElementById("auth-heading").textContent =
        registrationMode ? "Create Account" : "Log In";

    document.getElementById("auth-description").textContent =
        registrationMode
            ? "Register for an employee account."
            : "Sign in to manage your support tickets.";

    document.getElementById("toggle-auth").textContent =
        registrationMode
            ? "Already have an account? Log In"
            : "Don't have an account? Register";

    authMessage.textContent = "";
});

document.getElementById("register-form").addEventListener(
    "submit",
    async event => {
        event.preventDefault();
        authMessage.textContent = "";

        const data = {
            name: document.getElementById("register-name").value.trim(),
            email: document.getElementById("register-email").value.trim(),
            password: document.getElementById("register-password").value
        };

        try {
            await apiRequest("/register", {
                method: "POST",
                body: JSON.stringify(data)
            });

            document.getElementById("register-form").reset();
            document.getElementById("toggle-auth").click();

            authMessage.textContent =
                "Account created. You can now log in.";
        } catch (error) {
            authMessage.textContent = error.message;
        }
    }
);

document.getElementById("login-form").addEventListener(
    "submit",
    async event => {
        event.preventDefault();
        authMessage.textContent = "";

        const data = {
            email: document.getElementById("login-email").value.trim(),
            password: document.getElementById("login-password").value
        };

        try {
            const result = await apiRequest("/login", {
                method: "POST",
                body: JSON.stringify(data)
            });

            accessToken = result.access_token;
            currentUser = result.user;
            console.log("Logged-in user:", currentUser);

            document.getElementById("login-form").reset();

            if (isTechnician()) {
                await loadTechnicians();
            }

            showApp();
            await loadTickets();
        } catch (error) {
            authMessage.textContent = error.message;
        }
    }
);

document.getElementById("logout-btn").addEventListener("click", logout);

// Only technicians can retrieve the assignment list.
async function loadTechnicians() {
    technicians = await apiRequest("/technicians");
}

async function loadTickets() {
    try {
        tickets = await apiRequest("/tickets");
        appMessage.textContent = "";
        updateDashboard();
        displayTickets();
    } catch (error) {
        ticketList.textContent = "Unable to load tickets.";
        appMessage.textContent = error.message;
    }
}

function updateDashboard() {
    document.getElementById("total-tickets").textContent =
        tickets.length;

    document.getElementById("open-tickets").textContent =
        tickets.filter(ticket => ticket.status === "Open").length;

    document.getElementById("closed-tickets").textContent =
        tickets.filter(ticket => ticket.status === "Closed").length;
}

function technicianOptions(assignedId) {
    const unassigned = `
        <option value="" ${assignedId == null ? "selected" : ""}>
            Unassigned
        </option>
    `;

    return unassigned + technicians.map(technician => `
        <option value="${technician.id}"
            ${technician.id === assignedId ? "selected" : ""}>
            ${escapeHTML(technician.name)}
        </option>
    `).join("");
}


function displayTickets() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = tickets.filter(ticket => {
        const matchesSearch =
            ticket.title.toLowerCase().includes(query) ||
            ticket.description.toLowerCase().includes(query) ||
            ticket.priority.toLowerCase().includes(query) ||
            ticket.status.toLowerCase().includes(query) ||
            (ticket.assigned_to ?? "").toLowerCase().includes(query) ||
            (ticket.created_by_email ?? "").toLowerCase().includes(query);

        if (!matchesSearch) return false;

        // Employees keep their existing ticket view.
        if (!isTechnician()) return true;

        // Filter tickets by assignment.
        const assignment = assignmentFilter.value;

        const matchesAssignment =
            assignment === "all" ||
            (
                assignment === "mine" &&
                ticket.assigned_to_id != null &&
                Number(ticket.assigned_to_id) === Number(currentUser.id)
            ) ||
            (
                assignment === "unassigned" &&
                ticket.assigned_to_id == null
            );

        // Filter tickets by priority.
        const matchesPriority =
            priorityFilter.value === "all" ||
            ticket.priority === priorityFilter.value;

        // Filter tickets by status.
        const matchesStatus =
            statusFilter.value === "all" ||
            ticket.status === statusFilter.value;

        return matchesAssignment && matchesPriority && matchesStatus;
    });

    if (filtered.length === 0) {
        ticketList.textContent = "No matching tickets found.";
        return;
    }

    ticketList.innerHTML = filtered.map(ticket => {
        const priorityClass = ["High", "Medium", "Low"]
            .includes(ticket.priority)
            ? `priority-${ticket.priority.toLowerCase()}`
            : "";

        const assignmentControl = isTechnician()
            ? `
                <label for="assign-${ticket.id}">
                    Assigned Technician
                </label>
                <select id="assign-${ticket.id}"
                        class="assignment-select"
                        data-ticket-id="${ticket.id}">
                    ${technicianOptions(ticket.assigned_to_id)}
                </select>
              `
            : `
                <p>
                    <strong>Assigned to:</strong>
                    ${escapeHTML(ticket.assigned_to || "Unassigned")}
                </p>
              `;

        const technicianActions = isTechnician()
            ? `
                ${ticket.status !== "Closed" ? `
                    <button data-action="close" data-id="${ticket.id}">
                        Close Ticket
                    </button>
                ` : ""}
                <button class="delete-btn"
                        data-action="delete" data-id="${ticket.id}">
                    Delete
                </button>
              `
            : "";

        return `
            <div class="ticket-card">
                <h3>#${ticket.id} - ${escapeHTML(ticket.title)}</h3>
                <p>${escapeHTML(ticket.description)}</p>

                ${isTechnician() ? `
                    <div class="ticket-contact">
                        <p>
                            <strong>Submitted by:</strong>
                            ${escapeHTML(ticket.created_by_name || "Unknown")}
                        </p>
                        <p>
                            <strong>Email:</strong>
                            ${ticket.created_by_email
                                ? `<a href="mailto:${encodeURIComponent(ticket.created_by_email)}?subject=${encodeURIComponent(`CloudDesk Ticket #${ticket.id} - ${ticket.title}`)}">
                                    ${escapeHTML(ticket.created_by_email)}
                                </a>`
                                : "Not available"}
                        </p>
                    </div>
                ` : ""}

                <div class="ticket-meta">
                    <span class="badge">
                        ${escapeHTML(ticket.status)}
                    </span>
                    <span class="badge ${priorityClass}">
                        ${escapeHTML(ticket.priority)} Priority
                    </span>
                </div>

                <div class="ticket-assignment">
                    ${assignmentControl}
                </div>

                <div class="ticket-actions">
                    <button data-action="edit" data-id="${ticket.id}">
                        Edit
                    </button>
                    ${technicianActions}
                </div>
            </div>
        `;
    }).join("");
}


// All logged-in users can create tickets.
ticketForm.addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        title: document.getElementById("title").value.trim(),
        description: document.getElementById("description").value.trim(),
        priority: document.getElementById("priority").value
    };

    if (!data.title || !data.description) {
        appMessage.textContent = "Title and description are required.";
        return;
    }

    try {
        await apiRequest("/tickets", {
            method: "POST",
            body: JSON.stringify(data)
        });

        ticketForm.reset();
        await loadTickets();
    } catch (error) {
        appMessage.textContent = error.message;
    }
});

searchInput.addEventListener("input", displayTickets);

// Technicians can assign tickets to registered technicians.
ticketList.addEventListener("change", async event => {
    const select = event.target.closest(".assignment-select");

    if (!select || !isTechnician()) return;

    const id = Number(select.dataset.ticketId);
    const newAssignment = select.value
        ? Number(select.value)
        : null;

    select.disabled = true;

    try {
        await apiRequest(`/tickets/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                assigned_to_id: newAssignment
            })
        });

        await loadTickets();
    } catch (error) {
        appMessage.textContent = error.message;
        await loadTickets();
    }
});

// Handle ticket editing, closing and deletion.
ticketList.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const ticket = tickets.find(item => item.id === id);

    if (!ticket) return;

    try {
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

            await apiRequest(`/tickets/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim()
                })
            });
        } else if (action === "close" && isTechnician()) {
            await apiRequest(`/tickets/${id}`, {
                method: "PUT",
                body: JSON.stringify({ status: "Closed" })
            });
        } else if (action === "delete" && isTechnician()) {
            if (!confirm(`Delete ticket #${id}?`)) return;

            await apiRequest(`/tickets/${id}`, {
                method: "DELETE"
            });
        } else {
            return;
        }

        await loadTickets();
    } catch (error) {
        appMessage.textContent = error.message;
    }
});

// Keep tokens in memory rather than browser storage.
// Users log in again after refreshing the page.

[assignmentFilter, priorityFilter, statusFilter].forEach(filter => {
    filter.addEventListener("change", displayTickets);
});

showAuth();
