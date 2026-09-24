# Deployment guide (Vercel + MongoDB Atlas)

MarketLink is two separate Vercel projects from the same GitHub repo — one for `backend/`, one for `frontend/` —
plus a MongoDB Atlas database. Everything below is free-tier friendly. Images are stored in MongoDB, so no disk or
extra image service is needed.

## 1. MongoDB Atlas (database)

1. Use the existing cluster or create a free M0 cluster at https://cloud.mongodb.com.
2. **Database Access** → create a user with a password (read/write).
3. **Network Access** → add `0.0.0.0/0` (Vercel has no fixed IPs).
4. **Connect → Drivers** → copy the connection string (`mongodb+srv://user:password@cluster.../`).

### Load the data (run once, from your own computer)

```bash
cd backend
cp .env.example .env        # then put the Atlas MONGO_URI and a JWT_SECRET inside
npm install
npm run db:init             # collections and indexes
npm run seed                # test users, markets, categories, products
npm run db:images           # product photos -> MongoDB
```

Demo logins (password `Password@123`): `admin@marketlink.test`, `farmer@marketlink.test`, `customer@marketlink.test`.
Change these passwords / remove the demo users before real use.

## 2. Backend on Vercel

1. https://vercel.com → **Add New… → Project** → import the GitHub repo.
2. **Root Directory:** `backend`. Framework preset: **Other**. Leave build/output settings empty.
3. **Environment Variables:**

| Name | Value |
|---|---|
| `MONGO_URI` | Atlas connection string |
| `MONGO_DB_NAME` | `marketlink` |
| `JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | the frontend URL from step 3 (add after the frontend is deployed, then redeploy) |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `MONGO_POOL_SIZE` | `5` |

4. Deploy. Open `https://<backend>.vercel.app/api/health` — it should return a success message.

## 3. Frontend on Vercel

1. **Add New… → Project** → import the same repo again.
2. **Root Directory:** `frontend`. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. **Environment Variable:** `VITE_API_URL` = the backend URL, no trailing slash (e.g. `https://marketlink-api.vercel.app`).
4. Deploy, then copy the frontend URL into the backend's `CLIENT_URL` and **redeploy the backend** (CORS).

`frontend/vercel.json` already makes page refreshes on routes like `/farmer/profile` work.

## Notes

- Any change to `VITE_API_URL` needs a frontend redeploy (it is baked in at build time).
- Serverless functions time out (10 s on the free plan) and request bodies are limited to 4.5 MB; uploads are capped at 2 MB, so this is fine.
- Atlas free tier has 512 MB of storage; each image is at most 2 MB.
- `.env` files are never committed. Keep secrets only in Vercel's environment variables.
