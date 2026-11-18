# Deployment guide — PharmaLink

Frontend on **Vercel**, backend on **Render**.

## Backend (Render)

1. Create a new Web Service from this repository.
2. Render reads `render.yaml` automatically. Alternatively set manually:
   - Build command: `npm install`
   - Start command: `npm run start`
   - Health check path: `/api/health`
3. Add a persistent disk mounted at `/var/data` (1 GB is plenty).
4. Set environment variables:
   - `CLIENT_ORIGIN` = your Vercel URL (e.g. `https://pharmalink.vercel.app`). Comma-separate multiple origins.
   - `JWT_SECRET` = a long random string (Render can generate).
   - Optional provider keys (Paystack, Hubtel, Arkesel, etc.) — leave `mock` to use the demo providers.
5. On first boot `AUTO_SEED=true` populates the demo database and accounts. Set it to `false` afterwards if you do not want re-seeding on an empty disk.

The SQLite database, uploads, backups and reports live on the persistent disk (`DB_PATH=/var/data/pharmacy.db`).

## Frontend (Vercel)

1. Import the repository into Vercel.
2. Set the project root directory to `client`.
3. Vercel reads `client/vercel.json`.
4. Add environment variable:
   - `VITE_API_URL` = your Render backend URL, including `/api`
     (e.g. `https://pharmalink-api.onrender.com/api`). A bare origin is also accepted.
5. Deploy. Client-side routing is handled by the SPA rewrite.

## Cross-origin notes

- The backend allows the Vercel origin (and `*.vercel.app` previews) via CORS with credentials.
- Cookies are issued with `SameSite=None; Secure` in production, so the browser sends the JWT and CSRF cookies cross-origin. Set `COOKIE_SECURE=true` on Render (already in `render.yaml`).
- `CLIENT_ORIGIN` must match the Vercel domain exactly (no trailing slash) for credentialed requests; previews are matched by suffix.

## Verifying

- `GET https://<render>/api/health` returns `{ "status": "ok" }`.
- Open the Vercel URL, sign in with a demo account from `docs/DEMO_LOGINS.md`.