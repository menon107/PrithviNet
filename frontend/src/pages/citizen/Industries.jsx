import React, { useEffect, useState } from 'react';
import { PageHeader, PageContent } from '../../components/common/Layout';
import { ComplianceBadge, Empty, PageLoader } from '../../components/common/UI';
import { industriesAPI } from '../../services/api';
import { INDUSTRY_TYPE_LABELS, formatDate } from '../../utils/helpers';

export default function CitizenIndustries() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    industriesAPI.getAll({ limit: 50 }).then(({ data }) => { setIndustries(data.data); setLoading(false); });
  }, []);
  return (
    <>
      <PageHeader title="Industry Compliance" subtitle="Public record of monitored industries" />
      <PageContent>
        {loading ? <PageLoader /> : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Industry</th><th>Type</th><th>Score</th><th>Status</th><th>Violations</th><th>Last Report</th></tr></thead>
              <tbody>
                {industries.map(ind => (
                  <tr key={ind._id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ind.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{INDUSTRY_TYPE_LABELS[ind.industry_type]}</td>
                    <td><span className="font-mono font-bold" style={{ color: ind.compliance_score < 60 ? '#ef4444' : ind.compliance_score < 80 ? '#f79009' : '#14b369' }}>{ind.compliance_score}</span></td>
                    <td><ComplianceBadge status={ind.compliance_status} /></td>
                    <td className="font-mono" style={{ color: ind.total_violations > 10 ? '#ef4444' : 'var(--text-secondary)' }}>{ind.total_violations}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{formatDate(ind.last_report_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>
    </>
  );
}
