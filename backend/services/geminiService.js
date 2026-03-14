const axios = require('axios');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/**
 * Call Gemini API to generate report insights: what needs to be fixed and why.
 * @param {Object} report - MonitoringReport (air_data, water_data, noise_data, violations, compliance_score)
 * @param {Object} industry - Industry (name, industry_type, emission_limits)
 * @returns {Promise<{ summary: string, actionItems: string[], raw: string }>}
 */
async function getReportInsights(report, industry) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const limits = industry?.emission_limits || {};
  const violations = report.violations || [];
  const air = report.air_data || {};
  const water = report.water_data || {};
  const noise = report.noise_data || {};

  const prompt = `You are an environmental compliance analyst. Based on the following monitoring report and permitted limits for the industry, provide a brief analysis and a clear list of what the industry must fix.

Industry: ${industry?.name || 'Unknown'} (${industry?.industry_type || 'N/A'})
Compliance score: ${report.compliance_score ?? 'N/A'}/100
Has violations: ${report.has_violations ? 'Yes' : 'No'}

Report data (measured values):
- Air: PM2.5=${air.pm25 ?? '—'}, PM10=${air.pm10 ?? '—'}, SO2=${air.so2 ?? '—'}, NO2=${air.no2 ?? '—'}, CO=${air.co ?? '—'} (µg/m³)
- Water: pH=${water.ph ?? '—'}, BOD=${water.bod ?? '—'}, COD=${water.cod ?? '—'}, TSS=${water.tss ?? '—'}, Turbidity=${water.turbidity ?? '—'}
- Noise: Day=${noise.day_db ?? '—'} dB, Night=${noise.night_db ?? '—'} dB, Peak=${noise.peak_db ?? '—'} dB

Permitted limits (if any): PM2.5=${limits.pm25 ?? '—'}, PM10=${limits.pm10 ?? '—'}, pH=${limits.ph_min ?? '—'}-${limits.ph_max ?? '—'}, BOD=${limits.bod ?? '—'}, COD=${limits.cod ?? '—'}, Noise day=${limits.noise_day ?? '—'}, night=${limits.noise_night ?? '—'}

Recorded violations: ${violations.length ? JSON.stringify(violations) : 'None'}

Respond in this exact JSON format only (no markdown, no extra text):
{
  "summary": "2-4 sentence summary of the main issues and risk level.",
  "actionItems": ["First specific action to fix", "Second action", "..."],
  "priority": "high|medium|low"
}
List 3-6 concrete action items. Be specific (parameter names, limits, and what to do).`;

  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  const res = await axios.post(url, payload, { timeout: 30000 });
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty or invalid response from Gemini');
  }

  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return {
      summary: parsed.summary || '',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      priority: parsed.priority || 'medium',
      raw: text,
    };
  } catch {
    const summaryMatch = trimmed.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/);
    const extractedSummary = summaryMatch ? summaryMatch[1].replace(/\\(.)/g, '$1') : trimmed;
    return {
      summary: extractedSummary,
      actionItems: [],
      priority: 'medium',
      raw: text,
    };
  }
}

module.exports = { getReportInsights };
