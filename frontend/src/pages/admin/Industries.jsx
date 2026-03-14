import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, ComplianceBadge, Modal, AlertBanner, Spinner, Empty, PageLoader } from '../../components/common/UI';
import { industriesAPI, regionsAPI } from '../../services/api';
import { INDUSTRY_TYPE_LABELS, formatDate } from '../../utils/helpers';

export default function AdminIndustries() {
  const [industries, setIndustries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '', industry_type: 'steel', region_id: '',
    location: { coordinates: ['', ''], address: '' },
    contact: { name: '', email: '', phone: '' },
  });

  const fetchIndustries = async () => {
    setLoading(true);
    try {
      const { data } = await industriesAPI.getAll({ search, compliance_status: statusFilter, page, limit: 15 });
      setIndustries(data.data);
      setPagination(data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchIndustries(); }, [search, statusFilter, page]);
  useEffect(() => {
    regionsAPI.getAll().then(({ data }) => setRegions(data.data));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        ...form,
        location: {
          type: 'Point',
          coordinates: [parseFloat(form.location.coordinates[0]), parseFloat(form.location.coordinates[1])],
          address: form.location.address,
        },
      };
      await industriesAPI.create(payload);
      setSuccess('Industry created successfully.');
      setShowModal(false);
      fetchIndustries();
    } catch (err) { setError(err.response?.data?.message || 'Failed to create.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Industries" subtitle="All registered industries across regions" />
      <PageContent>
        {success && <div className="mb-4"><AlertBanner type="success" message={success} /></div>}

        {/* Filters + incoming requests (for admin and reused for officer) */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input className="input" style={{ maxWidth: 260 }} placeholder="Search industries..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="input" style={{ maxWidth: 180 }} value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="compliant">Compliant</option>
            <option value="warning">Warning</option>
            <option value="violation">Violation</option>
            <option value="critical">Critical</option>
          </select>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {pagination.total ?? '—'} total industries
          </span>
          <Link
            to="/officer/industry-approvals"
            className="btn-primary text-xs"
            style={{ textDecoration: 'none' }}
          >
            Incoming Requests →
          </Link>
        </div>

        <div className="card overflow-hidden">
          {loading ? <PageLoader /> : industries.length === 0 ? <Empty /> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Violations</th>
                  <th>Last Report</th>
                </tr>
              </thead>
              <tbody>
                {industries.map((ind) => (
                  <tr key={ind._id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ind.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{INDUSTRY_TYPE_LABELS[ind.industry_type]}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{ind.region_id?.name || '—'}</td>
                    <td>
                      <span className="font-mono font-bold text-sm"
                        style={{ color: ind.compliance_score < 60 ? '#ef4444' : ind.compliance_score < 80 ? '#f79009' : '#14b369' }}>
                        {ind.compliance_score}
                      </span>
                    </td>
                    <td><ComplianceBadge status={ind.compliance_status} /></td>
                    <td className="font-mono" style={{ color: ind.total_violations > 10 ? '#ef4444' : 'var(--text-secondary)' }}>
                      {ind.total_violations}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                      {formatDate(ind.last_report_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button className="btn-ghost text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page} of {pagination.pages}</span>
            <button className="btn-ghost text-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </PageContent>

      {/* Admin-only manual industry creation modal (not used by officer view) */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Register New Industry" width="max-w-xl">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <AlertBanner type="error" message={error} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Industry Name</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Type</label>
              <select className="input" value={form.industry_type} onChange={(e) => setForm({ ...form, industry_type: e.target.value })}>
                {Object.entries(INDUSTRY_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Region</label>
              <select className="input" required value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                <option value="">Select region</option>
                {regions.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Longitude</label>
              <input className="input" type="number" step="0.0001" placeholder="72.8777"
                value={form.location.coordinates[0]}
                onChange={(e) => setForm({ ...form, location: { ...form.location, coordinates: [e.target.value, form.location.coordinates[1]] } })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Latitude</label>
              <input className="input" type="number" step="0.0001" placeholder="19.0760"
                value={form.location.coordinates[1]}
                onChange={(e) => setForm({ ...form, location: { ...form.location, coordinates: [form.location.coordinates[0], e.target.value] } })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Address</label>
              <input className="input" placeholder="MIDC, Pune" value={form.location.address}
                onChange={(e) => setForm({ ...form, location: { ...form.location, address: e.target.value } })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Contact Name</label>
              <input className="input" value={form.contact.name}
                onChange={(e) => setForm({ ...form, contact: { ...form.contact, name: e.target.value } })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Contact Email</label>
              <input className="input" type="email" value={form.contact.email}
                onChange={(e) => setForm({ ...form, contact: { ...form.contact, email: e.target.value } })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Spinner size="sm" /> : 'Register Industry'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
