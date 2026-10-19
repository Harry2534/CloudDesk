CloudDesk — Cloud-Based IT Support Ticketing System
1. Project Overview
CloudDesk is a cloud-based IT support ticketing application developed for the INFS3208 Cloud Computing individual project at the University of Queensland.
The project follows Type I: Highly Scalable and Available Web Application. It demonstrates containerisation, multi-host Kubernetes orchestration, application replication, service-based load balancing, persistent storage, rolling updates and rollback capabilities.
CloudDesk is hosted on Google Compute Engine using two Ubuntu virtual machines forming a single K3s Kubernetes cluster.
2. Application Features
CloudDesk provides:
User registration and login with JWT authentication.
Employee and technician roles with different permissions.
Ticket creation with a title, description and priority.
Ticket viewing, searching and editing.
Ticket assignment to registered technicians.
Ticket status updates and closure.
Ticket deletion where permitted.
Dashboard statistics for support tickets.
Technician ticket filtering by assignment (mine, all or unassigned), priority and status.
Employees can manage their own tickets. Technicians can view tickets across the system, assign tickets, filter the ticket list and manage their resolution.
3. Technology Stack
| Component | Technology |
|---|---|
| Cloud platform | Google Cloud Platform |
| Compute | Google Compute Engine |
| Operating system | Ubuntu 22.04 |
| Container image building | Docker |
| Container runtime | K3s containerd |
| Container orchestration | Kubernetes (K3s) |
| Frontend | HTML, CSS, JavaScript |
| Frontend web server | Nginx |
| Backend | Python 3.12, FastAPI |
| Database | PostgreSQL 17 |
| ORM | SQLAlchemy |
| Authentication | JWT and hashed passwords |
| Persistent storage | Kubernetes PVC with K3s local-path storage |
4. Cloud Infrastructure
CloudDesk runs on two Google Compute Engine virtual machines in the Sydney region, zone `australia-southeast1-b`.
Node 1 — clouddesk-vm
- Machine type: e2-medium
- 2 vCPUs and 4 GB RAM
- Ubuntu 22.04
- 20 GB standard persistent boot disk
- K3s server and Kubernetes control plane
- One frontend replica
- One backend replica
- One PostgreSQL database pod
- Database persistent storage
- Public IP for website access
Node 2 — clouddesk-worker
- Machine type: e2-small
- 2 shared vCPUs and 2 GB RAM
- Ubuntu 22.04
- 20 GB standard persistent boot disk
- K3s agent and Kubernetes worker
- One frontend replica
- One backend replica
- No public IP
Both VMs communicate through Google Cloud's private VPC network.
The worker can be accessed administratively using Google Cloud IAP tunnelling.
5. System Architecture
Application request flow:
Browser
  |
  v
Google Cloud public IP, TCP port 30080
  |
  v
Kubernetes frontend NodePort Service
  |
  +-- Frontend pod 1 (main VM)
  |
  +-- Frontend pod 2 (worker VM)
  |
  v
Nginx forwards /api/ requests
  |
  v
Kubernetes backend ClusterIP Service
  |
  +-- FastAPI pod 1 (main VM)
  |
  +-- FastAPI pod 2 (worker VM)
  |
  v
PostgreSQL ClusterIP Service
  |
  v
PostgreSQL 17 (main VM)
  |
  v
PersistentVolumeClaim (1 GiB)
Kubernetes Services distribute requests across ready application replicas.
Frontend and backend Deployments each have two replicas. Required pod anti-affinity distributes each pair across the two Kubernetes nodes.
PostgreSQL uses one replica and persistent storage. It is not replicated across the nodes.
6. Database Design
The database contains two main tables.
users
- id: Primary key
- name: User's name
- email: Unique email address
- password_hash: Hashed password
- role: employee or technician
tickets
- id: Primary key
- title: Ticket title
- description: Problem description
- status: Ticket status
- priority: Ticket priority
- assigned_to: Legacy assignment text field
- created_by_id: Foreign key to users.id
- assigned_to_id: Foreign key to users.id
One user can create multiple tickets.
A technician can be assigned multiple tickets.
The backend uses SQLAlchemy to interact with PostgreSQL.
`backend/create_tables.py` creates missing database tables.
`backend/migrate_assignments.py` adds the newer ticket ownership and assignment columns to an older database schema. It does not replace a full database migration framework.
7. Container Images
Current application image versions:
- Backend: `clouddesk-backend:1.4`
- Frontend: `clouddesk-frontend:1.5`
- Database: `postgres:17`
The frontend Docker image uses Nginx to serve the website.
The backend Docker image uses Python 3.12 and starts FastAPI through Uvicorn.
The backend container runs `create_tables.py` before starting the API.
Images are built using Docker, transferred to both Google Cloud VMs and imported into the K3s containerd image store.
The current project does not use a remote container registry.
8. Deployment Instructions
Prerequisites
- Google Cloud project with billing enabled
- Two Ubuntu Compute Engine VMs
- K3s server installed on the main VM
- K3s agent joined to the cluster on the worker VM
- Appropriate private-network firewall rules for K3s
- TCP port 30080 allowed for website access
- Docker installed on the development computer
- Google Cloud CLI configured
- CloudDesk source code
Step 1 — Build application images
From the CloudDesk project directory on the development computer:
```bash

docker build -t clouddesk-backend:1.4 ./backend

docker build -t clouddesk-frontend:1.5 ./frontend

```
Step 2 — Export images
```bash

docker save clouddesk-backend:1.4 | gzip > /tmp/clouddesk-backend-1.4.tar.gz

docker save clouddesk-frontend:1.5 | gzip > /tmp/clouddesk-frontend-1.5.tar.gz

```
Step 3 — Transfer images to both VMs
For the main VM:
```bash

gcloud compute scp /tmp/clouddesk-backend-1.4.tar.gz /tmp/clouddesk-frontend-1.5.tar.gz clouddesk-vm:~/ --zone=australia-southeast1-b

```
For the worker VM:
```bash

gcloud compute scp /tmp/clouddesk-backend-1.4.tar.gz /tmp/clouddesk-frontend-1.5.tar.gz clouddesk-worker:~/ --zone=australia-southeast1-b --tunnel-through-iap

```
Step 4 — Import images into K3s
Run on both VMs:
```bash

gunzip -c ~/clouddesk-backend-1.4.tar.gz | sudo k3s ctr images import -

gunzip -c ~/clouddesk-frontend-1.5.tar.gz | sudo k3s ctr images import -

```
Step 5 — Create Kubernetes Secrets
On the main VM, generate database and JWT credentials:
```bash

DB_PASSWORD=$(openssl rand -hex 24)

JWT_SECRET=$(openssl rand -hex 32)

```
Create the PostgreSQL Secret:
```bash

sudo k3s kubectl create secret generic postgres-secret \

  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \

  --from-literal=database-url="postgresql+psycopg://clouddesk:${DB_PASSWORD}@postgres:5432/clouddesk"

```
Create the authentication Secret:
```bash

sudo k3s kubectl create secret generic clouddesk-auth-secret \

  --from-literal=jwt-secret="$JWT_SECRET"

```
For an existing deployment, preserve its original credentials and Secrets. Do not replace database credentials without coordinating a database password change.
Step 6 — Deploy PostgreSQL
Transfer the Kubernetes YAML files to the main VM, then run:
```bash

sudo k3s kubectl apply -f ~/kubernetes/postgres.yaml

sudo k3s kubectl rollout status deployment/postgres

```
PostgreSQL uses the `postgres-pvc` PersistentVolumeClaim for storage.
Step 7 — Deploy frontend and backend
```bash

sudo k3s kubectl apply -f ~/kubernetes/backend.yaml

sudo k3s kubectl apply -f ~/kubernetes/frontend.yaml

```
Check the Deployments:
```bash

sudo k3s kubectl get deployments

sudo k3s kubectl get pods -o wide

sudo k3s kubectl get services

sudo k3s kubectl get pvc

```
Expected application/database workloads:
- 2 frontend pods
- 2 backend pods
- 1 PostgreSQL pod
Step 8 — Access CloudDesk
Find the current public IP of the main VM in Google Cloud Console.
Open:
`http://<MAIN_VM_PUBLIC_IP>:30080`
The public IP may change when the VM is stopped and restarted unless a static external IP is reserved.
9. Kubernetes Orchestration
Multi-node deployment
The cluster has one K3s server node and one K3s worker node.
Verify the cluster:
```bash

sudo k3s kubectl get nodes

```
Verify pod placement:
```bash

sudo k3s kubectl get pods -o wide

```
Frontend and backend replicas are distributed across the two nodes.
Load balancing
The frontend NodePort Service distributes requests to ready frontend pods.
The backend ClusterIP Service distributes API requests to ready backend pods.
PostgreSQL is accessed through an internal ClusterIP Service.
Horizontal scaling
Kubernetes supports changing the desired replica count:
```bash

sudo k3s kubectl scale deployment/clouddesk-backend --replicas=2

```
The current configuration uses required pod anti-affinity, so only one backend replica can be scheduled per node.
Scaling above two backend replicas requires additional nodes or a scheduling configuration change.
Self-healing
Kubernetes attempts to replace failed pods to maintain the configured replica count.
Example:
```bash

sudo k3s kubectl get pods

sudo k3s kubectl delete pod <BACKEND_POD_NAME>

sudo k3s kubectl get pods -w

```
Rolling updates
Frontend and backend Deployments use the RollingUpdate strategy:
- maxSurge: 0
- maxUnavailable: 1
Kubernetes replaces application replicas gradually during deployment updates.
Example:
```bash

sudo k3s kubectl rollout status deployment/clouddesk-backend

```
Rollback
Kubernetes can restore a previous Deployment revision:
```bash

sudo k3s kubectl rollout history deployment/clouddesk-backend

sudo k3s kubectl rollout undo deployment/clouddesk-backend

```
A previous container image must be available to the runtime.
Rollback should be tested carefully when application versions have different authentication or database requirements.
10. Authentication and Security
CloudDesk uses JWT-based authentication.
Users register with an email address and password.
Passwords are stored as hashes rather than plaintext.
The backend validates authentication tokens and applies role-based access rules.
Newly registered users receive the employee role.
Technician accounts require an administrative role change.
Kubernetes Secrets store database credentials and the JWT signing secret.
The database is exposed only through an internal Kubernetes Service.
The website currently uses HTTP rather than HTTPS. Therefore, the deployment is intended for academic demonstration with test credentials, not production use.
Sensitive files, including `.env`, `.jwt-secret`, private keys and Kubernetes Secret manifests containing actual credentials, must not be included in public repositories or submission archives.
11. Reliability and Limitations
CloudDesk demonstrates:
- Multi-host Kubernetes orchestration.
- Two frontend replicas.
- Two backend replicas.
- Service-based traffic distribution.
- Readiness probes.
- Pod replacement and recovery.
- Controlled rolling updates.
- Rollback support.
- PostgreSQL persistent storage.
Limitations:
- PostgreSQL has only one replica.
- The K3s control plane runs on one VM.
- Both VMs are located in the same Google Cloud zone.
- PostgreSQL storage uses node-local storage.
- The application does not currently use HTTPS.
- Docker images are manually distributed rather than stored in a registry.
- Database backups are not yet automated.
Consequently, CloudDesk provides application-level redundancy but not full high availability.
12. Cloud Cost Management
The infrastructure uses:
- One e2-medium Compute Engine VM.
- One e2-small Compute Engine VM.
- Two 20 GB standard persistent disks.
- An external IPv4 address for the main VM.
- Google Cloud networking.
- Self-managed K3s rather than managed GKE.
The estimated 24/7 operating cost is approximately AUD $90–$120 per month, depending on actual regional pricing, network traffic, taxes and exchange rates.
The VMs can be stopped when not required to reduce compute charges. Persistent disks can continue to incur charges while stopped.
Google Cloud Billing should be monitored regularly.
13. Project Structure
```text
CloudDesk/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── auth.py
│   ├── create_tables.py
│   ├── migrate_assignments.py
│   └── promote_technician.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── nginx.local.conf
│   ├── index.html
│   ├── style.css
│   └── script.js
├── kubernetes/
│   ├── backend.yaml
│   ├── frontend.yaml
│   └── postgres.yaml
├── compose.yaml
├── clouddesk_demo_seed.sql
├── dev_server.py
├── README.md
└── .gitignore
```
The local project also contains development-only files such as `.env`, `backend/.env`, `backend/.jwt-secret`, and `kubernetes/postgres-secret.yaml`. These are omitted from the submission if they contain real credentials. The submitted configuration must not contain active secrets.
14. Local Development with Docker Compose
CloudDesk can also be run locally using Docker Compose, independently of the Google Cloud K3s cluster.
Install Docker Engine and Docker Compose.
Configure the local environment variables and database credentials as required by `compose.yaml` (do not commit or submit actual secrets).
From the project root, run:
```bash
docker compose up --build -d
```
Open `http://localhost:5500` in a browser.
To inspect services or stop them, run:
```bash
docker compose ps
docker compose down
```
The local Nginx configuration is `frontend/nginx.local.conf` and proxies API traffic to the Docker Compose backend service. The Kubernetes frontend uses `frontend/nginx.conf`, which proxies to the `clouddesk-backend` Kubernetes Service. The local Compose setup and cloud deployment therefore use different upstream hostnames.
15. Future Improvements

Potential improvements include:
- HTTPS using TLS certificates.
- PostgreSQL replication or managed database hosting.
- A highly available Kubernetes control plane.
- Multi-zone deployment.
- Automated database backups and recovery.
- Container image registry and CI/CD pipeline.
- Monitoring, logging and alerting.
- Kubernetes resource limits and autoscaling.
16. Assignment Demonstration
The project demonstration can cover:
Background and motivation.
Cloud architecture and two-node Kubernetes cluster.
Frontend and backend containerisation.
PostgreSQL database design.
User registration, login and ticket operations.
Employee and technician permissions, including ticket filters.
Kubernetes replica distribution and load balancing.
Scaling and pod self-healing.
Rolling updates and rollback.
Results, limitations and future improvements.