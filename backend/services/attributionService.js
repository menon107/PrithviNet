/**
 * Pollution attribution engine: probability-based detection of which industry
 * likely contributed to observed pollution at a given location.
 *
 * Uses: inverse-distance weighting, compliance/violation history, and optional
 * emission profile. Results are normalized to probabilities (sum = 1).
 */

const Industry = require('../models/Industry');
const MonitoringReport = require('../models/MonitoringReport');
const mongoose = require('mongoose');

const toRad = (x) => (x * Math.PI) / 180;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Raw contribution score for one industry (higher = more likely source).
 * - Distance: inverse-distance weighting (closer => higher).
 * - Compliance: lower score / more violations => higher.
 * - Emission: if pollutant present in recent reports, scale by level.
 */
function industryContributionScore({
  distanceKm,
  complianceScore,
  totalViolations,
  recentEmissionLevel,
  decayDistanceKm = 15,
  maxDistanceKm = 80,
}) {
  if (distanceKm > maxDistanceKm) return 0;

  // Inverse distance: 1 / (1 + (d/decay)^1.5); scale so 0 km => ~1, 15 km => ~0.2
  const dNorm = distanceKm / decayDistanceKm;
  const distanceScore = 1 / (1 + dNorm ** 1.5);

  // Compliance: worse compliance => higher likelihood (0–1 scale, inverted)
  const complianceNorm = complianceScore != null ? (100 - Math.min(100, Math.max(0, complianceScore))) / 100 : 0.3;
  const complianceFactor = 0.5 + 0.5 * complianceNorm;

  // Violations: more violations => slightly higher weight (capped)
  const violationFactor = 1 + Math.min(1, (totalViolations || 0) / 20) * 0.4;

  // Emission: if we have a recent reading for this pollutant, boost
  const emissionFactor = recentEmissionLevel != null && recentEmissionLevel > 0
    ? 1 + Math.min(1, recentEmissionLevel / 200) * 0.3
    : 1;

  return distanceScore * complianceFactor * violationFactor * emissionFactor;
}

/**
 * GET attribution for a point (lat, lng). Returns industries with probabilities.
 * @param {Object} opts - { latitude, longitude, region_id, pollutant }
 * @returns {Object} { attribution: [{ industry_id, name, probability, distance_km, factors }], method }
 */
async function getAttributionForPoint({ latitude, longitude, region_id, pollutant = 'pm25' }) {
  let filter = { is_active: true, approval_status: 'approved' };
  if (region_id) filter.region_id = new mongoose.Types.ObjectId(region_id);

  let industries = await Industry.find(filter)
    .select('name industry_type location compliance_score total_violations emission_limits')
    .lean();

  let expandedSearch = false;
  if (industries.length === 0 && region_id) {
    filter = { is_active: true, approval_status: 'approved' };
    industries = await Industry.find(filter)
      .select('name industry_type location compliance_score total_violations emission_limits')
      .lean();
    expandedSearch = true;
  }

  if (industries.length === 0) {
    return { attribution: [], method: 'distance_compliance', note: 'No approved industries in database.' };
  }

  // Optional: recent emission levels per industry for this pollutant (from latest report)
  const industryIds = industries.map((i) => i._id);
  const latestReports = await MonitoringReport.aggregate([
    { $match: { industry_id: { $in: industryIds } } },
    { $sort: { date: -1 } },
    { $group: { _id: '$industry_id', air_data: { $first: '$air_data' } } },
  ]);
  const emissionByIndustry = Object.fromEntries(
    latestReports.map((r) => {
      const level = r.air_data?.[pollutant];
      return [r._id.toString(), level];
    })
  );

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const scores = [];

  for (const ind of industries) {
    const coords = ind.location?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lon, latInd] = coords;
    const distanceKm = haversineKm(lat, lng, latInd, lon);
    const recentEmission = emissionByIndustry[ind._id.toString()];

    const score = industryContributionScore({
      distanceKm,
      complianceScore: ind.compliance_score,
      totalViolations: ind.total_violations || 0,
      recentEmissionLevel: recentEmission,
      decayDistanceKm: 12,
      maxDistanceKm: 80,
    });

    const factors = [];
    if (distanceKm < 5) factors.push('Very close to monitoring point');
    else if (distanceKm < 15) factors.push('Within likely impact range');
    if (ind.compliance_score != null && ind.compliance_score < 70) factors.push('Below-average compliance');
    if ((ind.total_violations || 0) > 5) factors.push('History of violations');
    if (recentEmission != null && recentEmission > 0) factors.push(`Recent ${pollutant.toUpperCase()} reported`);

    scores.push({
      industry_id: ind._id,
      name: ind.name,
      industry_type: ind.industry_type,
      distance_km: Math.round(distanceKm * 10) / 10,
      raw_score: score,
      factors: factors.length ? factors : ['Distance and compliance weighting'],
    });
  }

  const total = scores.reduce((s, x) => s + x.raw_score, 0);
  if (total === 0) {
    return { attribution: [], method: 'distance_compliance', note: 'No industries within range.' };
  }

  const attribution = scores
    .map((s) => ({
      ...s,
      probability: Math.round((s.raw_score / total) * 1000) / 1000,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10)
    .map(({ raw_score, ...rest }) => ({ ...rest, probability_pct: (rest.probability * 100).toFixed(1) }));

  return {
    attribution,
    pollutant,
    location: { latitude: lat, longitude: lng },
    method: 'distance_compliance',
    note: expandedSearch
      ? 'No industries in your region; showing nearest industries (all regions). Probability based on distance, compliance, and recent emissions.'
      : 'Probability based on distance, compliance history, and recent emissions.',
  };
}

module.exports = { getAttributionForPoint, haversineKm, industryContributionScore };
