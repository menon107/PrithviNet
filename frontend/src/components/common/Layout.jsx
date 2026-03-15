import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/helpers';

const NAV_ITEMS = {
  super_admin: [
    { to: '/admin', label: 'Dashboard', icon: '⬡', end: true },
    { to: '/admin/regions', label: 'Regions', icon: '🗺' },
    { to: '/admin/industries', label: 'Industries', icon: '🏭' },
    { to: '/admin/reports', label: 'Reports', icon: '📋' },
    { to: '/admin/alerts', label: 'Alerts', icon: '🔔' },
    { to: '/admin/notices', label: 'Notices', icon: '📌' },
    { to: '/admin/chatbot', label: 'Chatbot', icon: '💬' },
    { to: '/admin/users', label: 'User Mgmt', icon: '👥' },
  ],
  regional_officer: [
    { to: '/officer', label: 'Dashboard', icon: '⬡', end: true },
    { to: '/officer/map', label: 'Pollution Map', icon: '🗺' },
    { to: '/officer/simulation', label: 'Simulation', icon: '🧪' },
    { to: '/officer/industries', label: 'Industries', icon: '🏭' },
    { to: '/officer/reports', label: 'Reports', icon: '📋' },
    { to: '/officer/alerts', label: 'Alerts', icon: '🔔' },
    { to: '/officer/notices', label: 'Notices', icon: '📌' },
    { to: '/officer/chatbot', label: 'Chatbot', icon: '💬' },
    { to: '/officer/complaints', label: 'Complaints', icon: '📣' },
  ],
  industry: [
    { to: '/industry', label: 'Dashboard', icon: '⬡', end: true },
    { to: '/industry/submit-report', label: 'Submit Report', icon: '📤' },
    { to: '/industry/reports', label: 'My Reports', icon: '📋' },
    { to: '/industry/warnings', label: 'Warnings', icon: '📩' },
    { to: '/industry/compliance', label: 'Compliance', icon: '✅' },
    { to: '/industry/alerts', label: 'Alerts', icon: '🔔' },
    { to: '/industry/notices', label: 'Notices', icon: '📌' },
  ],
  citizen: [
    { to: '/citizen', label: 'Air Quality', icon: '💨', end: true },
    { to: '/citizen/map', label: 'Pollution Map', icon: '🗺' },
    { to: '/citizen/industries', label: 'Industries', icon: '🏭' },
    { to: '/citizen/forecast', label: 'Forecast', icon: '📡' },
    { to: '/citizen/complaint', label: 'Report Issue', icon: '📣' },
  ],
};

export const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const navItems = NAV_ITEMS[user?.role] || [];
  const roleColor = ROLE_COLORS[user?.role] || '#14b369';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r transition-all duration-300"
        style={{
          width: collapsed ? 64 : 220,
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
            style={{ background: 'rgba(20,179,105,0.15)', color: '#14b369', fontFamily: 'Syne, sans-serif', fontWeight: 800 }}>
            P
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color: '#14b369', lineHeight: 1 }}>
                PrithviNet
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>
                ENV MONITORING
              </div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `${roleColor}22`, color: roleColor }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                <p className="text-xs truncate" style={{ color: roleColor }}>{ROLE_LABELS[user?.role]}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="btn-ghost w-full text-xs mb-1"
            style={{ padding: '7px 8px', justifyContent: 'center' }}
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
          <button onClick={logout} className="btn-ghost w-full text-xs" style={{ padding: '7px 8px' }}>
            {collapsed ? '⇠' : 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

// Page wrapper with consistent padding + header
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="px-7 py-6 border-b flex items-center justify-between"
    style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
    <div>
      <h1 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>
        {title}
      </h1>
      {subtitle && <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

export const PageContent = ({ children }) => (
  <div className="p-7 animate-fade-in">{children}</div>
);
