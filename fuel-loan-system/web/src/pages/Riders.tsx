import { useState, useEffect } from 'react';
import { api } from '../api';

interface Rider {
  rider_id: number;
  full_name: string | null;
  phone_number: string | null;
  national_id: string | null;
  motorcycle_number: string | null;
  stage_location: string | null;
  status: string;
  created_at: string;
}

export default function Riders() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<{ riders: Rider[] }>('/riders');
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        setRiders([]);
      } else if (res.data?.riders) {
        setRiders(res.data.riders);
        setError(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="loading">Loading riders…</div>;

  return (
    <div>
      <h1>Riders</h1>
      {error && <p className="error-msg">{error}</p>}
      {!error && riders.length === 0 && <div className="empty">No riders</div>}
      {!error && riders.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>National ID</th>
                <th>Motorcycle</th>
                <th>Stage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {riders.map((r) => (
                <tr key={r.rider_id}>
                  <td>{r.rider_id}</td>
                  <td>{r.full_name ?? '—'}</td>
                  <td>{r.phone_number ?? '—'}</td>
                  <td>{r.national_id ?? '—'}</td>
                  <td>{r.motorcycle_number ?? '—'}</td>
                  <td>{r.stage_location ?? '—'}</td>
                  <td><span className={`status-badge status-${r.status.toLowerCase()}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
