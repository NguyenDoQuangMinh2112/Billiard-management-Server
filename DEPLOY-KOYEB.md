# 🚀 Deploying to Koyeb

Follow these steps to deploy your Billiard Management Server to Koyeb using Docker or GitHub.

## Option 1: GitHub Integration (Recommended)

1.  **Login to Koyeb**: Go to [app.koyeb.com](https://app.koyeb.com).
2.  **Create Service**: Click **"Create Service"**.
3.  **Source**: Choose **"GitHub"**.
4.  **Repository**: Select `NguyenDoQuangMinh2112/Billiard-management-Server`.
5.  **Builder**: Select **"Docker"** (Koyeb will automatically detect your `Dockerfile`).
6.  **Settings**:
    *   **Port**: `3000`
    *   **Protocol**: `http`
    *   **Path**: `/`
7.  **Environment Variables**:
    *   `NODE_ENV`: `production`
    *   `PORT`: `3000`
    *   `DATABASE_URL`: (Paste your Koyeb Postgres URL or external DB URL here)
    *   `CORS_ORIGIN`: (Your frontend URL, e.g., `https://your-app.koyeb.app`)
8.  **Deploy**: Click **"Deploy"**.

## Option 2: Koyeb Database

If you want to use a Koyeb managed database:
1.  Go to **"Database"** tab and create a new Instance (Postgres).
2.  Once created, copy the **"Public Connection String"**.
3.  Add this as the `DATABASE_URL` in your Service environment variables.

## ⚙️ Refactoring Details for Koyeb
*   **Port**: Koyeb uses the `PORT` env var, which our code already supports.
*   **Host**: Our server listens on `0.0.0.0` by default, which is required for Koyeb.
*   **Health Checks**: Koyeb will use the `/` endpoint we defined for TCP/HTTP health checks.

## 📦 Dockerfile Optimization
Your existing `Dockerfile` is already optimized for platforms like Koyeb using a multi-stage build.

---
**Note**: To apply your database schema, you can use a tool like `psql` from your local machine targeting the Koyeb database URL:
```bash
psql <KOYEB_DATABASE_URL> -f src/schema.sql
```
