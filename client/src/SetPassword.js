// client/src/SetPassword.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SetPassword() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // On mount, read ?token=… from the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setError('No token provided.');
    } else {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password === '' || confirmPwd === '') {
      return setError('Both fields are required.');
    }
    if (password !== confirmPwd) {
      return setError('Passwords do not match.');
    }

    try {
      const res = await fetch('http://localhost:3001/api/clients/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword: confirmPwd }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status ${res.status}`);
      }
      setSuccess(true);
      // Redirect to login after 2s
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <h3>Error: {error}</h3>
      </div>
    );
  }
  if (success) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Password set! You can now <a href="/login">log in</a>.</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '1rem', textAlign: 'center' }}>
      <h2>Create a Password</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          New Password:<br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Confirm Password:<br />
          <input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Set Password
        </button>
      </form>
    </div>
  );
}
