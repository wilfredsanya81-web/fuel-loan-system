import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface LoanRow {
  loan_id: number;
  rider_id: number;
  rider_name: string | null;
  rider_phone: string | null;
  principal_amount: string;
  outstanding_balance: string;
  status: string;
  due_at: string | null;
  created_at: string;
}

export default function Loans() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await api<{ loans: LoanRow[] }>(`/dashboard/reports/loans${q}`);
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
  }, [statusFilter]);

  if (loading) return <div className="loading">Loading loans…</div>;

  return (
    <div>
      <h1>Loans</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Status filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>
      {error && <p className="error-msg">{error}</p>}
      {!error && loans.length === 0 && <div className="empty">No loans found</div>}
      {!error && loans.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Rider</th>
                <th>Principal</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Due at</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.loan_id}>
                  <td>{loan.loan_id}</td>
                  <td>{loan.rider_name ?? '—'} {loan.rider_phone ? `(${loan.rider_phone})` : ''}</td>
                  <td>{Number(loan.principal_amount).toLocaleString()} UGX</td>
                  <td>{Number(loan.outstanding_balance).toLocaleString()} UGX</td>
                  <td>
                    <span className={`status-badge status-${loan.status.toLowerCase()}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td>{loan.due_at ? new Date(loan.due_at).toLocaleString() : '—'}</td>
                  <td>
                    <Link to={`/loans/${loan.loan_id}`} className="btn btn-primary btn-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
