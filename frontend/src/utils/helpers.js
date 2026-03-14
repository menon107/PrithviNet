import { format, formatDistanceToNow } from 'date-fns';

export const formatDate = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';
export const formatDateTime = (d) => d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '—';
export const timeAgo = (d) => d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—';

export const getAQICategory = (aqi) => {
  if (aqi == null) return { label: 'N/A', color: '#6b7280', bg: 'rgba(107,114,128,0.15)', cls: '' };
  if (aqi <= 50) return { label: 'Good', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', cls: 'aqi-good' };
  if (aqi <= 100) return { label: 'Satisfactory', color: '#84cc16', bg: 'rgba(132,204,22,0.15)', cls: 'aqi-satisfactory' };
  if (aqi <= 200) return { label: 'Moderate', color: '#eab308', bg: 'rgba(234,179,8,0.15)', cls: 'aqi-moderate' };
  if (aqi <= 300) return { label: 'Poor', color: '#f97316', bg: 'rgba(249,115,22,0.15)', cls: 'aqi-poor' };
  if (aqi <= 400) return { label: 'Very Poor', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', cls: 'aqi-very-poor' };
  return { label: 'Severe', color: '#9333ea', bg: 'rgba(147,51,234,0.15)', cls: 'aqi-severe' };
};

export const getComplianceBadge = (status) => ({
  compliant: { label: 'Compliant', cls: 'badge-compliant' },
  warning: { label: 'Warning', cls: 'badge-warning' },
  violation: { label: 'Violation', cls: 'badge-violation' },
  critical: { label: 'Critical', cls: 'badge-critical' },
}[status] || { label: status, cls: '' });

export const getSeverityColor = (s) => ({
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
}[s] || '#6b7280');

export const INDUSTRY_TYPE_LABELS = {
  steel: 'Steel', cement: 'Cement', chemical: 'Chemical', textile: 'Textile',
  paper: 'Paper', pharmaceutical: 'Pharma', power_plant: 'Power Plant',
  refinery: 'Refinery', fertilizer: 'Fertilizer', mining: 'Mining',
  food_processing: 'Food Processing', auto: 'Automotive', other: 'Other',
};

export const ROLE_LABELS = {
  super_admin: 'Super Admin', regional_officer: 'Regional Officer',
  industry: 'Industry', citizen: 'Citizen',
};

export const ROLE_COLORS = {
  super_admin: '#14b369', regional_officer: '#0ea5e9',
  industry: '#f79009', citizen: '#a78bfa',
};

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const getRoleDashboard = (role) => ({
  super_admin: '/admin', regional_officer: '/officer',
  industry: '/industry', citizen: '/citizen',
}[role] || '/');
