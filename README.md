# 🌿 PrithviNet — AI-Powered Environmental Monitoring Platform

> Smart environmental monitoring and compliance platform for government pollution control boards.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Git

### 2. Backend Setup

```bash
cd backend
cp .env.example .env          # Edit MONGO_URI and JWT_SECRET
npm install
npm run seed                  # Seed demo data (3 regions, 5 industries, 30 days of reports)
npm run dev                   # Starts on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start                     # Starts on http://localhost:3000
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@prithvinet.gov.in | Admin@1234 |
| Regional Officer | officer.mumbai@prithvinet.gov.in | Officer@1234 |
| Industry User | manager@steelcorp.com | Industry@1234 |
| Citizen | amit.kumar@gmail.com | Citizen@1234 |

---

## 🏗 Architecture

```
prithvinet/
├── backend/                    Node.js + Express API
│   ├── config/
│   │   ├── db.js              MongoDB connection
│   │   └── roles.js           RBAC permissions map
│   ├── models/                MongoDB schemas
│   │   ├── User.js
│   │   ├── Region.js
│   │   ├── Industry.js
│   │   ├── MonitoringStation.js
│   │   ├── MonitoringReport.js  ← core daily report (air/water/noise)
│   │   ├── Alert.js
│   │   ├── Complaint.js
│   │   └── Simulation.js
│   ├── controllers/           Route handlers
│   ├── routes/                Express routers
│   ├── middleware/
│   │   ├── auth.js            JWT protect + optionalAuth
│   │   ├── rbac.js            Role & permission guards
│   │   └── errorHandler.js
│   ├── services/
│   │   ├── complianceService.js   Violation detection + AQI calc
│   │   ├── aiService.js           5 AI modules (with heuristic fallback)
│   │   ├── externalApiService.js  Open-Meteo + OpenAQ integration
│   │   └── cronService.js         Scheduled jobs
│   └── utils/seed.js           Demo data seeder
│
└── frontend/                   React + Tailwind
    └── src/
        ├── context/AuthContext.jsx
        ├── services/api.js         All Axios API calls
        ├── utils/helpers.js        AQI, badges, formatters
        ├── components/
        │   ├── common/             UI.jsx, Layout.jsx
        │   ├── maps/PollutionMap.jsx  Leaflet dark map
        │   ├── charts/Charts.jsx   Recharts components
        │   └── alerts/AlertsPanel.jsx
        └── pages/
            ├── auth/              Login, Signup
            ├── admin/             Super Admin dashboard + pages
            ├── officer/           Regional Officer dashboard + pages
            ├── industry/          Industry dashboard + submit report
            └── citizen/           Public portal + complaint form
```

---

## 🔌 API Reference

| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/v1/auth/signup` | Public |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/pollution/map` | Public |
| GET | `/api/v1/pollution/summary` | Public |
| POST | `/api/v1/reports` | Industry+ |
| GET | `/api/v1/reports` | Officer+ |
| GET | `/api/v1/industries` | Public |
| POST | `/api/v1/ai/simulation/run` | Officer+ |
| GET | `/api/v1/ai/forecast/air` | Public |
| GET | `/api/v1/ai/attribution` | Officer+ |
| GET | `/api/v1/ai/compliance-risk` | All |
| GET | `/api/v1/ai/inspection-optimization` | Officer+ |
| POST | `/api/v1/complaints` | Public |

---

## 🤖 AI Capabilities

All 5 AI modules have **heuristic fallbacks** — the platform works without a Python AI service.

| Module | Endpoint | Description |
|--------|----------|-------------|
| Pollution Attribution | `GET /ai/attribution` | Identifies likely pollution source when spikes occur |
| Compliance Risk | `GET /ai/compliance-risk` | Predicts violation probability for next 24h |
| Digital Twin Sim | `POST /ai/simulation/run` | Models emission reduction → predicts AQI impact |
| 72h Forecast | `GET /ai/forecast/air` | Multi-step air quality prediction |
| Inspection Optimizer | `GET /ai/inspection-optimization` | Ranks industries for inspection priority |

To connect a real Python ML service, set `AI_SERVICE_URL` in `.env`.
Expected endpoints: `POST /attribution`, `/compliance-risk`, `/simulation`, `/forecast`, `/inspection-optimization`.

---

## 🌐 External APIs

| API | Used For | Config |
|-----|----------|--------|
| Open-Meteo | Hourly air quality data | Free, no key needed |
| OpenAQ | Real monitoring stations | `OPENAQ_API_KEY` in .env |

Both have mock fallbacks if unavailable.

---

## ⏰ Scheduled Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Missing Report Check | 10:00 PM daily | Creates alerts for industries that didn't report |
| Station Sync | Every 2 hours | Updates MonitoringStation.last_reading from OpenAQ |
| Compliance Score Update | Midnight daily | Recalculates industry compliance_score from 30d average |

---

## 🗂 RBAC Permissions

| Role | Scope | Key Capabilities |
|------|-------|-----------------|
| `super_admin` | State-wide | Create regions/officers, run simulations, manage limits |
| `regional_officer` | District | View reports, run interventions, inspect industries |
| `industry` | Own facility | Submit reports, view compliance risk |
| `citizen` | Public | View maps, forecasts, submit complaints |

---

## 📦 Environment Variables

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/prithvinet
JWT_SECRET=change_this_in_production
JWT_EXPIRES_IN=7d
OPENAQ_API_KEY=optional
OPENMETEO_BASE_URL=https://air-quality-api.open-meteo.com/v1
AI_SERVICE_URL=http://localhost:8000   # optional Python microservice
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```
