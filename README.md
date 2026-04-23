# Budget Manager

Personal budgeting app with a **frontend** (React + Vite), **API** (PHP + Apache), and **MySQL**, orchestrated with **Docker Compose**.

---

## Prerequisites

Install on your machine:

1. **Docker Desktop** (includes Docker Compose v2)  
   - [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

2. **Node.js** (LTS recommended, e.g. 20 or 22) and **npm**  
   - [https://nodejs.org/](https://nodejs.org/)

3. **Git** (optional, if you clone the repository)

Verify in a terminal (PowerShell on Windows; use the same commands in bash/zsh on macOS/Linux where applicable):

```powershell
docker --version
docker compose version
node --version
npm --version
```

---

## 1. Get the code

If you do not have the project yet:

```powershell
git clone <YOUR-REPO-URL> budget-manager
cd budget-manager
```

If you already have it, go to the project folder:

```powershell
cd C:\path\to\budget-manager
```

---

## 2. Run the full stack with Docker (recommended)

This builds images when needed, creates the database from `database/schema.sql`, and starts **MySQL**, the **API**, and the **compiled** frontend (served by Nginx).

```powershell
docker compose up --build -d
```

- Wait until the `db` container is **healthy** (Compose waits for this before starting the API).

### Default URLs

| Service | URL | Notes |
|---------|-----|--------|
| **Web app** | [http://localhost:8080](http://localhost:8080) | Port is configurable with `WEB_PORT` |
| **API (via Nginx)** | [http://localhost:8080/api/health](http://localhost:8080/api/health) | The `web` service proxies `/api` to the PHP container |

### Change the web port (optional)

In PowerShell, before `docker compose up`:

```powershell
$env:WEB_PORT = "9090"
docker compose up --build -d
```

Then open `http://localhost:9090`.

### Smoke test

```powershell
# Windows PowerShell
Invoke-RestMethod "http://localhost:8080/api/health" -Method Get
```

You should see something like `ok: true` (or equivalent JSON).

---

## 3. Frontend development with hot reload (Vite)

To work on React with **hot reload** while the API and database stay in Docker:

### 3.1 Keep the Docker stack running

You need **db + api + web** running. The `web` container on port **8080** proxies `/api` to the PHP API.

```powershell
docker compose up -d
```

### 3.2 Install frontend dependencies (first time, or after `package.json` changes)

```powershell
cd frontend
npm install
cd ..
```

### 3.3 Start the Vite dev server

```powershell
cd frontend
npm run dev
```

By default Vite listens on port **5173**. `frontend/vite.config.js` **proxies** requests starting with `/api` to `http://127.0.0.1:8080` (the Nginx container), which forwards them to the API.

Open in the browser:

**[http://localhost:5173](http://localhost:5173)**

> If you change Docker’s web port (`WEB_PORT`), update the `proxy` `target` in `frontend/vite.config.js` to match.

### 3.4 Useful frontend commands

```powershell
cd frontend
npm run dev     # development server
npm run build   # production build (writes to frontend/dist)
npm run preview # serve dist locally (after a build)
```

---

## 4. Optional: serve a local `dist` without rebuilding the `web` image

To build on your machine and let the Nginx container serve the mounted folder:

```powershell
cd frontend
npm run build
cd ..
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

After each frontend change, run `npm run build` again in `frontend/` and refresh the browser. See comments in `docker-compose.dev.yml` for details.

---

## 5. Stop and clean up containers

```powershell
# Stop services (keeps volumes and MySQL data)
docker compose down

# Stop and remove the database volume too (deletes data!)
docker compose down -v
```

---

## 6. After changing API or PHP route code

Files under `api/` are copied into the image at **build** time. If you change PHP and still see old behavior:

```powershell
docker compose build api web
docker compose up -d api web
```

If something still looks wrong, force recreate:

```powershell
docker compose up -d --force-recreate api web
```

---

## 7. MySQL environment variables (optional)

`docker-compose.yml` defines defaults. You can override them before `docker compose up`:

| Variable | Default |
|----------|---------|
| `MYSQL_DATABASE` | `budget_manager` |
| `MYSQL_USER` | `budget` |
| `MYSQL_PASSWORD` | `budget_secret` |
| `MYSQL_ROOT_PASSWORD` | `root_secret` |
| `MYSQL_PORT` | `3306` |

PowerShell example:

```powershell
$env:MYSQL_PASSWORD = "your_secure_password"
docker compose up --build -d
```

---

## 8. Project layout (relevant paths)

```
budget-manager/
├── api/                 # PHP (lib, public/index.php, routes/)
├── database/
│   └── schema.sql       # Initial schema (applied on first MySQL volume init)
├── docker/
│   ├── php/             # API Dockerfile
│   └── web/             # Frontend Dockerfile + nginx.conf
├── frontend/            # React + Vite
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

---

## 9. Troubleshooting

| Symptom | What to try |
|---------|-------------|
| API returns “route not found” or 404 for new endpoints | Rebuild and restart `api` (and `web` if needed): `docker compose build api web` then `docker compose up -d api web` |
| Stale frontend on port 8080 | `docker compose build web` then `docker compose up -d web` |
| Port 8080 or 3306 already in use | Set `WEB_PORT` or `MYSQL_PORT` via environment variables |
| CORS errors in dev | Use `npm run dev` for the UI, or the same origin that serves `/api` |

To connect to MySQL from the host (GUI client), use mapped port **3306** (default) and the credentials from section 7.
