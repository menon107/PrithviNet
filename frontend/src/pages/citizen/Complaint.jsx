import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { AlertBanner, Spinner, SectionHeader } from '../../components/common/UI';
import { complaintsAPI, regionsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function CitizenComplaint() {
  const { user } = useAuth();
  const [regions, setRegions] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'air_pollution', region_id: '', is_anonymous: false });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [myComplaints, setMyComplaints] = useState([]);

  useEffect(() => {
    regionsAPI.getAll().then(({ data }) => setRegions(data.data));
    complaintsAPI.getAll({ limit: 10 }).then(({ data }) => setMyComplaints(data.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setError(''); setSuccess(false);
    try {
      await complaintsAPI.submit({ ...form });
      setSuccess(true);
      setForm({ title: '', description: '', category: 'air_pollution', region_id: form.region_id, is_anonymous: false });
      complaintsAPI.getAll({ limit: 10 }).then(({ data }) => setMyComplaints(data.data)).catch(() => {});
    } catch (err) { setError(err.response?.data?.message || 'Submission failed.'); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <PageHeader title="Report an Issue" subtitle="Help us keep your environment clean" />
      <PageContent>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-6">
            <SectionHeader title="Submit Complaint" />
            {success && <div className="mb-4"><AlertBanner type="success" message="Complaint submitted successfully. Our officers will investigate." /></div>}
            {error && <div className="mb-4"><AlertBanner type="error" message={error} /></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Category</label>
                <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option value="air_pollution">💨 Air Pollution</option>
                  <option value="water_pollution">💧 Water Pollution</option>
                  <option value="noise_pollution">🔊 Noise Pollution</option>
                  <option value="illegal_dumping">🗑 Illegal Dumping</option>
                  <option value="other">📣 Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Region</label>
                <select className="input" required value={form.region_id} onChange={e => setForm({...form, region_id: e.target.value})}>
                  <option value="">Select region</option>
                  {regions.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Title</label>
                <input className="input" required placeholder="Brief description of the issue" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</label>
                <textarea className="input" rows={5} required placeholder="Describe what you observed, including location, time, and any other details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ resize: 'vertical' }} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" style={{ accentColor: '#14b369' }} checked={form.is_anonymous} onChange={e => setForm({...form, is_anonymous: e.target.checked})} />
                Submit anonymously
              </label>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {submitting ? <Spinner size="sm" /> : '📣 Submit Complaint'}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <SectionHeader title="My Previous Complaints" />
            {myComplaints.length === 0 ? (
              <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>No complaints submitted yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {myComplaints.map(c => (
                  <div key={c._id} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: c.status === 'resolved' ? '#14b369' : 'var(--text-muted)', background: c.status === 'resolved' ? 'rgba(20,179,105,0.1)' : 'rgba(255,255,255,0.05)' }}>
                        {c.status.replace('_',' ')}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}
