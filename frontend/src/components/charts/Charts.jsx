import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend,
} from 'recharts';
import { format } from 'date-fns';

const CHART_STYLE = {
  fontSize: 11,
  fontFamily: 'DM Sans, sans-serif',
};

const TooltipContent = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs" style={{ minWidth: 140 }}>
      <p className="mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
            {unit && ` ${unit}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export const AQITrendChart = ({ data, height = 240 }) => {
  const formatted = (data || []).map((d) => ({
    ...d,
    date: d._id ? d._id.slice(5) : d.date,
  })).reverse();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} style={CHART_STYLE}>
        <defs>
          <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#14b369" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#14b369" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="pm25Grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f79009" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f79009" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} />
        <YAxis stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipContent unit="µg/m³" />} />
        <Legend wrapperStyle={{ color: '#8899bb', fontSize: 11 }} />
        <ReferenceLine y={100} stroke="#eab308" strokeDasharray="4 4" opacity={0.5} label={{ value: 'Moderate limit', fill: '#eab308', fontSize: 10 }} />
        <Area type="monotone" dataKey="avg_aqi" name="Avg AQI" stroke="#14b369" fill="url(#aqiGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="avg_pm25" name="PM 2.5" stroke="#f79009" fill="url(#pm25Grad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const ComplianceScoreChart = ({ data, height = 200 }) => {
  const formatted = (data || []).map((d) => ({
    date: d.date ? format(new Date(d.date), 'dd MMM') : d._id,
    score: d.score ?? d.compliance_score,
    compliant: d.is_compliant ? 1 : 0,
  })).reverse();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} style={CHART_STYLE}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} />
        <YAxis domain={[0, 100]} stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipContent unit="%" />} />
        <ReferenceLine y={70} stroke="#f79009" strokeDasharray="4 4" opacity={0.5} />
        <Line type="monotone" dataKey="score" name="Score" stroke="#14b369" strokeWidth={2.5}
          dot={{ fill: '#14b369', r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const ForecastChart = ({ data, height = 280 }) => {
  const formatted = (data || []).map((d) => ({
    date: d.date ? d.date.slice(5) : '',
    pm25: d.pm25?.value,
    pm25_low: d.pm25?.lower,
    pm25_high: d.pm25?.upper,
    aqi: d.aqi?.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} style={CHART_STYLE}>
        <defs>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} />
        <YAxis stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipContent unit="µg/m³" />} />
        <Legend wrapperStyle={{ color: '#8899bb', fontSize: 11 }} />
        <Area type="monotone" dataKey="pm25_high" name="Upper bound" stroke="none" fill="url(#rangeGrad)" />
        <Area type="monotone" dataKey="pm25" name="PM 2.5 forecast" stroke="#0ea5e9" fill="url(#forecastGrad)" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="aqi" name="AQI" stroke="#f79009" strokeWidth={2} dot={false} strokeDasharray="5 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const WaterTrendChart = ({ data, height = 220 }) => {
  const formatted = (data || []).map((d) => ({
    date: (d._id || d.date || '').slice(5),
    pH: d.avg_ph != null ? Number(d.avg_ph.toFixed(2)) : null,
    BOD: d.avg_bod != null ? Number(d.avg_bod.toFixed(1)) : null,
    COD: d.avg_cod != null ? Number(d.avg_cod.toFixed(1)) : null,
  })).reverse().slice(-30);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} style={CHART_STYLE}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} />
        <YAxis stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ color: '#8899bb', fontSize: 11 }} />
        <Line type="monotone" dataKey="pH" name="pH" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="BOD" name="BOD (mg/L)" stroke="#f97316" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="COD" name="COD (mg/L)" stroke="#a78bfa" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const NoiseTrendChart = ({ data, height = 220 }) => {
  const formatted = (data || []).map((d) => ({
    date: (d._id || d.date || '').slice(5),
    Day: d.avg_day_db != null ? Number(d.avg_day_db.toFixed(1)) : null,
    Night: d.avg_night_db != null ? Number(d.avg_night_db.toFixed(1)) : null,
    Peak: d.max_peak_db != null ? Number(d.max_peak_db.toFixed(1)) : null,
  })).reverse().slice(-30);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} style={CHART_STYLE}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} />
        <YAxis stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipContent unit="dB" />} />
        <Legend wrapperStyle={{ color: '#8899bb', fontSize: 11 }} />
        <Line type="monotone" dataKey="Day" name="Day dB" stroke="#0ea5e9" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Night" name="Night dB" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Peak" name="Peak dB" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const PollutantBarChart = ({ data, height = 220 }) => {
  const formatted = (data || []).map((d) => ({
    date: (d._id || d.date || '').slice(5),
    PM25: d.avg_pm25 != null ? Number(d.avg_pm25.toFixed(0)) : null,
    PM10: d.avg_pm10 != null ? Number(d.avg_pm10.toFixed(0)) : null,
    NO2: d.avg_no2 != null ? Number(d.avg_no2.toFixed(0)) : null,
    SO2: d.avg_so2 != null ? Number(d.avg_so2.toFixed(0)) : null,
  })).reverse().slice(-14);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} barCategoryGap="35%" style={CHART_STYLE}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="date" stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} />
        <YAxis stroke="#4a5875" tick={{ fill: '#4a5875' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipContent unit="µg/m³" />} />
        <Legend wrapperStyle={{ color: '#8899bb', fontSize: 11 }} />
        <Bar dataKey="PM25" fill="#14b369" radius={[3, 3, 0, 0]} />
        <Bar dataKey="PM10" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
        <Bar dataKey="NO2" fill="#f79009" radius={[3, 3, 0, 0]} />
        <Bar dataKey="SO2" fill="#a78bfa" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
