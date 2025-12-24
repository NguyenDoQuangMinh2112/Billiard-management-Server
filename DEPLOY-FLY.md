# 🚀 Deploying to Fly.io

Follow these steps to deploy your Billiard Management Server to Fly.io.

## Prerequisites
1.  **Install Flyctl**:
    *   **Windows (PowerShell)**: `pwsh -Command "iwr https://fly.io/install.ps1 | iex"`
    *   **macOS/Linux**: `curl -L https://fly.io/install.sh | sh`
2.  **Login**: `fly auth login`

## Step 1: Initialize Fly App
Run the following command in the `Billiard-management-Server` directory:
```bash
fly launch
```
*   **App Name**: Choose a unique name (e.g., `billiard-api-server`).
*   **Region**: Choose the one closest to you.
*   **Postgres**: Select **Yes** to create a PostgreSQL database.
*   **Port**: If asked for a port, use **3000**.
*   **Redis**: Select **No** (unless you need it later).
*   **Deploy now?**: Select **No** (we need to apply the schema first).

## Step 2: Configure Environment Variables
Fly will automatically set `DATABASE_URL`. You should set other variables:
```bash
fly secrets set NODE_ENV=production CORS_ORIGIN=https://your-frontend-domain.com
```

## Step 3: Database Schema Setup
Since this is a new database, you need to run the `schema.sql`.
The easiest way is to connect to the DB once it's created:
```bash
fly postgres connect -a <your-db-app-name>
```
Or, since our app has auto-init logic for players (which we disabled for production), we usually run a migration script.
For Fly.io, you can proxy the connection to your local machine:
```bash
fly proxy 5433:5432 -a <your-db-app-name>
```
Then run the local psql command:
```bash
psql -h localhost -p 5433 -U postgres -d <your-db-name> -f src/schema.sql
```

## Step 4: Deploy
Once configured, deploy the app:
```bash
fly deploy
```

## Step 5: Verify
Check your app status:
```bash
fly status
fly logs
```

## Features of this Setup
*   **Bun Optimized**: Uses a multi-stage Dockerfile for fast builds and small images.
*   **Auto-Healthcheck**: Fly monitors the `/` endpoint.
*   **Scalable**: Easily scale your server with `fly scale count 2`.

---
**Note**: If you don't have `psql` locally, you can use `fly ssh console` to run commands inside the container after deployment, but it is recommended to set up the DB beforehand.
