import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { errorMessage } from '../services/api';
import AuthShell from '../components/AuthShell';
import PasswordInput from '../components/PasswordInput';

const EMPTY = { name: '', stallName: '', email: '', phone: '', address: '', password: '', confirm: '' };

export default function Register() {
  const { user, registerCustomer, registerFarmer } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'farmer' ? 'farmer' : 'customer';
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (k) => (event) => setForm({ ...form, [k]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');

    setBusy(true);
    try {
      const { name, stallName, email, phone, address, password } = form;
      const u =
        role === 'farmer'
          ? await registerFarmer({ stallName, contactPerson: name, email, phone, address, password })
          : await registerCustomer({ name, email, phone, address, password });
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" sub={role === 'farmer' ? 'List your harvest and take pre-orders for market-day pickup.' : 'Save favourites, get restock alerts and reserve fresh produce.'}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={role === 'customer'} className={role === 'customer' ? 'active' : ''} onClick={() => setParams({})}>
          I am a customer
        </button>
        <button type="button" role="tab" aria-selected={role === 'farmer'} className={role === 'farmer' ? 'active' : ''} onClick={() => setParams({ role: 'farmer' })}>
          I am a farmer
        </button>
      </div>

      <form onSubmit={submit}>
        {role === 'farmer' && (
          <label>
            Stall / business name
            <input required value={form.stallName} onChange={set('stallName')} />
          </label>
        )}
        <label>
          {role === 'farmer' ? 'Contact person' : 'Full name'}
          <input required autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label>
          E-mail
          <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
        <label>
          Contact number
          <input type="tel" required autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </label>
        <label>
          Address
          <textarea required rows={2} autoComplete="street-address" value={form.address} onChange={set('address')} />
        </label>
        <label>
          Password
          <PasswordInput required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </label>
        <label>
          Confirm password
          <PasswordInput required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </label>

        {role === 'farmer' && <p className="alert alert-info">New farmer accounts must be approved by an admin before you can list products.</p>}
        {error && <p className="alert alert-error">{error}</p>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p className="muted center">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </AuthShell>
  );
}
