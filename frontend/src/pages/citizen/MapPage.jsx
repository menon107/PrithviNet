import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { PollutionMap } from '../../components/maps/PollutionMap';
import { regionsAPI } from '../../services/api';

export default function CitizenMap() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  useEffect(() => {
    regionsAPI.getAll().then(({ data }) => {
      setRegions(data.data);
      if (data.data.length) setSelectedRegion(data.data[0]._id);
    });
  }, []);
  return (
    <>
      <PageHeader title="Pollution Map" subtitle="Live air quality across monitoring stations and industries" />
      <PageContent>
        <div className="flex gap-2 mb-4 flex-wrap">
          {regions.map(r => (
            <button key={r._id} onClick={() => setSelectedRegion(r._id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: selectedRegion === r._id ? 'rgba(20,179,105,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedRegion === r._id ? 'rgba(20,179,105,0.4)' : 'var(--border)'}`, color: selectedRegion === r._id ? '#14b369' : 'var(--text-secondary)' }}>
              {r.name}
            </button>
          ))}
        </div>
        <PollutionMap regionId={selectedRegion} height="calc(100vh - 220px)" />
      </PageContent>
    </>
  );
}
