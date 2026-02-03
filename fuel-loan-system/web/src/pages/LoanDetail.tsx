import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

interface Loan {
  loan_id: number;
  rider_id: number;
  principal_amount: string;
  service_charge: string;
  outstanding_balance: string;
  total_penalty: string;
  status: string;
  due_at: string | null;
  issued_at: string | null;
}

interface Rider {
  rider_id: number;
  full_name: string | null;
  phone_number: string | null;
  status: string;
}

interface Payment {
  payment_id: number;
  amount_paid: string;
  payment_method: string;
  payment_time: string;
}

interface LoanDetailData {
  loan: Loan;
  rider: Rider | null;
  payments: Payment[];
}

export default function LoanDetail() {
  const { loanId } = useParams<{ loanId: string }>();
  const [data, setData] = useState<LoanDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustOutstanding, setAdjustOutstanding] = useState('');
  const [adjustPenalty, setAdjustPenalty] = useState('');
  const [adjustStatus, setAdjustStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async () => {
    if (!loanId) return;
    const res = await api<LoanDetailData>(`/loans/${loanId}`);
    if (res.error) {
      setError(res.error);
      setData(null);
    } else if (res.data) {
      setData(res.data);
      setError(null);
      setAdjustOutstanding(res.data.loan.outstanding_balance);
      setAdjustPenalty(res.data.loan.total_penalty);
      setAdjustStatus(res.data.loan.status);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [loanId]);

  const handleAdminAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId) return;
    setSaveError(null);
    setSaving(true);
    const body: Record<string, string | number> = {};
    if (adjustOutstanding !== '' && !Number.isNaN(Number(adjustOutstanding))) body.outstanding_balance = Number(adjustOutstanding);
    if (adjustPenalty !== '' && !Number.isNaN(Number(adjustPenalty))) body.total_penalty = Number(adjustPenalty);
    if (adjustStatus && ['ACTIVE', 'OVERDUE', 'PAID'].includes(adjustStatus)) body.status = adjustStatus;
    const res = await api(`/loans/${loanId}/admin-adjust`, { method: 'PATCH', body });
    setSaving(false);
    if (res.error) setSaveError(res.error);
    else await load();
  };

  if (loading) return <div className="loading">Loading loan…</div>;
  if (error || !data) return <div className="error-msg">{error ?? 'Loan not found'}</div>;

  const { loan, rider, payments } = data;

  return (
    <div>
      <h1>Loan #{loan.loan_id}</h1>
      <div className="card">
        <h2>Loan details</h2>
        <table>
          <tbody>
            <tr><td>Status</td><td><span className={`status-badge status-${loan.status.toLowerCase()}`}>{loan.status}</span></td></tr>
            <tr><td>Principal</td><td>{Number(loan.principal_amount).toLocaleString()} UGX</td></tr>
            <tr><td>Service charge</td><td>{Number(loan.service_charge).toLocaleString()} UGX</td></tr>
            <tr><td>Outstanding</td><td>{Number(loan.outstanding_balance).toLocaleString()} UGX</td></tr>
            <tr><td>Total penalty</td><td>{Number(loan.total_penalty).toLocaleString()} UGX</td></tr>
            <tr><td>Due at</td><td>{loan.due_at ? new Date(loan.due_at).toLocaleString() : '—'}</td></tr>
            <tr><td>Issued at</td><td>{loan.issued_at ? new Date(loan.issued_at).toLocaleString() : '—'}</td></tr>
          </tbody>
        </table>
      </div>
      {rider && (
        <div className="card">
          <h2>Rider</h2>
          <p><strong>{rider.full_name ?? '—'}</strong> · {rider.phone_number ?? '—'} · {rider.status}</p>
        </div>
      )}
      <div className="card">
        <h2>Payments ({payments.length})</h2>
        {payments.length === 0 ? <p className="empty">No payments yet</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Amount</th><th>Method</th><th>Time</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td>{Number(p.amount_paid).toLocaleString()} UGX</td>
                    <td>{p.payment_method}</td>
                    <td>{new Date(p.payment_time).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <h2>Admin adjustment</h2>
        <form onSubmit={handleAdminAdjust}>
          <div className="form-group">
            <label>Outstanding balance</label>
            <input type="number" step="0.01" min="0" value={adjustOutstanding} onChange={(e) => setAdjustOutstanding(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Total penalty</label>
            <input type="number" step="0.01" min="0" value={adjustPenalty} onChange={(e) => setAdjustPenalty(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={adjustStatus} onChange={(e) => setAdjustStatus(e.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="PAID">PAID</option>
            </select>
          </div>
          {saveError && <p className="error-msg">{saveError}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  );
}
