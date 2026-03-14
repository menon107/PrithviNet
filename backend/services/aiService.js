/**
 * AI Service
 *
 * Contains:
 * 1. Heuristic fallbacks that work without a Python microservice
 * 2. Proxy calls to the optional Python AI microservice (AI_SERVICE_URL)
 *
 * Each function gracefully falls back to heuristics if the AI service
 * is unavailable, so the platform always returns a response.
 */

const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const callAI = async (endpoint, payload) => {
  const response = await axios.post(`${AI_URL}${endpoint}`, payload, { timeout: 15000 });
  return response.data;
};

// ─────────────────────────────────────────────
// 1. POLLUTION SOURCE ATTRIBUTION (heuristic)
// ─────────────────────────────────────────────
const attributePollutionSource = async ({ reports, region_id, pollutant, date }) => {
  try {
    // Try Python AI service first
    return await callAI('/attribution', { reports: reports.map((r) => r.toObject()), region_id, pollutant });
  } catch {
    // Heuristic: rank by pollutant level, flag worst offenders
    const ranked = reports
      .filter((r) => r.air_data?.[pollutant] != null && r.industry_id)
      .sort((a, b) => (b.air_data?.[pollutant] || 0) - (a.air_data?.[pollutant] || 0))
      .slice(0, 5)
      .map((r, idx) => ({
        industry_id: r.industry_id?._id,
        industry_name: r.industry_id?.name,
        industry_type: r.industry_id?.industry_type,
        location: r.industry_id?.location?.coordinates,
        pollutant_level: r.air_data?.[pollutant],
        confidence_score: Math.max(0.3, 0.95 - idx * 0.15).toFixed(2),
        reason: idx === 0 ? 'Highest reported emission in region' : 'Elevated emission level',
      }));

    return {
      method: 'heuristic',
      pollutant,
      date,
      top_sources: ranked,
      note: 'AI service unavailable. Results based on reported emission ranking.',
    };
  }
};

// ─────────────────────────────────────────────
// 2. COMPLIANCE RISK PREDICTION
// ─────────────────────────────────────────────
const predictComplianceRisk = async ({ industry, recentReports }) => {
  try {
    return await callAI('/compliance-risk', {
      industry: industry.toObject(),
      recent_reports: recentReports.map((r) => r.toObject()),
    });
  } catch {
    // Heuristic: rolling violation rate as proxy for risk
    const total = recentReports.length;
    if (total === 0) return { violation_probability: 0.05, risk_level: 'low', method: 'heuristic', factors: [] };

    const violations = recentReports.filter((r) => !r.is_compliant).length;
    const rate = violations / total;

    // Trend: worsening in last 7 days vs prior?
    const recent7 = recentReports.slice(0, 7);
    const prev7 = recentReports.slice(7, 14);
    const recentRate = recent7.filter((r) => !r.is_compliant).length / (recent7.length || 1);
    const prevRate = prev7.filter((r) => !r.is_compliant).length / (prev7.length || 1);
    const trend = recentRate > prevRate ? 'worsening' : recentRate < prevRate ? 'improving' : 'stable';

    const probability = Math.min(0.99, rate * 1.2 + (trend === 'worsening' ? 0.1 : 0));
    const risk_level = probability > 0.7 ? 'high' : probability > 0.4 ? 'medium' : 'low';

    const factors = [];
    if (rate > 0.3) factors.push(`${(rate * 100).toFixed(0)}% violation rate in last 30 days`);
    if (trend === 'worsening') factors.push('Compliance worsening in recent 7 days');
    if (industry.total_violations > 10) factors.push('High historical violation count');

    return { violation_probability: probability.toFixed(2), risk_level, trend, method: 'heuristic', factors };
  }
};

// ─────────────────────────────────────────────
// 3. DIGITAL TWIN SIMULATION
// ─────────────────────────────────────────────
const runDigitalTwinSimulation = async (simulation) => {
  try {
    return await callAI('/simulation', simulation.toObject());
  } catch {
    // Heuristic simulation: linear proportional reduction model
    const { parameters } = simulation;
    const baselineAQI = 180; // placeholder — real impl pulls from DB

    let totalWeightedReduction = 0;
    let totalWeight = 0;

    for (const ind of parameters.industries || []) {
      const weight = ind.shutdown ? 1 : (ind.reduction_percent || 0) / 100;
      totalWeightedReduction += weight * 0.8; // 0.8 = emission-to-AQI dampening factor
      totalWeight += 1;
    }

    const avgReduction = totalWeight > 0 ? totalWeightedReduction / totalWeight : 0;
    const predicted_aqi = baselineAQI * (1 - avgReduction);
    const reduction_pct = (avgReduction * 100).toFixed(1);

    return {
      status: 'completed',
      baseline: { aqi: baselineAQI, pm25: 95, pm10: 130, no2: 55, so2: 40 },
      predicted: {
        aqi: Math.round(predicted_aqi),
        pm25: Math.round(95 * (1 - avgReduction)),
        pm10: Math.round(130 * (1 - avgReduction)),
        no2: Math.round(55 * (1 - avgReduction * 0.7)),
        so2: Math.round(40 * (1 - avgReduction * 0.9)),
      },
      reduction_percent: {
        aqi: reduction_pct,
        pm25: reduction_pct,
        pm10: reduction_pct,
        no2: (avgReduction * 70).toFixed(1),
        so2: (avgReduction * 90).toFixed(1),
      },
      health_impact: {
        affected_population: Math.round((simulation.region_id?.population || 500000) * 0.6),
        health_risk_reduction_percent: (avgReduction * 40).toFixed(1),
      },
      confidence_score: 0.72,
      method: 'heuristic_linear',
      note: 'AI service unavailable. Results based on linear proportional model.',
    };
  }
};

// ─────────────────────────────────────────────
// 4. MULTI-STEP FORECAST
// ─────────────────────────────────────────────
const generateForecast = async ({ historical, hours, latitude, longitude }) => {
  try {
    return await callAI('/forecast', { historical: historical.map((r) => r.toObject()), hours, latitude, longitude });
  } catch {
    // Heuristic: rolling average + seasonal noise
    const recent = historical.slice(0, 7).map((r) => r.air_data?.pm25 || 50);
    const avg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);

    const steps = Math.ceil(hours / 24);
    const forecast = [];
    for (let i = 1; i <= steps; i++) {
      const noise = (Math.random() - 0.5) * 20;
      const point = Math.max(10, avg + noise);
      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        pm25: { value: Math.round(point), lower: Math.round(point * 0.8), upper: Math.round(point * 1.2) },
        aqi: { value: Math.round(point * 1.6), lower: Math.round(point * 1.3), upper: Math.round(point * 2) },
      });
    }

    return { method: 'rolling_average', horizon_days: steps, forecast, note: 'AI service unavailable. Heuristic forecast.' };
  }
};

// ─────────────────────────────────────────────
// 5. INSPECTION OPTIMIZATION
// ─────────────────────────────────────────────
const optimizeInspections = async ({ industries, top_n }) => {
  try {
    return await callAI('/inspection-optimization', { industries: industries.map((i) => i.toObject()), top_n });
  } catch {
    // Heuristic scoring: low compliance + high violations + not inspected recently
    const scored = industries.map((ind) => {
      const daysSinceReport = ind.last_report_date
        ? (Date.now() - new Date(ind.last_report_date).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      const score =
        (100 - (ind.compliance_score || 100)) * 0.5 +
        (ind.total_violations || 0) * 2 +
        Math.min(30, daysSinceReport);

      return {
        industry_id: ind._id,
        industry_name: ind.name,
        industry_type: ind.industry_type,
        location: ind.location?.coordinates,
        compliance_score: ind.compliance_score,
        total_violations: ind.total_violations,
        priority_score: score.toFixed(1),
        reason: [
          ind.compliance_score < 60 ? 'Low compliance score' : null,
          ind.total_violations > 5 ? 'High violation history' : null,
          daysSinceReport > 7 ? 'Missing recent reports' : null,
        ].filter(Boolean).join('; ') || 'Routine inspection',
      };
    });

    const recommendations = scored.sort((a, b) => b.priority_score - a.priority_score).slice(0, top_n);
    return { method: 'heuristic', recommendations, generated_at: new Date().toISOString() };
  }
};

module.exports = {
  attributePollutionSource,
  predictComplianceRisk,
  runDigitalTwinSimulation,
  generateForecast,
  optimizeInspections,
};
