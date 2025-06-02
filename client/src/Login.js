// client/src/Login.js
import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const apiUrl = 'http://localhost:3001'; // Backend URL

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

    // 2) Client login via JWT
    if (!email.includes('@') || password === '') {
      setError('Invalid credentials.');
      return;
    }

    try {
      // 2.a) POST to /api/clients/login
      const loginRes = await fetch(`${apiUrl}/api/clients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}));
        throw new Error(body.error || `Status ${loginRes.status}`);
      }
      const { token } = await loginRes.json();

      // 2.b) Fetch the client’s own _id (to store in localStorage)
      //     We could add a /api/clients/me endpoint protected by JWT, but for now:
      const clientListRes = await fetch(`${apiUrl}/api/clients`, {
        headers: { Authorization: ADMIN_AUTH }
      });
      if (!clientListRes.ok) throw new Error('Cannot fetch client list.');
      const allClients = await clientListRes.json();
      const me = allClients.find((c) => c.email === email.trim());
      if (!me) throw new Error('Client not found.');

      // 2.c) Store JWT and clientId locally
      localStorage.setItem('clientToken', token);
      localStorage.setItem('clientId', me._id);

      // 2.d) Inform parent that we’re “logged in” as client
      onLoginSuccess({ role: 'client', authHeader: 'Bearer ' + token });
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
            placeholder="admin or client@example.com"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Password<br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="pass (for admin) or your new password"
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
