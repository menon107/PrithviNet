import React from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { SectionHeader } from '../../components/common/UI';
import WaterSimulationPane from '../../components/waterSimulation/WaterSimulationPane';
import { PollutionMap } from '../../components/maps/PollutionMap';
import { useAuth } from '../../context/AuthContext';

export default function OfficerMap() {
  const { user } = useAuth();
  const regionId = user?.region_id?._id || user?.region_id;

  return (
    <>
      <PageHeader title="Pollution Map" subtitle="Water quality simulation, Google AQI, and industries & monitoring stations" />
      <PageContent>
        <SectionHeader title="Water & air quality" subtitle="Load water bodies, run spill/clean, view WQI; switch to Air tab for Google AQI overlay" />
        <WaterSimulationPane
          height="480px"
          defaultCenter={regionId ? { lat: 21.13, lng: 81.5 } : undefined}
          regionId={regionId}
        />
        <div className="mt-6">
          <SectionHeader title="Industries & monitoring stations" subtitle="Stations and industry boundaries by compliance in your region" />
          <PollutionMap regionId={regionId} height="420px" />
        </div>
      </PageContent>
    </>
  );
}
