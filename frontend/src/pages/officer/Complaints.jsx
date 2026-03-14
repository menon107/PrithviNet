import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { Empty, PageLoader, SeverityBadge } from '../../components/common/UI';
import { complaintsAPI } from '../../services/api';
import { formatDate, timeAgo } from '../../utils/helpers';

const CAT_ICONS = { air_pollution:'💨', water_pollution:'💧', noise_pollution:'🔊', illegal_dumping:'🗑', other:'📣' };

export default function OfficerComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    complaintsAPI.getAll({ status: filter, limit: 30 }).then(({ data }) => {
      setComplaints(data.data); setLoading(false);
    });
  }, [filter]);

  const handleUpdate = async (id, status) => {
    await complaintsAPI.updateStatus(id, { status });
    complaintsAPI.getAll({ status: filter, limit: 30 }).then(({ data }) => setComplaints(data.data));
  };

  return (
    <>
      <PageHeader title="Citizen Complaints" subtitle="Public reported issues in your region" />
      <PageContent>
        <div className="flex items-center gap-3 mb-5">
          {['', 'submitted', 'under_investigation', 'resolved'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: filter === s ? 'rgba(20,179,105,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${filter === s ? 'rgba(20,179,105,0.3)' : 'var(--border)'}`, color: filter === s ? '#14b369' : 'var(--text-secondary)' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
        {loading ? <PageLoader /> : complaints.length === 0 ? <Empty icon="📣" message="No complaints found" /> : (
          <div className="flex flex-col gap-3">
            {complaints.map(c => (
              <div key={c._id} className="card p-4 flex items-start gap-4">
                <span className="text-2xl">{CAT_ICONS[c.category]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-semibold text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      {c.category.replace('_',' ')}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{timeAgo(c.created_at)}</span>
                    {c.is_anonymous ? <span>Anonymous</span> : c.submitted_by && <span>{c.submitted_by.name}</span>}
                    <span className="capitalize ml-auto" style={{ color: c.status === 'resolved' ? '#14b369' : 'var(--text-muted)' }}>{c.status.replace('_',' ')}</span>
                  </div>
                </div>
                {c.status === 'submitted' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => handleUpdate(c._id, 'under_investigation')} className="text-xs px-3 py-1.5 rounded" style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.2)' }}>Investigate</button>
                    <button onClick={() => handleUpdate(c._id, 'resolved')} className="text-xs px-3 py-1.5 rounded" style={{ background: 'rgba(20,179,105,0.1)', color: '#14b369', border: '1px solid rgba(20,179,105,0.2)' }}>Resolve</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
