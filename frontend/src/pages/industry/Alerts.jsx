import React from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { AlertsPanel } from '../../components/alerts/AlertsPanel';

export default function IndustryAlerts() {
  return (
    <>
      <PageHeader title="My Alerts" subtitle="Compliance and report notifications for your facility" />
      <PageContent><AlertsPanel limit={30} /></PageContent>
    </>
  );
}
