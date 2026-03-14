require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Region = require('../models/Region');
const Industry = require('../models/Industry');
const MonitoringStation = require('../models/MonitoringStation');
const MonitoringReport = require('../models/MonitoringReport');
const Alert = require('../models/Alert');

const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  // Clear existing
  await Promise.all([
    User.deleteMany({}), Region.deleteMany({}), Industry.deleteMany({}),
    MonitoringStation.deleteMany({}), MonitoringReport.deleteMany({}), Alert.deleteMany({}),
  ]);

  // ── Regions ──────────────────────────────────
  // High-level macro regions:
  // - Chhattisgarh Region (Raipur-centric)
  // - Mumbai Region (western India)
  // - South Region (around Bengaluru)
  const [chhattisgarhRegion, mumbaiRegion, southRegion] = await Region.insertMany([
    {
      name: 'Chhattisgarh Region',
      state: 'Chhattisgarh',
      district: 'Raipur',
      // [lng, lat] around Raipur
      coordinates: { type: 'Point', coordinates: [81.6296, 21.2514] },
      environmental_limits: {
        air: { pm25: 60, pm10: 100, so2: 80, no2: 80, co: 4000 },
        water: { ph_min: 6.5, ph_max: 8.5, bod: 30, cod: 250, tss: 100, turbidity: 10 },
        noise: { day_db: 55, night_db: 45 },
      },
      population: 25545198,
      area_sq_km: 135191,
    },
    {
      name: 'Mumbai Region',
      state: 'Maharashtra',
      district: 'Mumbai',
      // [lng, lat] for Mumbai
      coordinates: { type: 'Point', coordinates: [72.8777, 19.0760] },
      environmental_limits: {
        air: { pm25: 60, pm10: 100, so2: 80, no2: 80, co: 4000 },
        water: { ph_min: 6.5, ph_max: 8.5, bod: 30, cod: 250, tss: 100, turbidity: 10 },
        noise: { day_db: 55, night_db: 45 },
      },
      population: 12478447,
      area_sq_km: 603,
    },
    {
      name: 'South Region',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      // [lng, lat] for Bengaluru
      coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] },
      environmental_limits: {
        air: { pm25: 60, pm10: 100, so2: 80, no2: 80, co: 4000 },
        water: { ph_min: 6.5, ph_max: 8.5, bod: 30, cod: 250, tss: 100, turbidity: 10 },
        noise: { day_db: 55, night_db: 45 },
      },
      population: 8443675,
      area_sq_km: 2190,
    },
  ]);

  // ── Users ─────────────────────────────────────
  // One super admin, three regional officers (Chhattisgarh, Mumbai, South),
  // two industry users, one citizen.
  const userSeedData = [
    { name: 'Rajesh Sharma', email: 'admin@prithvinet.gov.in', password: 'Admin@1234', role: 'super_admin' },
    { name: 'Ananya Verma', email: 'officer.chhattisgarh@prithvinet.gov.in', password: 'Officer@1234', role: 'regional_officer', region_id: chhattisgarhRegion._id },
    { name: 'Priya Desai', email: 'officer.mumbai@prithvinet.gov.in', password: 'Officer@1234', role: 'regional_officer', region_id: mumbaiRegion._id },
    { name: 'Ravi Menon', email: 'officer.south@prithvinet.gov.in', password: 'Officer@1234', role: 'regional_officer', region_id: southRegion._id },
    { name: 'Steel Corp Manager', email: 'manager@steelcorp.com', password: 'Industry@1234', role: 'industry' },
    { name: 'ChemWorks Admin', email: 'admin@chemworks.com', password: 'Industry@1234', role: 'industry' },
    { name: 'Amit Kumar', email: 'amit.kumar@gmail.com', password: 'Citizen@1234', role: 'citizen', region_id: chhattisgarhRegion._id },
  ].map((u) => ({
    ...u,
    password: bcrypt.hashSync(u.password, 12),
  }));

  const [superAdmin, chOfficer, mumOfficer, southOfficer, industryUser1, industryUser2, citizen1] =
    await User.insertMany(userSeedData);

  // ── Industries ────────────────────────────────
  const [steel, chemical, textile, cement, refinery] = await Industry.insertMany([
    {
      name: 'Raipur Steel Corp',
      industry_type: 'steel',
      region_id: chhattisgarhRegion._id,
      location: { type: 'Point', coordinates: [81.6400, 21.2600], address: 'Urla Industrial Area, Raipur' },
      compliance_score: 45,
      compliance_status: 'violation',
      total_violations: 18,
      user_id: industryUser1._id,
      emission_limits: { air: { pm25: 80, pm10: 150, so2: 120, no2: 100 } },
      production_capacity: { value: 500, unit: 'MT/day' },
    },
    {
      name: 'Bilaspur Chemical Works',
      industry_type: 'chemical',
      region_id: chhattisgarhRegion._id,
      location: { type: 'Point', coordinates: [82.1400, 22.0900], address: 'Silk Route Industrial Estate, Bilaspur' },
      compliance_score: 72,
      compliance_status: 'warning',
      total_violations: 7,
      user_id: industryUser2._id,
    },
    {
      name: 'Mumbai Textile Mills',
      industry_type: 'textile',
      region_id: mumbaiRegion._id,
      location: { type: 'Point', coordinates: [72.8800, 19.0000], address: 'Lower Parel, Mumbai' },
      compliance_score: 88,
      compliance_status: 'compliant',
      total_violations: 2,
    },
    {
      name: 'South Cement Plant',
      industry_type: 'cement',
      region_id: southRegion._id,
      location: { type: 'Point', coordinates: [77.7000, 12.9500], address: 'Industrial Belt, Bengaluru South' },
      compliance_score: 31,
      compliance_status: 'critical',
      total_violations: 34,
    },
    {
      name: 'Coastal Refinery',
      industry_type: 'refinery',
      region_id: southRegion._id,
      location: { type: 'Point', coordinates: [80.2700, 13.0500], address: 'Ennore Port, Chennai' },
      compliance_score: 91,
      compliance_status: 'compliant',
      total_violations: 1,
    },
  ]);

  // Update user industry_id
  await User.findByIdAndUpdate(industryUser1._id, { industry_id: steel._id });
  await User.findByIdAndUpdate(industryUser2._id, { industry_id: chemical._id });

  // Update region officer ids
  await Region.findByIdAndUpdate(chhattisgarhRegion._id, { regional_officer_id: chOfficer._id });
  await Region.findByIdAndUpdate(mumbaiRegion._id, { regional_officer_id: mumOfficer._id });
  await Region.findByIdAndUpdate(southRegion._id, { regional_officer_id: southOfficer._id });

  // ── Monitoring Stations ───────────────────────
  const stations = await MonitoringStation.insertMany([
    {
      name: 'Raipur Monitoring Station',
      station_code: 'CG-001',
      region_id: chhattisgarhRegion._id,
      location: { type: 'Point', coordinates: [81.6200, 21.2500] },
      sensor_types: ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO'],
      status: 'active',
      data_source: 'iot',
      last_reading: { timestamp: new Date(), pm25: 89, pm10: 134, no2: 67, so2: 45, aqi: 178 },
    },
    {
      name: 'Bandra Monitoring Station',
      station_code: 'MUM-001',
      region_id: mumbaiRegion._id,
      location: { type: 'Point', coordinates: [72.8347, 19.0596] },
      sensor_types: ['PM2.5', 'PM10', 'NO2'],
      status: 'active',
      data_source: 'openaq',
      last_reading: { timestamp: new Date(), pm25: 102, pm10: 158, no2: 78, aqi: 201 },
    },
    {
      name: 'Bengaluru South Station',
      station_code: 'SOU-001',
      region_id: southRegion._id,
      location: { type: 'Point', coordinates: [77.5800, 12.9600] },
      sensor_types: ['PM2.5', 'PM10', 'SO2', 'noise'],
      status: 'active',
      data_source: 'iot',
      last_reading: { timestamp: new Date(), pm25: 55, pm10: 82, no2: 42, aqi: 119 },
    },
  ]);

  await Region.findByIdAndUpdate(chhattisgarhRegion._id, { monitoring_stations: [stations[0]._id] });
  await Region.findByIdAndUpdate(mumbaiRegion._id, { monitoring_stations: [stations[1]._id] });
  await Region.findByIdAndUpdate(southRegion._id, { monitoring_stations: [stations[2]._id] });

  // ── Reports (last 30 days for steel + chemical) ───
  const reports = [];
  const industries = [steel, chemical, textile];

  for (const ind of industries) {
    for (let d = 29; d >= 0; d--) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      date.setHours(12, 0, 0, 0);

      const isViolator = ind._id.toString() === steel._id.toString();
      const pm25 = isViolator ? 80 + Math.random() * 60 : 30 + Math.random() * 40;
      const aqi = Math.round(pm25 * 1.6);

      reports.push({
        industry_id: ind._id,
        region_id: ind.region_id,
        submitted_by: superAdmin._id,
        date,
        air_data: {
          pm25: Math.round(pm25),
          pm10: Math.round(pm25 * 1.5),
          so2: Math.round(20 + Math.random() * 60),
          no2: Math.round(30 + Math.random() * 50),
          co: Math.round(500 + Math.random() * 800),
          temperature: Math.round(25 + Math.random() * 10),
          humidity: Math.round(60 + Math.random() * 20),
          aqi,
          aqi_category: aqi <= 100 ? 'satisfactory' : aqi <= 200 ? 'moderate' : 'poor',
        },
        water_data: {
          ph: 7.0 + (Math.random() - 0.5) * 2,
          bod: Math.round(10 + Math.random() * 40),
          cod: Math.round(80 + Math.random() * 200),
          tss: Math.round(20 + Math.random() * 100),
          turbidity: Math.round(2 + Math.random() * 12),
        },
        noise_data: {
          day_db: Math.round(50 + Math.random() * 20),
          night_db: Math.round(40 + Math.random() * 15),
          peak_db: Math.round(65 + Math.random() * 25),
        },
        status: d > 3 ? 'approved' : 'submitted',
        is_compliant: pm25 <= 80,
        compliance_score: Math.max(20, Math.round(100 - (pm25 - 60) * 0.8)),
      });
    }
  }

  await MonitoringReport.insertMany(reports);

  // ── Alerts ────────────────────────────────────
  await Alert.insertMany([
    {
      type: 'violation_alert',
      severity: 'critical',
      title: 'Critical PM2.5 Violation: Raipur Steel Corp',
      message: 'PM2.5 levels recorded at 142 µg/m³, exceeding limit of 80 µg/m³ by 77.5%.',
      region_id: chhattisgarhRegion._id,
      industry_id: steel._id,
      target_roles: ['regional_officer', 'super_admin'],
      metadata: { parameter: 'PM25', measured_value: 142, limit_value: 80 },
    },
    {
      type: 'report_missing',
      severity: 'medium',
      title: 'Missing Report: South Cement Plant',
      message: 'South Cement Plant has not submitted today\'s monitoring report.',
      region_id: southRegion._id,
      industry_id: cement._id,
      target_roles: ['regional_officer', 'super_admin'],
    },
    {
      type: 'forecast_risk',
      severity: 'high',
      title: 'High AQI Forecast: Mumbai Region',
      message: 'AI forecast predicts AQI > 250 in Mumbai Region for the next 2 days.',
      region_id: mumbaiRegion._id,
      target_roles: ['regional_officer', 'super_admin', 'citizen'],
    },
  ]);

  console.log('\n✅ Seed complete!\n');
  console.log('─── Demo Credentials ───────────────────────');
  console.log('Super Admin:                 admin@prithvinet.gov.in            / Admin@1234');
  console.log('Regional Officer (CG):       officer.chhattisgarh@prithvinet.gov.in / Officer@1234');
  console.log('Regional Officer (Mumbai):   officer.mumbai@prithvinet.gov.in   / Officer@1234');
  console.log('Regional Officer (South):    officer.south@prithvinet.gov.in    / Officer@1234');
  console.log('Industry User:               manager@steelcorp.com              / Industry@1234');
  console.log('Citizen:                     amit.kumar@gmail.com               / Citizen@1234');
  console.log('────────────────────────────────────────────\n');

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
