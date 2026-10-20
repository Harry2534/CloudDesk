const API_URL = "/api";

let accessToken = null;
let currentUser = null;
let tickets = [];
let technicians = [];
let openTicketId = null;      // ticket shown in the detail drawer
let editingTicketId = null;   // null = creating, number = editing
let isLoading = false;

const $ = id => document.getElementById(id);

const authSection = $("auth-section");
const appSection = $("app-section");
const userPanel = $("user-panel");
const ticketForm = $("ticket-form");
const ticketList = $("ticket-list");
const searchInput = $("search");
const ticketFilters = $("ticket-filters");
const assignmentFilter = $("assignment-filter");
const priorityFilter = $("priority-filter");
const statusFilter = $("status-filter");
const authMessage = $("auth-message");
const appMessage = $("app-message");
const drawer = $("drawer");
const drawerBody = $("drawer-body");
const ticketModal = $("ticket-modal");
const confirmModal = $("confirm-modal");

/* ---------------------------------------------------------
   Icons (inline SVG, Lucide-style)
   --------------------------------------------------------- */
const ICONS = {
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    "folder-search": '<path d="M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1"/><circle cx="17" cy="17" r="3"/><path d="m21 21-1.9-1.9"/>'
};

function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach(el => {
        if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon);
    });
}

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase() || "?";
}

function hueFor(name) {
    let hash = 0;
    for (const ch of String(name || "")) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return hash;
}

function avatar(name, size = "") {
    if (!name) {
        return `<span class="avatar avatar-empty ${size}">?</span>`;
    }
    return `<span class="avatar ${size}" style="--hue:${hueFor(name)}">${escapeHTML(initials(name))}</span>`;
}

function statusPill(status) {
    const cls = {
        "Open": "status-open",
        "In Progress": "status-progress",
        "Closed": "status-closed"
    }[status] || "status-open";
    return `<span class="pill ${cls}"><span class="dot"></span>${escapeHTML(status)}</span>`;
}

function priorityBadge(priority) {
    const cls = ["High", "Medium", "Low"].includes(priority)
        ? `pri-${priority.toLowerCase()}`
        : "pri-low";
    return `<span class="priority"><i class="pri-icon ${cls}"></i>${escapeHTML(priority)}</span>`;
}

function toast(text, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span data-icon="${type === "error" ? "alert" : "check-circle"}"></span><span></span>`;
    el.lastElementChild.textContent = text;
    hydrateIcons(el);
    $("toasts").appendChild(el);
    setTimeout(() => {
        el.classList.add("leaving");
        setTimeout(() => el.remove(), 250);
    }, 3200);
}

/* ---------------------------------------------------------
   API
   --------------------------------------------------------- */
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

/* ---------------------------------------------------------
   Views
   --------------------------------------------------------- */
function showAuth() {
    authSection.hidden = false;
    appSection.hidden = true;
    userPanel.hidden = true;
}

function showApp() {
    authSection.hidden = true;
    appSection.hidden = false;
    userPanel.hidden = false;

    const roleLabel = isTechnician() ? "IT Technician" : "Employee";

    $("user-info").textContent = `${currentUser.name} (${roleLabel})`;
    $("sidebar-name").textContent = currentUser.name;
    $("sidebar-role").textContent = roleLabel;
    $("sidebar-avatar").outerHTML = avatar(currentUser.name).replace('class="avatar', 'id="sidebar-avatar" class="avatar');
    $("topbar-avatar").outerHTML = avatar(currentUser.name).replace('class="avatar', 'id="topbar-avatar" title="' + escapeHTML(`${currentUser.name} · ${roleLabel}`) + '" class="avatar');

    $("page-title").textContent = isTechnician() ? "Ticket queue" : "My support tickets";
    $("page-subtitle").textContent = isTechnician()
        ? "Triage, assign and resolve incoming IT requests."
        : "Raise an issue and track it until it's resolved.";
    $("nav-tickets-label").textContent = isTechnician() ? "Ticket queue" : "My tickets";

    ticketFilters.hidden = !isTechnician();

    if (isTechnician()) {
        setAssignment("mine");
        priorityFilter.value = "all";
    }
    setStatus("all");
    searchInput.value = "";
}

function logout() {
    accessToken = null;
    currentUser = null;
    tickets = [];
    technicians = [];

    closeDrawer();
    closeModal(ticketModal);
    closeModal(confirmModal);
    ticketList.textContent = "";
    appMessage.textContent = "";
    showAuth();
}

/* ---------------------------------------------------------
   Authentication
   --------------------------------------------------------- */
let registrationMode = false;

$("toggle-auth").addEventListener("click", () => {
    registrationMode = !registrationMode;

    $("login-form").hidden = registrationMode;
    $("register-form").hidden = !registrationMode;

    $("auth-heading").textContent = registrationMode ? "Create your account" : "Welcome back";
    $("auth-description").textContent = registrationMode
        ? "Register for an employee account."
        : "Sign in to manage your support tickets.";
    $("toggle-auth-text").textContent = registrationMode
        ? "Already have an account?"
        : "Don't have an account?";
    $("toggle-auth").textContent = registrationMode ? "Log in" : "Register";

    authMessage.textContent = "";
    authMessage.classList.remove("success");
});

function setBusy(form, busy, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy) {
        btn.dataset.label = btn.textContent;
        btn.textContent = label;
        btn.disabled = true;
    } else {
        btn.textContent = btn.dataset.label || btn.textContent;
        btn.disabled = false;
    }
}

$("register-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    authMessage.textContent = "";
    authMessage.classList.remove("success");

    const data = {
        name: $("register-name").value.trim(),
        email: $("register-email").value.trim(),
        password: $("register-password").value
    };

    setBusy(form, true, "Creating account…");
    try {
        await apiRequest("/register", {
            method: "POST",
            body: JSON.stringify(data)
        });

        form.reset();
        $("toggle-auth").click();

        $("login-email").value = data.email;
        authMessage.textContent = "Account created. You can now log in.";
        authMessage.classList.add("success");
    } catch (error) {
        authMessage.textContent = error.message;
    } finally {
        setBusy(form, false);
    }
});

$("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    authMessage.textContent = "";
    authMessage.classList.remove("success");

    const data = {
        email: $("login-email").value.trim(),
        password: $("login-password").value
    };

    setBusy(form, true, "Logging in…");
    try {
        const result = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify(data)
        });

        accessToken = result.access_token;
        currentUser = result.user;

        form.reset();

        if (isTechnician()) {
            await loadTechnicians();
        }

        showApp();
        await loadTickets();
    } catch (error) {
        authMessage.textContent = error.message;
    } finally {
        setBusy(form, false);
    }
});

$("logout-btn").addEventListener("click", logout);
$("logout-btn-mobile").addEventListener("click", logout);

/* ---------------------------------------------------------
   Data loading
   --------------------------------------------------------- */
// Only technicians can retrieve the assignment list.
async function loadTechnicians() {
    technicians = await apiRequest("/technicians");
}

async function loadTickets({ silent = false } = {}) {
    if (!silent) {
        isLoading = true;
        renderSkeleton();
    }
    try {
        tickets = await apiRequest("/tickets");
        appMessage.textContent = "";
    } catch (error) {
        appMessage.textContent = error.message;
        if (!tickets.length) {
            isLoading = false;
            ticketList.innerHTML = emptyState("alert", "Unable to load tickets", "Check your connection and try refreshing the page.");
            hydrateIcons(ticketList);
            return;
        }
    }
    isLoading = false;
    updateDashboard();
    displayTickets();
    if (openTicketId != null) renderDrawer();
}

function renderSkeleton() {
    ticketList.innerHTML = Array.from({ length: 5 }, () => `
        <div class="skeleton-row">
            <span class="sk" style="width:40px"></span>
            <span class="sk" style="flex:1;max-width:360px"></span>
            <span class="sk" style="width:70px"></span>
            <span class="sk" style="width:60px"></span>
            <span class="sk" style="width:120px"></span>
        </div>`).join("");
}

function updateDashboard() {
    const count = status => tickets.filter(ticket => ticket.status === status).length;

    $("total-tickets").textContent = tickets.length;
    $("open-tickets").textContent = count("Open");
    $("progress-tickets").textContent = count("In Progress");
    $("closed-tickets").textContent = count("Closed");

    if (isTechnician()) {
        $("count-all").textContent = tickets.length;
        $("count-mine").textContent = tickets.filter(isMine).length;
        $("count-unassigned").textContent = tickets.filter(t => t.assigned_to_id == null).length;
    }
}

function isMine(ticket) {
    return ticket.assigned_to_id != null &&
        Number(ticket.assigned_to_id) === Number(currentUser.id);
}

/* ---------------------------------------------------------
   Filters
   --------------------------------------------------------- */
function setAssignment(value) {
    assignmentFilter.value = value;
    ticketFilters.querySelectorAll("[data-assignment]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.assignment === value);
    });
}

function setStatus(value) {
    statusFilter.value = value;
    document.querySelectorAll(".tabs [data-status]").forEach(btn => {
        const active = btn.dataset.status === value;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active);
    });
}

ticketFilters.addEventListener("click", event => {
    const btn = event.target.closest("[data-assignment]");
    if (!btn) return;
    setAssignment(btn.dataset.assignment);
    displayTickets();
});

document.querySelector(".tabs").addEventListener("click", event => {
    const btn = event.target.closest("[data-status]");
    if (!btn) return;
    setStatus(btn.dataset.status);
    displayTickets();
});

priorityFilter.addEventListener("change", displayTickets);
searchInput.addEventListener("input", displayTickets);

function matchesSearch(ticket, query) {
    if (!query) return true;
    return [
        ticket.title,
        ticket.description,
        ticket.priority,
        ticket.status,
        ticket.assigned_to,
        ticket.created_by_name,
        ticket.created_by_email,
        `#${ticket.id}`
    ].some(value => String(value ?? "").toLowerCase().includes(query));
}

function matchesAssignment(ticket) {
    if (!isTechnician()) return true;
    const assignment = assignmentFilter.value;
    return assignment === "all" ||
        (assignment === "mine" && isMine(ticket)) ||
        (assignment === "unassigned" && ticket.assigned_to_id == null);
}

function matchesPriority(ticket) {
    if (!isTechnician()) return true;
    return priorityFilter.value === "all" || ticket.priority === priorityFilter.value;
}

/* ---------------------------------------------------------
   Ticket table
   --------------------------------------------------------- */
function emptyState(iconName, title, text, withButton = false) {
    return `
        <div class="empty">
            <span class="empty-icon" data-icon="${iconName}"></span>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(text)}</p>
            ${withButton ? `<button type="button" class="btn btn-primary" data-action="new">
                <span data-icon="plus"></span>New ticket</button>` : ""}
        </div>`;
}

function technicianOptions(assignedId) {
    const unassigned = `
        <option value="" ${assignedId == null ? "selected" : ""}>Unassigned</option>
    `;

    return unassigned + technicians.map(technician => `
        <option value="${technician.id}"
            ${Number(technician.id) === Number(assignedId) ? "selected" : ""}>
            ${escapeHTML(technician.name)}
        </option>
    `).join("");
}

function assigneeCell(ticket) {
    if (isTechnician()) {
        return `
            <div class="assign-inline">
                ${avatar(ticket.assigned_to, "avatar-sm")}
                <select class="assignment-select"
                        data-ticket-id="${ticket.id}"
                        aria-label="Assign ticket #${ticket.id}">
                    ${technicianOptions(ticket.assigned_to_id)}
                </select>
            </div>`;
    }
    return `
        <div class="person">
            ${avatar(ticket.assigned_to, "avatar-sm")}
            <span class="person-name ${ticket.assigned_to ? "" : "unassigned"}">
                ${escapeHTML(ticket.assigned_to || "Unassigned")}
            </span>
        </div>`;
}

function displayTickets() {
    if (isLoading || !currentUser) return;

    const query = searchInput.value.trim().toLowerCase();

    // Counts on the status tabs reflect every filter except status.
    const base = tickets.filter(ticket =>
        matchesSearch(ticket, query) && matchesAssignment(ticket) && matchesPriority(ticket));

    document.querySelectorAll(".tabs [data-status]").forEach(btn => {
        const s = btn.dataset.status;
        const n = s === "all" ? base.length : base.filter(t => t.status === s).length;
        let badge = btn.querySelector(".tab-count");
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "tab-count";
            btn.appendChild(badge);
        }
        badge.textContent = n;
    });

    const filtered = base.filter(ticket =>
        statusFilter.value === "all" || ticket.status === statusFilter.value);

    // Newest first.
    filtered.sort((a, b) => b.id - a.id);

    if (filtered.length === 0) {
        if (tickets.length === 0) {
            ticketList.innerHTML = isTechnician()
                ? emptyState("inbox", "The queue is empty", "No tickets have been raised yet. Nice.")
                : emptyState("inbox", "No tickets yet", "When something isn't working, raise a ticket and the IT team will pick it up.", true);
        } else {
            ticketList.innerHTML = emptyState("folder-search", "No matching tickets", "Try a different search or clear some filters.");
        }
        hydrateIcons(ticketList);
        return;
    }

    const tech = isTechnician();

    ticketList.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th class="col-id">ID</th>
                    <th class="col-title">Subject</th>
                    <th class="col-status">Status</th>
                    <th class="col-priority">Priority</th>
                    ${tech ? `<th class="col-requester">Requester</th>` : ""}
                    <th class="col-assignee">${tech ? "Assignee" : "Assigned to"}</th>
                    <th class="col-go" aria-hidden="true"></th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(ticket => `
                    <tr tabindex="0" data-id="${ticket.id}" aria-label="Open ticket #${ticket.id}">
                        <td class="col-id">#${ticket.id}</td>
                        <td class="col-title">
                            <div class="t-title">${escapeHTML(ticket.title)}</div>
                            <div class="t-desc">${escapeHTML(ticket.description)}</div>
                        </td>
                        <td class="col-status">${statusPill(ticket.status)}</td>
                        <td class="col-priority">${priorityBadge(ticket.priority)}</td>
                        ${tech ? `
                        <td class="col-requester">
                            <div class="person">
                                ${avatar(ticket.created_by_name || "?", "avatar-sm")}
                                <span class="person-name">${escapeHTML(ticket.created_by_name || "Unknown")}</span>
                            </div>
                        </td>` : ""}
                        <td class="col-assignee">${assigneeCell(ticket)}</td>
                        <td class="col-go"><span data-icon="chevron-right"></span></td>
                    </tr>
                `).join("")}
            </tbody>
        </table>`;

    hydrateIcons(ticketList);
}

// Open a ticket when its row is clicked (but not when using the inline select).
ticketList.addEventListener("click", event => {
    if (event.target.closest("[data-action='new']")) {
        openTicketModal();
        return;
    }
    if (event.target.closest("select")) return;
    const row = event.target.closest("tr[data-id]");
    if (row) openDrawer(Number(row.dataset.id));
});

ticketList.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("tr[data-id]");
    if (row && event.target === row) {
        event.preventDefault();
        openDrawer(Number(row.dataset.id));
    }
});

/* ---------------------------------------------------------
   Assignment (technicians only)
   --------------------------------------------------------- */
async function assignTicket(select) {
    if (!isTechnician()) return;

    const id = Number(select.dataset.ticketId);
    const newAssignment = select.value ? Number(select.value) : null;

    select.disabled = true;

    try {
        await apiRequest(`/tickets/${id}`, {
            method: "PUT",
            body: JSON.stringify({ assigned_to_id: newAssignment })
        });

        const tech = technicians.find(t => Number(t.id) === newAssignment);
        toast(newAssignment == null
            ? `Ticket #${id} unassigned`
            : `Ticket #${id} assigned to ${tech?.name ?? "technician"}`);
    } catch (error) {
        toast(error.message, "error");
    }
    await loadTickets({ silent: true });
}

document.addEventListener("change", event => {
    const select = event.target.closest(".assignment-select");
    if (select) assignTicket(select);
});

/* ---------------------------------------------------------
   Detail drawer
   --------------------------------------------------------- */
let lastFocus = null;

function openDrawer(id) {
    openTicketId = id;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    renderDrawer();
    drawer.querySelector(".drawer-head .icon-btn")?.focus();
}

function closeDrawer() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    openTicketId = null;
    lastFocus?.focus?.();
}

function renderDrawer() {
    const ticket = tickets.find(t => t.id === openTicketId);
    if (!ticket) {
        closeDrawer();
        return;
    }

    const tech = isTechnician();
    const email = ticket.created_by_email;
    const mailto = email
        ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`CloudDesk Ticket #${ticket.id} - ${ticket.title}`)}`
        : null;

    drawerBody.innerHTML = `
        <div class="drawer-head">
            <span class="drawer-id">Ticket #${ticket.id}</span>
            <button type="button" class="icon-btn" data-close aria-label="Close">
                <span data-icon="x"></span>
            </button>
        </div>

        <div class="drawer-scroll">
            <h2 class="drawer-title" id="drawer-title">${escapeHTML(ticket.title)}</h2>

            <div class="drawer-pills">
                ${statusPill(ticket.status)}
                ${priorityBadge(ticket.priority)}
            </div>

            <div class="section-label">Description</div>
            <p class="drawer-desc">${escapeHTML(ticket.description)}</p>

            <div class="section-label">Details</div>
            <dl class="props">
                ${tech ? `
                    <dt>Requester</dt>
                    <dd>
                        <div class="person">
                            ${avatar(ticket.created_by_name || "?")}
                            <div style="min-width:0">
                                <div class="person-name">${escapeHTML(ticket.created_by_name || "Unknown")}</div>
                                <div class="person-email">
                                    ${mailto
                                        ? `<a href="${mailto}">${escapeHTML(email)}</a>`
                                        : "Email not available"}
                                </div>
                            </div>
                        </div>
                    </dd>
                    <dt><label for="assign-${ticket.id}">Assignee</label></dt>
                    <dd>
                        <select id="assign-${ticket.id}"
                                class="assignment-select"
                                data-ticket-id="${ticket.id}">
                            ${technicianOptions(ticket.assigned_to_id)}
                        </select>
                    </dd>
                ` : `
                    <dt>Assigned to</dt>
                    <dd>
                        <div class="person">
                            ${avatar(ticket.assigned_to, "avatar-sm")}
                            <span class="person-name ${ticket.assigned_to ? "" : "unassigned"}">
                                ${escapeHTML(ticket.assigned_to || "Not yet assigned")}
                            </span>
                        </div>
                    </dd>
                `}
                <dt>Status</dt>
                <dd>${statusPill(ticket.status)}</dd>
                <dt>Priority</dt>
                <dd>${priorityBadge(ticket.priority)}</dd>
            </dl>
        </div>

        <div class="drawer-foot">
            <button type="button" class="btn btn-ghost" data-action="edit">
                <span data-icon="pencil"></span>Edit
            </button>
            ${tech && mailto ? `
                <a class="btn btn-ghost" href="${mailto}" style="text-decoration:none">
                    <span data-icon="mail"></span>Email
                </a>` : ""}
            <span class="spacer"></span>
            ${tech ? `
                <button type="button" class="btn btn-danger-ghost" data-action="delete">
                    <span data-icon="trash"></span>Delete
                </button>
                ${ticket.status !== "Closed" ? `
                    <button type="button" class="btn btn-primary" data-action="close">
                        <span data-icon="check"></span>Close ticket
                    </button>` : ""}
            ` : ""}
        </div>
    `;

    hydrateIcons(drawerBody);
}

drawer.addEventListener("click", async event => {
    if (event.target.closest("[data-close]")) {
        closeDrawer();
        return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const ticket = tickets.find(t => t.id === openTicketId);
    if (!ticket) return;

    const action = button.dataset.action;

    if (action === "edit") {
        openTicketModal(ticket);
    } else if (action === "close" && isTechnician()) {
        button.disabled = true;
        try {
            await apiRequest(`/tickets/${ticket.id}`, {
                method: "PUT",
                body: JSON.stringify({ status: "Closed" })
            });
            toast(`Ticket #${ticket.id} closed`);
            await loadTickets({ silent: true });
        } catch (error) {
            button.disabled = false;
            toast(error.message, "error");
        }
    } else if (action === "delete" && isTechnician()) {
        const ok = await confirmDialog(
            `Delete ticket #${ticket.id}?`,
            `"${ticket.title}" will be permanently removed. This can't be undone.`
        );
        if (!ok) return;
        try {
            await apiRequest(`/tickets/${ticket.id}`, { method: "DELETE" });
            closeDrawer();
            toast(`Ticket #${ticket.id} deleted`);
            await loadTickets({ silent: true });
        } catch (error) {
            toast(error.message, "error");
        }
    }
});

/* ---------------------------------------------------------
   Create / edit modal
   --------------------------------------------------------- */
function openModal(modal) {
    modal.hidden = false;
}

function closeModal(modal) {
    modal.hidden = true;
}

function openTicketModal(ticket = null) {
    editingTicketId = ticket ? ticket.id : null;
    ticketForm.reset();
    $("modal-message").textContent = "";

    $("modal-title").textContent = ticket ? `Edit ticket #${ticket.id}` : "New ticket";
    $("modal-submit").textContent = ticket ? "Save changes" : "Create ticket";
    $("priority-field").hidden = Boolean(ticket);

    if (ticket) {
        $("title").value = ticket.title;
        $("description").value = ticket.description;
    }

    openModal(ticketModal);
    $("title").focus();
}

$("new-ticket-btn").addEventListener("click", () => openTicketModal());

ticketModal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) closeModal(ticketModal);
});

// Keep the hidden <select id="priority"> in sync with the radio picker.
ticketForm.addEventListener("change", event => {
    if (event.target.name === "priority-choice") {
        $("priority").value = event.target.value;
    }
});

ticketForm.addEventListener("reset", () => {
    setTimeout(() => {
        $("priority").value = "Medium";
        const medium = ticketForm.querySelector('input[name="priority-choice"][value="Medium"]');
        if (medium) medium.checked = true;
    });
});

// All logged-in users can create and edit tickets.
ticketForm.addEventListener("submit", async event => {
    event.preventDefault();
    const message = $("modal-message");

    const title = $("title").value.trim();
    const description = $("description").value.trim();

    if (!title || !description) {
        message.textContent = "Title and description are required.";
        return;
    }

    const submit = $("modal-submit");
    submit.disabled = true;

    try {
        if (editingTicketId == null) {
            await apiRequest("/tickets", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description,
                    priority: $("priority").value
                })
            });
            toast("Ticket created");
        } else {
            await apiRequest(`/tickets/${editingTicketId}`, {
                method: "PUT",
                body: JSON.stringify({ title, description })
            });
            toast(`Ticket #${editingTicketId} updated`);
        }

        closeModal(ticketModal);
        ticketForm.reset();
        await loadTickets({ silent: true });
    } catch (error) {
        message.textContent = error.message;
    } finally {
        submit.disabled = false;
    }
});

/* ---------------------------------------------------------
   Confirm dialog
   --------------------------------------------------------- */
function confirmDialog(title, text) {
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    openModal(confirmModal);
    $("confirm-ok").focus();

    return new Promise(resolve => {
        const done = result => {
            confirmModal.removeEventListener("click", onClick);
            closeModal(confirmModal);
            resolve(result);
        };
        const onClick = event => {
            if (event.target.closest("#confirm-ok")) done(true);
            else if (event.target.closest("[data-close]")) done(false);
        };
        confirmModal.addEventListener("click", onClick);
    });
}

/* ---------------------------------------------------------
   Keyboard shortcuts
   --------------------------------------------------------- */
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (!confirmModal.hidden) confirmModal.querySelector("[data-close]").click();
        else if (!ticketModal.hidden) closeModal(ticketModal);
        else closeDrawer();
        return;
    }

    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (typing || appSection.hidden || !ticketModal.hidden) return;

    if (event.key === "/") {
        event.preventDefault();
        searchInput.focus();
    } else if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        openTicketModal();
    }
});

/* ---------------------------------------------------------
   Theme
   --------------------------------------------------------- */
function applyThemeIcon() {
    const dark = document.documentElement.dataset.theme === "dark";
    const btn = $("theme-toggle");
    btn.innerHTML = `<span data-icon="${dark ? "sun" : "moon"}"></span>`;
    hydrateIcons(btn);
}

$("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("clouddesk-theme", next); } catch {}
    applyThemeIcon();
});

// Keep tokens in memory rather than browser storage.
// Users log in again after refreshing the page.

hydrateIcons();
applyThemeIcon();
showAuth();
