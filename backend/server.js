require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { startAllCronJobs } = require('./services/cronService');

const authRoutes = require('./routes/auth');
const regionsRoutes = require('./routes/regions');
const industriesRoutes = require('./routes/industries');
const reportsRoutes = require('./routes/reports');
const pollutionRoutes = require('./routes/pollution');
const alertsRoutes = require('./routes/alerts');
const complaintsRoutes = require('./routes/complaints');
const aiRoutes = require('./routes/ai');
const warningsRoutes = require('./routes/warnings');
const forecastRoutes = require('./routes/forecast');
const noticesRoutes = require('./routes/notices'); // friend's addition

const app = express();

connectDB();

// ✅ Your CORS change kept
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PrithviNet API', timestamp: new Date().toISOString() });
});

const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/regions`, regionsRoutes);
app.use(`${API}/industries`, industriesRoutes);
app.use(`${API}/reports`, reportsRoutes);
app.use(`${API}/pollution`, pollutionRoutes);
app.use(`${API}/alerts`, alertsRoutes);
app.use(`${API}/complaints`, complaintsRoutes);
app.use(`${API}/ai`, aiRoutes);
app.use(`${API}/warnings`, warningsRoutes);
app.use(`${API}/forecast`, forecastRoutes);
app.use(`${API}/notices`, noticesRoutes); // friend's addition

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🌿 PrithviNet API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health\n`);
  startAllCronJobs();
});

module.exports = app;