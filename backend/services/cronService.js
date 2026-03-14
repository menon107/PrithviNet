const cron = require('node-cron');
const Industry = require('../models/Industry');
const MonitoringReport = require('../models/MonitoringReport');
const MonitoringStation = require('../models/MonitoringStation');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { syncStationReadings } = require('./externalApiService');
const { checkCompliance } = require('./complianceService');

/**
 * Run at 10pm every day: check for missing daily reports
 */
const scheduleMissingReportCheck = () => {
  cron.schedule('0 22 * * *', async () => {
    console.log('🕙 Running missing report check...');
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const allIndustries = await Industry.find({ is_active: true }).select('_id name region_id');
      const reported = await MonitoringReport.find({ date: { $gte: today } }).distinct('industry_id');
      const reportedSet = new Set(reported.map((id) => id.toString()));

      const missing = allIndustries.filter((i) => !reportedSet.has(i._id.toString()));

      for (const industry of missing) {
        // Only create if alert doesn't already exist for today
        const exists = await Alert.findOne({
          type: 'report_missing',
          industry_id: industry._id,
          created_at: { $gte: today },
        });

        if (!exists) {
          await Alert.create({
            type: 'report_missing',
            severity: 'medium',
            title: `Missing Report: ${industry.name}`,
            message: `${industry.name} has not submitted today's monitoring report.`,
            region_id: industry.region_id,
            industry_id: industry._id,
            target_roles: ['regional_officer', 'super_admin', 'industry'],
          });
        }
      }

      console.log(`✅ Missing report check complete. ${missing.length} missing.`);
    } catch (err) {
      console.error('❌ Missing report cron failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });
};

/**
 * Run every 2 hours: sync external station readings
 */
const scheduleStationSync = () => {
  cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Syncing monitoring station readings...');
    try {
      const stations = await MonitoringStation.find({
        status: 'active',
        data_source: 'openaq',
        external_station_id: { $ne: null },
      });

      const updated = await syncStationReadings(stations);
      console.log(`✅ Station sync complete. ${updated.length} stations updated.`);
    } catch (err) {
      console.error('❌ Station sync cron failed:', err.message);
    }
  });
};

/**
 * Run at midnight: update compliance scores based on last 30 days
 */
const scheduleComplianceScoreUpdate = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('📊 Updating industry compliance scores...');
    try {
      const industries = await Industry.find({ is_active: true }).select('_id');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const industry of industries) {
        const reports = await MonitoringReport.find({
          industry_id: industry._id,
          date: { $gte: thirtyDaysAgo },
        }).select('is_compliant compliance_score');

        if (!reports.length) continue;

        const avgScore = reports.reduce((sum, r) => sum + (r.compliance_score || 100), 0) / reports.length;
        const violationCount = reports.filter((r) => !r.is_compliant).length;

        let status = 'compliant';
        if (avgScore < 40) status = 'critical';
        else if (avgScore < 60) status = 'violation';
        else if (avgScore < 80) status = 'warning';

        await Industry.findByIdAndUpdate(industry._id, {
          compliance_score: Math.round(avgScore),
          compliance_status: status,
        });
      }
      console.log(`✅ Compliance scores updated for ${industries.length} industries.`);
    } catch (err) {
      console.error('❌ Compliance score cron failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });
};

/**
 * Run every 5 minutes: simulate live industry reports flowing to officers.
 * Generates near-real-time readings for each active industry so dashboards
 * and regional officer views always have fresh data.
 *
 * Most industries are kept in a healthy / moderate band, while specific demo
 * industries get biased behaviour:
 *  - "Indigo"       → consistently worse pollution / low scores
 *  - "Bodybag Zipper" → consistently excellent readings / very high scores
 */
const scheduleSimulatedIndustryReports = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      console.log('🟢 Simulating live industry reports @', now.toISOString());

      // Fallback "system" submitter: first super_admin (if any)
      const superAdmin = await User.findOne({ role: 'super_admin' }).select('_id');

      const industries = await Industry.find({ is_active: true })
        .select('_id name industry_type region_id user_id emission_limits')
        .populate('region_id', 'environmental_limits');

      if (!industries.length) return;

      const reportsToInsert = [];

      for (const ind of industries) {
        const baseProfile = (() => {
          const name = (ind.name || '').toLowerCase();
          if (name.includes('indigo')) {
            // Bad range: frequently around / above limits
            return {
              pm25: [90, 150],
              pm10: [150, 260],
              so2: [70, 140],
              no2: [70, 140],
              co: [3500, 5500],
              ph: [6.2, 8.8],
              bod: [40, 80],
              cod: [220, 380],
              tss: [120, 260],
              turbidity: [8, 18],
              day_db: [65, 80],
              night_db: [55, 70],
            };
          }
          if (name.includes('bodybag') && name.includes('zipper')) {
            // Very very good range: well within limits
            return {
              pm25: [20, 35],
              pm10: [40, 70],
              so2: [5, 20],
              no2: [5, 25],
              co: [800, 1800],
              ph: [7.0, 7.6],
              bod: [5, 15],
              cod: [70, 140],
              tss: [20, 60],
              turbidity: [1, 5],
              day_db: [45, 52],
              night_db: [38, 44],
            };
          }
          // Default: moderate but generally acceptable band
          return {
            pm25: [45, 80],
            pm10: [80, 140],
            so2: [15, 60],
            no2: [20, 70],
            co: [1200, 3200],
            ph: [6.7, 8.3],
            bod: [12, 28],
            cod: [120, 260],
            tss: [40, 130],
            turbidity: [3, 11],
            day_db: [50, 62],
            night_db: [42, 52],
          };
        })();

        const rand = (min, max) => min + Math.random() * (max - min);

        const air_data = {
          pm25: Math.round(rand(...baseProfile.pm25)),
          pm10: Math.round(rand(...baseProfile.pm10)),
          so2: Math.round(rand(...baseProfile.so2)),
          no2: Math.round(rand(...baseProfile.no2)),
          co: Math.round(rand(...baseProfile.co)),
          temperature: Math.round(24 + Math.random() * 6),
          humidity: Math.round(55 + Math.random() * 20),
        };

        const water_data = {
          ph: parseFloat(rand(...baseProfile.ph).toFixed(2)),
          bod: Math.round(rand(...baseProfile.bod)),
          cod: Math.round(rand(...baseProfile.cod)),
          tss: Math.round(rand(...baseProfile.tss)),
          turbidity: Math.round(rand(...baseProfile.turbidity)),
        };

        const noise_data = {
          day_db: Math.round(rand(...baseProfile.day_db)),
          night_db: Math.round(rand(...baseProfile.night_db)),
          peak_db: Math.round(rand(baseProfile.day_db[1], baseProfile.day_db[1] + 8)),
        };

        const { violations, score, status, is_compliant } = checkCompliance(
          { air_data, water_data, noise_data },
          ind
        );

        reportsToInsert.push({
          industry_id: ind._id,
          region_id: ind.region_id,
          submitted_by: ind.user_id || superAdmin?._id,
          date: now,
          reporting_period: 'daily',
          air_data,
          water_data,
          noise_data,
          violations,
          has_violations: violations.length > 0,
          is_compliant,
          compliance_score: score,
          compliance_status: status,
          status: 'submitted',
        });
      }

      if (reportsToInsert.length) {
        await MonitoringReport.insertMany(reportsToInsert);
        console.log(`✅ Simulated ${reportsToInsert.length} live reports.`);
      }
    } catch (err) {
      console.error('❌ Live report simulation failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });
};

const startAllCronJobs = () => {
  scheduleMissingReportCheck();
  scheduleStationSync();
  scheduleComplianceScoreUpdate();
  scheduleSimulatedIndustryReports();
  console.log('⏰ All cron jobs scheduled.');
};

module.exports = { startAllCronJobs };
