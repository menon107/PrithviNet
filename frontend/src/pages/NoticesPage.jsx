import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../components/common/Layout';
import { Empty, PageLoader } from '../components/common/UI';
import { noticesAPI, regionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/helpers';

const AUDIENCE_LABELS = {
  everyone: 'Everyone',
  officers: 'All officers',
  industries: 'All industries',
  regions: 'Selected regions only',
};

export default function NoticesPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'super_admin' || user?.role === 'regional_officer';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [regions, setRegions] = useState([]);

  const [form, setForm] = useState({
    heading: '',
    body: '',
    audience_type: 'everyone',
    region_ids: [],
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const fetchList = () => {
    setLoading(true);
    noticesAPI
      .getAll({ limit: 50 })
      .then(({ data }) => {
        setList(data.data || []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (canCreate && showForm) {
      regionsAPI.getAll().then(({ data }) => setRegions(data.data || []));
    }
  }, [canCreate, showForm]);

  useEffect(() => {
    if (!selected) return;
    setDetailLoading(true);
    noticesAPI
      .getById(selected)
      .then(({ data }) => setSelected(data.data))
      .catch(() => setSelected(null))
      .finally(() => setDetailLoading(false));
  }, [selected]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.heading.trim() || !form.body.trim()) return;
    setSubmitLoading(true);
    try {
      await noticesAPI.create({
        heading: form.heading.trim(),
        body: form.body.trim(),
        audience_type: form.audience_type,
        region_ids: form.audience_type === 'regions' ? form.region_ids : undefined,
      });
      setForm({ heading: '', body: '', audience_type: 'everyone', region_ids: [] });
      setShowForm(false);
      fetchList();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selected?._id || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      const { data } = await noticesAPI.addComment(selected._id, { text: commentText.trim() });
      setSelected((prev) => (prev ? { ...prev, comments: [...(prev.comments || []), data.data] } : null));
      setCommentText('');
    } catch (err) {
      console.error(err);
    } finally {
      setCommentLoading(false);
    }
  };

  const toggleRegion = (id) => {
    setForm((prev) => ({
      ...prev,
      region_ids: prev.region_ids.includes(id)
        ? prev.region_ids.filter((r) => r !== id)
        : [...prev.region_ids, id],
    }));
  };

  return (
    <>
      <PageHeader
        title="Notices"
        subtitle="Announcements and updates. Only officers and super admins can publish; everyone can comment."
        actions={
          canCreate && !showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#14b369' }}
            >
              New notice
            </button>
          ) : null
        }
      />
      <PageContent>
        {showForm && canCreate && (
          <div className="card p-5 mb-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Publish a notice
            </h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Heading
                </label>
                <input
                  type="text"
                  value={form.heading}
                  onChange={(e) => setForm((p) => ({ ...p, heading: e.target.value }))}
                  placeholder="Notice title"
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Body
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Content..."
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent resize-y"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Who can see this notice
                </label>
                <select
                  value={form.audience_type}
                  onChange={(e) => setForm((p) => ({ ...p, audience_type: e.target.value, region_ids: [] }))}
                  className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm bg-transparent"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                {form.audience_type === 'regions' && regions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {regions.map((r) => (
                      <label key={r._id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.region_ids.includes(r._id)}
                          onChange={() => toggleRegion(r._id)}
                        />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {r.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitLoading || !form.heading.trim() || !form.body.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#14b369' }}
                >
                  {submitLoading ? 'Publishing…' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm({ heading: '', body: '', audience_type: 'everyone', region_ids: [] });
                  }}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : list.length === 0 ? (
          <Empty icon="📌" message="No notices yet." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              {list.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => setSelected(n._id)}
                  className="card p-4 text-left transition-all hover:border-green-500/40"
                  style={{
                    borderColor: (selected?._id || selected) === n._id ? 'rgba(20,179,105,0.5)' : 'var(--border)',
                    background: (selected?._id || selected) === n._id ? 'rgba(20,179,105,0.06)' : 'var(--bg-secondary)',
                  }}
                >
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {n.heading}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{n.published_by?.name || '—'}</span>
                    <span>{formatDateTime(n.created_at)}</span>
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}
                    >
                      {AUDIENCE_LABELS[n.audience_type] || n.audience_type}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:sticky lg:top-6">
              {selected && (
                <div className="card p-5" style={{ borderColor: 'var(--border)' }}>
                  {detailLoading ? (
                    <PageLoader />
                  ) : typeof selected === 'object' && selected.heading ? (
                    <>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {selected.heading}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="text-xs px-2 py-1 rounded border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                          Close
                        </button>
                      </div>
                      <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                        {selected.published_by?.name} · {formatDateTime(selected.created_at)} ·{' '}
                        {AUDIENCE_LABELS[selected.audience_type]}
                        {selected.audience_type === 'regions' &&
                          selected.region_ids?.length > 0 &&
                          ` (${selected.region_ids.map((r) => r.name).join(', ')})`}
                      </div>
                      <div
                        className="text-sm whitespace-pre-wrap mb-4 pb-4 border-b"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                      >
                        {selected.body}
                      </div>

                      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                        Comments ({selected.comments?.length || 0})
                      </div>
                      <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
                        {(selected.comments || []).map((c) => (
                          <div
                            key={c._id}
                            className="p-2 rounded-lg text-sm"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                          >
                            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                              {c.user_id?.name} · {formatDateTime(c.created_at)}
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>{c.text}</div>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleAddComment} className="flex gap-2">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 rounded-lg border px-3 py-2 text-sm bg-transparent"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                        <button
                          type="submit"
                          disabled={commentLoading || !commentText.trim()}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                          style={{ background: '#14b369' }}
                        >
                          {commentLoading ? '…' : 'Comment'}
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
