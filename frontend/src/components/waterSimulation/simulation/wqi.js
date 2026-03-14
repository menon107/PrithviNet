/**
 * Water Quality Index (WQI) engine.
 * Weighted sub-index model — each parameter normalised to 0–100,
 * multiplied by weight, summed → WQI 0–100. Higher WQI = cleaner water.
 */

export const PARAMS = {
  ph:   { label: 'pH',           weight: 0.15, unit: '',        min: 0,  max: 14,    step: 0.1 },
  cod:  { label: 'COD',          weight: 0.20, unit: 'mg/L',   min: 0,  max: 500,   step: 1   },
  bod:  { label: 'BOD',          weight: 0.20, unit: 'mg/L',   min: 0,  max: 100,   step: 0.5 },
  do_:  { label: 'Dissolved O₂', weight: 0.20, unit: 'mg/L',   min: 0,  max: 14,    step: 0.1 },
  turb: { label: 'Turbidity',    weight: 0.10, unit: 'NTU',    min: 0,  max: 200,   step: 1   },
  nit:  { label: 'Nitrates',     weight: 0.08, unit: 'mg/L',   min: 0,  max: 100,   step: 0.5 },
  temp: { label: 'Temperature',  weight: 0.04, unit: '°C',     min: 0,  max: 45,    step: 0.5 },
  col:  { label: 'Coliform',     weight: 0.03, unit: 'CFU/mL', min: 0,  max: 10000, step: 10  },
};

function subIndex(key, val) {
  switch (key) {
    case 'ph': {
      const dist = Math.max(0, Math.abs(val - 7.5) - 1.5);
      return Math.max(0, 100 - (dist / 3) * 100);
    }
    case 'cod':  return Math.max(0, 100 - (val / 250) * 100);
    case 'bod':  return Math.max(0, 100 - (val / 30)  * 100);
    case 'do_':  return Math.min(100, (val / 8) * 100);
    case 'turb': return Math.max(0, 100 - (val / 100) * 100);
    case 'nit':  return Math.max(0, 100 - (val / 50)  * 100);
    case 'temp': {
      const dist = val < 10 ? 10 - val : val > 25 ? val - 25 : 0;
      return Math.max(0, 100 - (dist / 15) * 100);
    }
    case 'col':  return Math.max(0, 100 - (val / 5000) * 100);
    default:     return 100;
  }
}

export function computeWQI(params) {
  let totalWeight = 0, weightedSum = 0;
  const breakdown = {};
  Object.keys(PARAMS).forEach(key => {
    const val = params[key] ?? 0;
    const si  = subIndex(key, val);
    const w   = PARAMS[key].weight;
    breakdown[key] = { si: Math.round(si) };
    weightedSum += si * w;
    totalWeight  += w;
  });
  const wqi = Math.round(weightedSum / totalWeight);
  return { wqi, breakdown };
}

export function wqiToColor(wqi) {
  if (wqi >= 80) return '#22d3ee';
  if (wqi >= 60) return '#a3e635';
  if (wqi >= 40) return '#facc15';
  if (wqi >= 20) return '#fb923c';
  return '#ef4444';
}

export function wqiGrade(wqi) {
  if (wqi >= 80) return { grade: 'Pristine',  desc: 'Excellent water quality' };
  if (wqi >= 60) return { grade: 'Good',      desc: 'Suitable for most uses' };
  if (wqi >= 40) return { grade: 'Fair',      desc: 'Some pollutants present' };
  if (wqi >= 20) return { grade: 'Poor',      desc: 'High pollution — treatment needed' };
  return              { grade: 'Critical',  desc: 'Severely contaminated' };
}

export function defaultParams() {
  return { ph: 7.2, cod: 20, bod: 3, do_: 8, turb: 8, nit: 4, temp: 22, col: 0 };
}

export const PRESETS = {
  pristine:   { ph: 7.4, cod: 10,  bod: 1.5, do_: 9.5, turb: 2,   nit: 1,  temp: 18, col: 0    },
  urban:      { ph: 7.0, cod: 120, bod: 18,  do_: 5,   turb: 60,  nit: 20, temp: 25, col: 500  },
  industrial: { ph: 4.5, cod: 350, bod: 60,  do_: 2,   turb: 140, nit: 45, temp: 35, col: 2000 },
  sewage:     { ph: 8.5, cod: 480, bod: 90,  do_: 0.5, turb: 190, nit: 80, temp: 30, col: 9000 },
};
