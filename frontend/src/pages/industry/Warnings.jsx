import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { Empty, PageLoader, Spinner } from '../../components/common/UI';
import { warningsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';

export default function IndustryWarnings() {
  const { user } = useAuth();
  const industryId = user?.industry_id?._id || user?.industry_id;

  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(null);

  useEffect(() => {
    if (!industryId) return;
    warningsAPI
      .getAll({ industry_id: industryId })
      .then((res) => setWarnings(res.data.data || []))
      .catch(() => setWarnings([]))
      .finally(() => setLoading(false));
  }, [industryId]);

  const handleMarkRead = async (id) => {
    setMarking(id);
    try {
      await warningsAPI.markRead(id);
      setWarnings((prev) => prev.map((w) => (w._id === id ? { ...w, status: 'read', read_at: new Date() } : w)));
    } catch (e) {
      console.error(e);
    } finally {
      setMarking(null);
    }
  };

  const priorityColor = (p) => ({ low: '#6b7280', medium: '#f79009', high: '#ef4444', critical: '#dc2626' }[p] || '#6b7280');

  return (
    <>
      <PageHeader
        title="Warnings from regional officer"
        subtitle="Notices and action items sent by your regional officer — fix the issues listed and report back"
      />
      <PageContent>
        {loading ? (
          <PageLoader />
        ) : warnings.length === 0 ? (
          <Empty message="No warnings yet. The regional officer can send you warnings linked to reports (e.g. what to fix)." />
        ) : (
          <div className="space-y-4">
            {warnings.map((w) => (
              <div
                key={w._id}
                className="card p-5"
                style={{
                  borderLeft: `4px solid ${priorityColor(w.priority)}`,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{w.subject}</h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      From {w.sent_by?.name || 'Officer'} · {formatDate(w.created_at)}
                      {w.report_id && (
                        <span> · Linked to report {w.report_id.reporting_period ? `${w.report_id.reporting_period} (${formatDate(w.report_id.date)})` : formatDate(w.report_id.date)}</span>
                      )}
                    </p>
                    <p className="mt-3 text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{w.message}</p>
                    {w.action_items?.length > 0 && (
                      <ul className="mt-3 list-disc pl-5 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {w.action_items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: `${priorityColor(w.priority)}22`, color: priorityColor(w.priority) }}
                      >
                        {w.priority}
                      </span>
                      {w.status === 'sent' && (
                        <button
                          type="button"
                          className="ml-2 text-xs"
                          style={{ color: '#14b369', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => handleMarkRead(w._id)}
                          disabled={marking === w._id}
                        >
                          {marking === w._id ? '…' : 'Mark as read'}
                        </button>
                      )}
                      {w.status === 'read' && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>Read</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
