# CloudDesk — Cloud-Based IT Support Ticketing System

## 1. Project Overview

CloudDesk is a cloud-based IT support ticketing application developed for the INFS3208 Cloud Computing individual project.

The application allows users to create, view, search, update, close and delete IT support tickets through a web-based dashboard.

CloudDesk is deployed on Google Cloud using Kubernetes (K3s), Docker containers, FastAPI, Nginx and PostgreSQL.

## 2. Application Features

- **Create tickets:** Submit new IT support requests with a title, description and priority.
- **View tickets:** Display support tickets in a dashboard.
- **Search tickets:** Find existing tickets.
- **Edit tickets:** Update ticket information.
- **Close tickets:** Mark tickets as resolved or closed.
- **Delete tickets:** Remove tickets from the system.
- **Dashboard statistics:** View ticket counts and status information.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Web server | Nginx |
| Backend | Python, FastAPI |
| Database | PostgreSQL 17 |
| Containerisation | Docker |
| Container orchestration | Kubernetes (K3s) |
| Cloud provider | Google Cloud Platform |
| Cloud infrastructure | Compute Engine e2-medium VM |
| Operating system | Ubuntu 22.04 |

## 4. System Architecture

CloudDesk uses a containerised, multi-tier architecture.

**User Browser → Google Cloud VM → Kubernetes NodePort → Nginx Frontend → FastAPI Backend → PostgreSQL Database**

The Kubernetes deployment consists of:

- 2 frontend replicas
- 2 backend replicas
- 1 PostgreSQL replica
- A PostgreSQL PersistentVolumeClaim
- Kubernetes Services for communication between components
- A Kubernetes Secret for database credentials

The frontend serves the website and forwards `/api/` requests to the backend. The backend processes requests and stores ticket information in PostgreSQL.

## 5. Cloud Deployment

CloudDesk is deployed to a Google Compute Engine virtual machine in the Sydney region (`australia-southeast1`).

The VM runs K3s, a lightweight Kubernetes distribution.

The application is publicly accessible through the VM's external IP address using Kubernetes NodePort `30080`.

The current deployment uses HTTP without authentication and is intended for academic demonstration, not production use.

## 6. Kubernetes Features

### Horizontal Scaling

The backend deployment can be scaled using:

```bash
sudo k3s kubectl scale deployment clouddesk-backend --replicas=4
```

Return to two replicas:

```bash
sudo k3s kubectl scale deployment clouddesk-backend --replicas=2
```

### Self-Healing

Kubernetes automatically replaces failed pods to maintain the desired replica count.

Example:

```bash
sudo k3s kubectl get pods
sudo k3s kubectl delete pod <backend-pod-name>
sudo k3s kubectl get pods
```

### Rolling Updates

Kubernetes Deployments support controlled updates:

```bash
sudo k3s kubectl set image deployment/clouddesk-backend backend=clouddesk-backend:1.1
sudo k3s kubectl rollout status deployment/clouddesk-backend
```

The updated image must first be available to the K3s container runtime.

### Rollback

A previous deployment revision can be restored using:

```bash
sudo k3s kubectl rollout undo deployment/clouddesk-backend
```

### Persistent Storage

PostgreSQL uses a Kubernetes PersistentVolumeClaim so ticket data can survive database pod replacement. Storage is local to the VM and is not a substitute for off-VM backups.

## 7. Deployment Instructions

### Prerequisites

- Ubuntu Linux VM
- Docker
- K3s
- Project source code
- Sufficient disk space and memory

### Step 1 — Build Docker Images

From the project directory:

```bash
sudo docker build -t clouddesk-backend:1.0 ./backend
sudo docker build -t clouddesk-frontend:1.1 ./frontend
```

### Step 2 — Import Images into K3s

```bash
sudo docker save clouddesk-backend:1.0 | sudo k3s ctr images import -
sudo docker save clouddesk-frontend:1.1 | sudo k3s ctr images import -
```

### Step 3 — Create Database Credentials

Generate a password and create the Kubernetes Secret:

```bash
DB_PASSWORD=$(openssl rand -hex 24)

sudo k3s kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
  --from-literal=database-url="postgresql+psycopg://clouddesk:${DB_PASSWORD}@postgres:5432/clouddesk"
```

The Secret file containing local development credentials is excluded from Git.

### Step 4 — Deploy PostgreSQL

```bash
sudo k3s kubectl apply -f kubernetes/postgres.yaml
sudo k3s kubectl rollout status deployment/postgres
```

### Step 5 — Initialise the Database

```bash
sudo k3s kubectl exec deployment/postgres -- \
  psql -U clouddesk -d clouddesk -c \
  "CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    priority VARCHAR NOT NULL
  );"
```

### Step 6 — Deploy the Backend and Frontend

```bash
sudo k3s kubectl apply -f kubernetes/backend.yaml
sudo k3s kubectl apply -f kubernetes/frontend.yaml
```

### Step 7 — Verify Deployment

```bash
sudo k3s kubectl get pods
sudo k3s kubectl get services
sudo k3s kubectl get pvc
```

Expected application pods:

- 2 frontend pods
- 2 backend pods
- 1 PostgreSQL pod

### Step 8 — Configure Public Access

Allow inbound TCP traffic on port `30080` through the Google Cloud firewall, restricting the source IP range where practical.

Open:

`http://<VM_EXTERNAL_IP>:30080`

## 8. Reliability and Limitations

CloudDesk demonstrates application-level reliability through Kubernetes replicas, readiness probes, pod replacement and rolling updates.

However, the current deployment runs on a single Compute Engine VM. The VM itself remains a single point of failure, and PostgreSQL is not replicated.

This deployment demonstrates Kubernetes orchestration and application-level recovery rather than full infrastructure-level high availability.

## 9. Security

- Database credentials are stored in a Kubernetes Secret.
- Database credentials are excluded from the Git repository.
- PostgreSQL is accessible through an internal Kubernetes Service.
- Only the frontend application port is intentionally exposed publicly.
- The application currently does not provide user authentication or HTTPS.

## 10. Cost Management

CloudDesk uses a small Compute Engine VM rather than a managed GKE cluster to reduce costs.

The deployment uses an e2-medium instance with 2 shared vCPUs and 4 GB RAM, along with a 20 GB standard persistent disk.

A Google Cloud billing budget alert is configured to help monitor spending. Budget alerts do not automatically stop charges.

Cloud resources should be deleted when the assignment demonstration is complete.

## 11. Project Structure

```text
CloudDesk/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   └── create_tables.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── style.css
│   └── script.js
├── kubernetes/
│   ├── backend.yaml
│   ├── frontend.yaml
│   └── postgres.yaml
├── README.md
└── .gitignore
```

## 12. Future Improvements

Possible future enhancements include user authentication, HTTPS, automated database migrations, monitoring, automated backups and multi-node Kubernetes deployment.