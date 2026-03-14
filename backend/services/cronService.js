const cron = require('node-cron');
const Industry = require('../models/Industry');
const MonitoringReport = require('../models/MonitoringReport');
const MonitoringStation = require('../models/MonitoringStation');
const Alert = require('../models/Alert');
const { syncStationReadings } = require('./externalApiService');

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

const startAllCronJobs = () => {
  scheduleMissingReportCheck();
  scheduleStationSync();
  scheduleComplianceScoreUpdate();
  console.log('⏰ All cron jobs scheduled.');
};

module.exports = { startAllCronJobs };
