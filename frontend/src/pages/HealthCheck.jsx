import { useEffect, useState } from 'react';
import { getHealth } from '../services/api';

export default function HealthCheck() {
  const [status, setStatus] = useState('Checking...');
  const [error, setError] = useState(null);

  useEffect(() => {
    getHealth()
      .then((res) => setStatus(res.data.message))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>MarketLink Apex</h1>
      <p>Backend status: {error ? `Error - ${error}` : status}</p>
    </div>
  );
}
