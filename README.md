# Quiz Generator

## Prerequisites
- Node.js (LTS recommended)
- npm
- MongoDB running locally on default port

## Environment Files
### backend/.env

MONGO_URI=mongodb://localhost:27017/quizapp
PORT=5000

### frontend/.env

VITE_BACKEND_URL=http://localhost:5000

## Setup
1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Run
1. Start MongoDB.

2. Start backend server:

```bash
cd backend
node server.js
```

3. Start frontend dev server:

```bash
cd ../frontend
npm run dev
```

## App URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
