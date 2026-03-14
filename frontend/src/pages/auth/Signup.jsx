import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboard } from '../../utils/helpers';
import { Spinner, AlertBanner } from '../../components/common/UI';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'citizen',
    phone: '',
    industry_type: 'steel',
  });
  const [location, setLocation] = useState(null);
  const [polygon, setPolygon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // no-op for now; kept in case we want to prefetch metadata later
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = { ...form };

      // Attach location + polygon for industry signup
      if (form.role === 'industry') {
        if (!location) {
          throw new Error('Please select your industry location on the map.');
        }
        if (polygon.length < 3) {
          throw new Error('Please draw a boundary polygon with at least 3 points.');
        }
        payload.location = {
          latitude: location.lat,
          longitude: location.lng,
        };
        payload.boundary_polygon = polygon.map((p) => [p.lat, p.lng]);
      }

      const user = await signup(payload);
      navigate(getRoleDashboard(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Signup failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: '#14b369' }}>PrithviNet</div>
          <h1 className="mt-4" style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>
            Create account
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Citizens and industries can self-register
          </p>
        </div>

        {error && <div className="mb-4"><AlertBanner type="error" message={error} /></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Account Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'citizen', label: '👤 Citizen' },
                { val: 'industry', label: '🏭 Industry' },
              ].map((r) => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => setForm({ ...form, role: r.val })}
                  className="py-2.5 px-4 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: form.role === r.val ? 'rgba(20,179,105,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${form.role === r.val ? 'rgba(20,179,105,0.4)' : 'var(--border)'}`,
                    color: form.role === r.val ? '#14b369' : 'var(--text-secondary)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: 'name', label: 'Full Name', type: 'text', placeholder: form.role === 'industry' ? 'Company Name' : 'Your Name' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { key: 'password', label: 'Password', type: 'password', placeholder: 'Min. 8 characters' },
            { key: 'phone', label: 'Phone (optional)', type: 'tel', placeholder: '+91 98765 43210' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {label}
              </label>
              <input
                className="input"
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key !== 'phone'}
              />
            </div>
          ))}

          {form.role === 'industry' && (
            <>
              {/* Industry type */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Industry Type
                </label>
                <select
                  className="input"
                  value={form.industry_type}
                  onChange={(e) => setForm({ ...form, industry_type: e.target.value })}
                  required
                >
                  {[
                    { value: 'steel', label: 'Steel' },
                    { value: 'cement', label: 'Cement' },
                    { value: 'chemical', label: 'Chemical' },
                    { value: 'textile', label: 'Textile' },
                    { value: 'refinery', label: 'Refinery' },
                    { value: 'power_plant', label: 'Power Plant' },
                    { value: 'other', label: 'Other' },
                  ].map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Map-based location + boundary */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Location & Boundary
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Click on the map once to set your industry location, then click multiple points to draw your boundary polygon.
                </p>
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', height: 260 }}>
                  <IndustrySignupMap
                    location={location}
                    polygon={polygon}
                    onLocationChange={setLocation}
                    onPolygonChange={setPolygon}
                  />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2">
            {loading ? <Spinner size="sm" /> : 'Create account →'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#14b369' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function IndustrySignupMap({ location, polygon, onLocationChange, onPolygonChange }) {
  const [drawing, setDrawing] = useState(false);

  const center = [21.2514, 81.6296]; // Chhattisgarh

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const { latlng } = e;
        if (!location) {
          onLocationChange({ lat: latlng.lat, lng: latlng.lng });
        } else {
          if (!drawing) {
            // start drawing polygon
            setDrawing(true);
            onPolygonChange([{ lat: latlng.lat, lng: latlng.lng }]);
          } else {
            onPolygonChange([...polygon, { lat: latlng.lat, lng: latlng.lng }]);
          }
        }
      },
    });
    return null;
  }

  return (
    <MapContainer
      center={center}
      zoom={7}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="CartoDB" />
      <MapClickHandler />
      {location && (
        <Marker position={[location.lat, location.lng]} />
      )}
      {polygon.length >= 2 && (
        <Polygon positions={polygon.map((p) => [p.lat, p.lng])} />
      )}
    </MapContainer>
  );
}
