import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { StatCard, SectionHeader, Modal, AlertBanner, Spinner, Empty, PageLoader } from '../../components/common/UI';
import { regionsAPI } from '../../services/api';

export default function AdminRegions() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', state: 'Maharashtra', district: '', coordinates: { type: 'Point', coordinates: [73, 19] } });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    regionsAPI.getAll().then(({ data }) => { setRegions(data.data); setLoading(false); });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await regionsAPI.create(form);
      setShowModal(false);
      regionsAPI.getAll().then(({ data }) => setRegions(data.data));
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Regions" subtitle="Monitored districts and zones"
        actions={<button className="btn-primary text-sm" onClick={() => setShowModal(true)}>+ Add Region</button>} />
      <PageContent>
        {loading ? <PageLoader /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {regions.map(r => (
              <div key={r._id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p style={{ fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>{r.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.state} · {r.district || 'District N/A'}</p>
                  </div>
                  <span className="text-2xl">🗺</span>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Officer</span><span style={{ color: 'var(--text-secondary)' }}>{r.regional_officer_id?.name || 'Unassigned'}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Stations</span><span style={{ color: 'var(--text-secondary)' }}>{r.monitoring_stations?.length || 0}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Population</span><span style={{ color: 'var(--text-secondary)' }}>{r.population?.toLocaleString() || '—'}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Region">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <AlertBanner type="error" message={error} />}
          {[{k:'name',l:'Region Name'},{k:'state',l:'State'},{k:'district',l:'District'}].map(({k,l}) => (
            <div key={k}>
              <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>{l}</label>
              <input className="input" required={k!=='district'} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">{saving ? <Spinner size="sm"/> : 'Create Region'}</button>
            <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
