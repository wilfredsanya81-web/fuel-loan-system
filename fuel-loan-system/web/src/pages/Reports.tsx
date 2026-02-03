import { useState, useEffect } from 'react';
import { api } from '../api';

interface LoanRow {
  loan_id: number;
  rider_name: string | null;
  rider_phone: string | null;
  principal_amount: string;
  outstanding_balance: string;
  total_penalty: string;
  status: string;
  due_at: string | null;
  created_at: string;
}

export default function Reports() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<{ loans: LoanRow[] }>('/dashboard/reports/loans?limit=1000');
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        setLoans([]);
      } else if (res.data?.loans) {
        setLoans(res.data.loans);
        setError(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const exportCsv = () => {
    const headers = ['loan_id', 'rider_name', 'rider_phone', 'principal_amount', 'outstanding_balance', 'total_penalty', 'status', 'due_at', 'created_at'];
    const rows = loans.map((l) => [
      l.loan_id,
      l.rider_name ?? '',
      l.rider_phone ?? '',
      l.principal_amount,
      l.outstanding_balance,
      l.total_penalty,
      l.status,
      l.due_at ?? '',
      l.created_at ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `loans-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="loading">Loading report…</div>;

  return (
    <div>
      <h1>Reports</h1>
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0 }}>Loans report (export-ready)</p>
        <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={loans.length === 0}>
          Export CSV
        </button>
      </div>
      {error && <p className="error-msg">{error}</p>}
      {!error && loans.length === 0 && <div className="empty">No loans to report</div>}
      {!error && loans.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Rider</th>
                <th>Principal</th>
                <th>Outstanding</th>
                <th>Penalty</th>
                <th>Status</th>
                <th>Due at</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.loan_id}>
                  <td>{l.loan_id}</td>
                  <td>{l.rider_name ?? '—'} {l.rider_phone ? `(${l.rider_phone})` : ''}</td>
                  <td>{Number(l.principal_amount).toLocaleString()}</td>
                  <td>{Number(l.outstanding_balance).toLocaleString()}</td>
                  <td>{Number(l.total_penalty).toLocaleString()}</td>
                  <td><span className={`status-badge status-${l.status.toLowerCase()}`}>{l.status}</span></td>
                  <td>{l.due_at ? new Date(l.due_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
