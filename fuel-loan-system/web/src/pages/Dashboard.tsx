import { useState, useEffect } from 'react';
import { api } from '../api';
import './Dashboard.css';

interface Kpis {
  active_loans: number;
  overdue_loans: number;
  paid_loans: number;
  active_riders: number;
  total_disbursed: string;
  total_collected: string;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<Kpis>('/dashboard/kpis');
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        setKpis(null);
      } else if (res.data) {
        setKpis(res.data);
        setError(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="loading">Loading KPIs…</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!kpis) return <div className="empty">No data</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Active loans</span>
          <span className="kpi-value">{kpis.active_loans}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Overdue loans</span>
          <span className="kpi-value kpi-overdue">{kpis.overdue_loans}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Paid loans</span>
          <span className="kpi-value">{kpis.paid_loans}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active riders</span>
          <span className="kpi-value">{kpis.active_riders}</span>
        </div>
        <div className="kpi-card kpi-wide">
          <span className="kpi-label">Total disbursed (UGX)</span>
          <span className="kpi-value">{Number(kpis.total_disbursed).toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-wide">
          <span className="kpi-label">Total collected (UGX)</span>
          <span className="kpi-value">{Number(kpis.total_collected).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
