# Pipeline Cost Calculator – CI/CD Cost Estimation Tool

A beginner-friendly web app that estimates and visualizes CI/CD pipeline costs using Jenkins-style concepts (runs/day, execution time, agents, cost/min, storage).

## Project structure

```
project-root/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── jenkins/
│   └── Jenkinsfile
└── README.md
```

## Running instructions (MANDATORY)

1. Install **Node.js** (LTS recommended).
2. Run:

```bash
cd backend
npm install
npm start
```

3. Open:
   `http://localhost:5000`

**Do not open `frontend/index.html` manually** (no `file://`). The backend serves the frontend.

## What the backend does

- Serves the frontend statically from `../frontend`
- Root route `/` returns `frontend/index.html`
- API route `POST /api/calculate-cost` calculates totals and returns the **exact** response shape required

### API example

Request:

```json
{
  "runsPerDay": 20,
  "executionTimeMinutes": 12,
  "agents": 2,
  "costPerMinute": 0.05,
  "storageMonthly": 15
}
```

Response (shape):

```json
{
  "totals": {
    "daily": 0,
    "monthly": 0,
    "yearly": 0,
    "costPerRun": 0
  },
  "breakdown": {
    "compute": {
      "daily": 0,
      "monthly": 0,
      "computeMinutesPerDay": 0,
      "totalAgentMinutesPerDay": 0
    },
    "storage": {
      "monthly": 0
    }
  },
  "inputs": {
    "currency": "$"
  }
}
```

## Jenkins simulation

See `jenkins/Jenkinsfile` for a declarative pipeline with stages:
- Build
- Test
- Deploy

Each stage uses `sleep 5` to simulate time spent running jobs on Jenkins agents.

## Environment variables (optional)

- **PORT**: server port (default `5000`)

Create `backend/.env` if you want to override it:

```
PORT=5000
```

## Docker (bonus)

Build and run:

```bash
docker build -t pipeline-cost-calculator .
docker run --rm -p 5000:5000 pipeline-cost-calculator
```

Then open `http://localhost:5000`.

## 🌐 Live Demo
https://pipeline-cost-calculator-1.onrender.com

