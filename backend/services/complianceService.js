/**
 * Compliance Service
 * Checks a submitted report against industry + regional environmental limits.
 * Returns violations, a 0-100 score, and a compliance status.
 *
 * Regulatory levels (acceptable limits): used when industry/region have no override.
 * Data within these limits is compliant; exceeding them yields violations and lower score.
 */
const DEFAULT_LIMITS = {
  air: { pm25: 60, pm10: 100, so2: 80, no2: 80, co: 4000, o3: 100 },
  water: { ph_min: 6.5, ph_max: 8.5, bod: 30, cod: 250, tss: 100, turbidity: 10 },
  noise: { day_db: 55, night_db: 45 },
};

/**
 * Resolve effective limit: industry-specific > region-level > global default
 */
const resolveLimit = (param, medium, industry) => {
  const industryLimit = industry?.emission_limits?.[medium]?.[param];
  if (industryLimit != null) return industryLimit;

  const regionLimit = industry?.region_id?.environmental_limits?.[medium]?.[param];
  if (regionLimit != null) return regionLimit;

  return DEFAULT_LIMITS[medium]?.[param] ?? null;
};

const checkAir = (airData, industry) => {
  if (!airData) return [];
  const violations = [];
  const params = ['pm25', 'pm10', 'so2', 'no2', 'co', 'o3'];

  for (const param of params) {
    const measured = airData[param];
    if (measured == null) continue;
    const limit = resolveLimit(param, 'air', industry);
    if (limit == null) continue;

    if (measured > limit) {
      violations.push({
        parameter: param.toUpperCase(),
        medium: 'air',
        measured_value: measured,
        limit_value: limit,
        excess_percentage: (((measured - limit) / limit) * 100).toFixed(1),
      });
    }
  }
  return violations;
};

const checkWater = (waterData, industry) => {
  if (!waterData) return [];
  const violations = [];

  // pH range check
  if (waterData.ph != null) {
    const phMin = resolveLimit('ph_min', 'water', industry);
    const phMax = resolveLimit('ph_max', 'water', industry);
    if (phMin != null && waterData.ph < phMin) {
      violations.push({ parameter: 'pH (low)', medium: 'water', measured_value: waterData.ph, limit_value: phMin, excess_percentage: 0 });
    }
    if (phMax != null && waterData.ph > phMax) {
      violations.push({ parameter: 'pH (high)', medium: 'water', measured_value: waterData.ph, limit_value: phMax, excess_percentage: 0 });
    }
  }

  const simpleParams = ['bod', 'cod', 'tss', 'turbidity'];
  for (const param of simpleParams) {
    const measured = waterData[param];
    if (measured == null) continue;
    const limit = resolveLimit(param, 'water', industry);
    if (limit == null) continue;
    if (measured > limit) {
      violations.push({
        parameter: param.toUpperCase(),
        medium: 'water',
        measured_value: measured,
        limit_value: limit,
        excess_percentage: (((measured - limit) / limit) * 100).toFixed(1),
      });
    }
  }
  return violations;
};

const checkNoise = (noiseData, industry) => {
  if (!noiseData) return [];
  const violations = [];

  const checks = [
    { key: 'day_db', label: 'Noise (Day)' },
    { key: 'night_db', label: 'Noise (Night)' },
  ];

  for (const { key, label } of checks) {
    const measured = noiseData[key];
    if (measured == null) continue;
    const limit = resolveLimit(key, 'noise', industry);
    if (limit == null) continue;
    if (measured > limit) {
      violations.push({
        parameter: label,
        medium: 'noise',
        measured_value: measured,
        limit_value: limit,
        excess_percentage: (((measured - limit) / limit) * 100).toFixed(1),
      });
    }
  }
  return violations;
};

/**
 * Compute score: start at 100, deduct points per violation scaled by excess %
 */
const computeScore = (violations) => {
  if (!violations.length) return 100;
  let deductions = 0;
  for (const v of violations) {
    const excess = parseFloat(v.excess_percentage) || 0;
    deductions += Math.min(30, 10 + excess * 0.5);
  }
  return Math.max(0, Math.round(100 - deductions));
};

const getStatus = (score, violations) => {
  if (!violations.length) return 'compliant';
  if (score >= 70) return 'warning';
  if (score >= 40) return 'violation';
  return 'critical';
};

/**
 * Main entry point
 * @param {Object} reportData - { air_data, water_data, noise_data }
 * @param {Object} industry - Mongoose Industry doc (with region_id populated)
 */
const checkCompliance = (reportData, industry) => {
  const { air_data, water_data, noise_data } = reportData;

  const violations = [
    ...checkAir(air_data, industry),
    ...checkWater(water_data, industry),
    ...checkNoise(noise_data, industry),
  ];

  const score = computeScore(violations);
  const status = getStatus(score, violations);
  const is_compliant = violations.length === 0;

  return { violations, score, status, is_compliant };
};

/**
 * Calculate AQI from PM2.5 (simplified Indian AQI formula)
 */
const calculateAQI = (pm25) => {
  if (pm25 == null) return null;
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 130) * 100));
};

const getAQICategory = (aqi) => {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'satisfactory';
  if (aqi <= 200) return 'moderate';
  if (aqi <= 300) return 'poor';
  if (aqi <= 400) return 'very_poor';
  return 'severe';
};

module.exports = { checkCompliance, calculateAQI, getAQICategory, DEFAULT_LIMITS };
