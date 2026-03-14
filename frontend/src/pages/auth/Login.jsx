import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboard } from '../../utils/helpers';
import { Spinner, AlertBanner } from '../../components/common/UI';

const DEMO_USERS = [
  { role: 'Super Admin', email: 'admin@prithvinet.gov.in', password: 'Admin@1234', color: '#14b369' },
  { role: 'Regional Officer', email: 'officer.mumbai@prithvinet.gov.in', password: 'Officer@1234', color: '#0ea5e9' },
  { role: 'Industry', email: 'manager@steelcorp.com', password: 'Industry@1234', color: '#f79009' },
  { role: 'Citizen', email: 'amit.kumar@gmail.com', password: 'Citizen@1234', color: '#a78bfa' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(getRoleDashboard(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (demo) => setForm({ email: demo.email, password: demo.password });

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(20,179,105,0.12) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative">
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, color: '#14b369' }}>PrithviNet</div>
          <div className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-muted)' }}>
            Environmental Intelligence Platform
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 38, color: 'var(--text-primary)', lineHeight: 1.15 }}>
              Monitoring India's<br />
              <span style={{ color: '#14b369' }}>Environment</span><br />
              in Real Time
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              AI-powered pollution tracking, compliance enforcement, and policy simulation
              for government environment departments.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Monitoring Stations', val: '120+', icon: '📡' },
              { label: 'Industries Tracked', val: '2,400+', icon: '🏭' },
              { label: 'Daily Reports', val: '4,800', icon: '📋' },
              { label: 'AI Accuracy', val: '94%', icon: '🤖' },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="stat-number text-xl" style={{ color: '#14b369' }}>{s.val}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs" style={{ color: 'var(--text-muted)' }}>
          © 2025 Maharashtra Pollution Control Board · PrithviNet v1.0
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: '#14b369' }}>PrithviNet</div>
          </div>

          <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>
            Sign in
          </h1>
          <p className="mt-1 text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Access your environmental dashboard
          </p>

          {error && <div className="mb-5"><AlertBanner type="error" message={error} /></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wider uppercase block mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : 'Sign in →'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs text-center mb-3" style={{ color: 'var(--text-muted)' }}>
              — Quick demo access —
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map((d) => (
                <button
                  key={d.role}
                  onClick={() => quickLogin(d)}
                  className="text-left p-3 rounded-lg transition-all text-xs"
                  style={{
                    background: `${d.color}10`,
                    border: `1px solid ${d.color}30`,
                    color: d.color,
                  }}
                >
                  <div className="font-semibold">{d.role}</div>
                  <div className="opacity-70 truncate text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Click to fill
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
            New industry?{' '}
            <Link to="/signup" style={{ color: '#14b369' }}>Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
