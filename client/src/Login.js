// AFTER
import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const apiUrl = 'http://localhost:3001';   // ← hard-code your backend URL here for now

  // Pre‐computed Basic header for admin:pass
  const ADMIN_AUTH = 'Basic ' + btoa('admin:pass');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // 1) Admin login shortcut
    if (email.trim() === 'admin' && password === 'pass') {
      onLoginSuccess({ role: 'admin', authHeader: ADMIN_AUTH });
      return;
    }

    // 2) Otherwise, try client login
    if (!email.includes('@') || password !== 'pass') {
      setError('Invalid credentials.');
      return;
    }

    try {
      // We’ll fetch all clients and find by email (so we don’t need a special /by-email endpoint)
      const res = await fetch(`${apiUrl}/api/clients`, {
        headers: { Authorization: ADMIN_AUTH }
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const allClients = await res.json();
      const client = allClients.find((c) => c.email === email.trim());
      if (!client) throw new Error('No such client.');

      // Save client._id so ClientDashboard can read it
      localStorage.setItem('clientId', client._id);
      const authHeader = 'Basic ' + btoa(`${email.trim()}:${password}`);
      onLoginSuccess({ role: 'client', authHeader });
    } catch (err) {
      console.error(err);
      setError('Login failed. ' + err.message);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '1rem' }}>
      <h2>Log In</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        <label>
          Email (or "admin")<br />
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin or tamer@holysim.com"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Password<br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="pass"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: '0.75rem',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Log In
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
}
