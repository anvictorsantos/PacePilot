# PacePilot — Adaptive Strava Running Coach

Premium MEVN running-coach app. Strava supplies the evidence, the training engine decides, the coach explains.

## Stack

- **MongoDB + Mongoose** · **Express 4** · **Vue 3 + Vite + Pinia + Vue Router** · **Tailwind CSS** · **Chart.js + vue-chartjs**

## Project Structure

```
server/  — Express API, Mongoose models, Strava + training services, demo seeds
client/  — Vue 3 SPA (Vite), Tailwind, Pinia stores, charts
```

## Prerequisites

- Node.js 18+
- MongoDB (local `mongod` or Atlas)

## Environment

Copy `server/.env.example` to `server/.env` and fill in:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/pacepilot
JWT_SECRET=your-long-random-string
JWT_EXPIRES_IN=7d
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
CLIENT_URL=http://localhost:5173
DEMO_MODE=false
```

- Without `STRAVA_CLIENT_ID` the server runs in **demo mode** (seeded activities, no OAuth).
- Set `DEMO_MODE=true` explicitly to force demo data even with credentials.

## Strava OAuth Setup

1. Create an API app at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to `localhost`
3. Copy Client ID / Secret into `server/.env`
4. Ensure `STRAVA_REDIRECT_URI` matches the callback URL registered with Strava.

## MongoDB Setup

Local:

```bash
mongod --dbpath /data/db
# or with Docker
docker run -d -p 27017:27017 --name pacepilot-mongo mongo:7
```

Atlas: create a cluster, copy the connection string into `MONGODB_URI`.

Without MongoDB the API still serves **demo data** for all routes.

## Development

```bash
# server (http://localhost:3000)
cd server && npm install && npm run dev

# client (http://localhost:5173, proxies /api to :3000)
cd client && npm install && npm run dev
```

## Production

```bash
cd client && npm run build          # outputs to client/dist
# serve dist via Express static or deploy client + server separately
cd server && npm start
```

## API

| Route                               | Description                                     |
| ----------------------------------- | ----------------------------------------------- |
| `GET /api/health`                   | Health + demo flag                              |
| `GET /api/strava/authorize`         | Redirect to Strava OAuth                        |
| `GET /api/strava/callback`          | OAuth callback                                  |
| `GET /api/strava/status`            | Connection status                               |
| `POST /api/strava/sync`             | Sync activities                                 |
| `POST /api/strava/disconnect`       | Clear session                                   |
| `GET /api/activities`               | List (paginated, filterable)                    |
| `GET /api/activities/:id`           | Detail + streams + laps                         |
| `GET /api/plan/today`               | Next workout recommendation                     |
| `GET /api/plan/week`                | 7-day plan                                      |
| `GET /api/goals` / `PUT /api/goals` | Goal CRUD                                       |
| `GET /api/progress`                 | Training state + volume + pace series + records |

## Architecture Notes

- **Strava service** (`server/src/services/strava.service.js`) handles OAuth, token refresh, 7 Strava endpoints, pagination, and rate-limit backoff. Never logs tokens.
- **Training engine** (`training.service.js` + `plan.service.js`) is pure/deterministic: rolling metrics (7/14/28/84d), conservative classification, decision hierarchy (safety → goal → consistency → volume → intensity → specificity → performance).
- **Demo mode** (`demo.service.js` + `seeds/demoData.json`) seeds 20 realistic runs across 5 weeks for fully functional UI without Strava.

See `adaptive-strava-running-coach-SKILL.md` for the full product spec.
