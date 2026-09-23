# MarketLink Apex

Monorepo with `frontend/` (React + Vite) and `backend/` (Express + MongoDB).

## Prerequisites

- Node.js 18+
- A MongoDB Atlas account (free tier)

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```
MONGO_URI=your_mongodb_atlas_connection_string
PORT=5000
```

Run in dev mode (nodemon):

```bash
npm run dev
```

Health check: http://localhost:5000/api/health

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:5000
```

Run dev server:

```bash
npm run dev
```

## Project Structure

```
.
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── .env
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── .env
├── .gitignore
└── README.md
```
