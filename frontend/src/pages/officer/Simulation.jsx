import { PageHeader, PageContent } from '../../components/common/Layout';
import EcoSim from '../../components/simulation/EcoSim';

export default function SimulationPage() {
  return (
    <>
      <PageHeader
        title="🧪 EcoSim"
        subtitle="Officer environmental simulator — place interventions and see impact on AQI, WQI, noise and green cover. Region and factories are loaded from the database (Chhattisgarh)."
      />
      <PageContent>
        <EcoSim />
      </PageContent>
    </>
  );
}
