import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader, PageLoader, Spinner } from '../../components/common/UI';
import { industriesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export default function IndustryApprovalsPage() {
  const { user } = useAuth();
  const regionId = user?.region_id?._id || user?.region_id;

  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!regionId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await industriesAPI.getPending({ region_id: regionId });
        setPending(data.data);
      } catch (e) {
        console.error(e);
        setError(e.response?.data?.message || 'Failed to load pending industries.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [regionId]);

  const handleAction = async (id, action) => {
    setActionLoading(id + action);
    setError('');
    try {
      if (action === 'approve') {
        await industriesAPI.approve(id);
      } else {
        await industriesAPI.reject(id);
      }
      // Refresh pending list after action
      const { data } = await industriesAPI.getPending({ region_id: regionId });
      setPending(data.data);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.message || `Unable to ${action} industry.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Industry Approvals"
        subtitle="Review and approve new industry registrations in your region"
      />
      <PageContent>
        <div className="card p-5">
          <SectionHeader title="Pending Industries" />
          {error && (
            <div className="mb-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {pending.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No pending industry approvals for your region.
            </p>
          ) : (
            <div className="space-y-4">
              {pending.map((ind) => (
                <div
                  key={ind._id}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 rounded-xl"
                  style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid var(--border)' }}
                >
                  <div className="space-y-1 lg:col-span-1">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {ind.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {ind.industry_type?.replace('_', ' ')} · {ind.region_id?.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Requested by: {ind.user_id?.name} ({ind.user_id?.email})
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        className="btn-primary text-xs px-3 py-2"
                        disabled={actionLoading != null}
                        onClick={() => handleAction(ind._id, 'approve')}
                      >
                        {actionLoading === ind._id + 'approve' ? <Spinner size="xs" /> : 'Approve'}
                      </button>
                      <button
                        className="text-xs px-3 py-2 rounded-md border"
                        style={{ borderColor: 'var(--border)', color: '#ef4444', background: 'transparent' }}
                        disabled={actionLoading != null}
                        onClick={() => handleAction(ind._id, 'reject')}
                      >
                        {actionLoading === ind._id + 'reject' ? <Spinner size="xs" /> : 'Reject'}
                      </button>
                    </div>
                  </div>
                  <div className="lg:col-span-2 h-48 rounded-lg overflow-hidden">
                    <MapContainer
                      center={[21.2514, 81.6296]}
                      zoom={7}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                    >
                      <TileLayer url={TILE_URL} attribution="CartoDB" />
                      {ind.boundary_polygon?.length > 0 && (
                        <Polygon
                          positions={ind.boundary_polygon.map((p) => [p.lat, p.lng])}
                          pathOptions={{
                            color: '#38bdf8',
                            weight: 2,
                            fillColor: '#38bdf8',
                            fillOpacity: 0.15,
                          }}
                        />
                      )}
                    </MapContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </>
  );
}

