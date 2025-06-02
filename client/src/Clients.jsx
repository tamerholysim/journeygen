// client/src/Clients.jsx
import React, { useState, useEffect } from 'react';

export default function Clients({ apiUrl, onViewClient }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state for adding a new client:
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('Other');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [background, setBackground] = useState('');
  const [file, setFile] = useState(null);
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  // Precompute the Basic Auth header (admin:pass)
  const authHeader = 'Basic ' + btoa('admin:pass');

  // ─── Fetch all clients on mount ─────────────────────────────
  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/api/clients`, {
          headers: {
            Authorization: authHeader
          }
        });
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        const data = await res.json();
        setClients(data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch clients.');
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, [apiUrl, authHeader]);

  // ─── Handle new client submission ─────────────────────────────
  const handleAddClient = async (e) => {
    e.preventDefault();
    setAddError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setAddError('First name, last name, and email are required.');
      return;
    }

    setAdding(true);
    try {
      // Use FormData to include the file (if any)
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());
      formData.append('email', email.trim());
      formData.append('gender', gender);
      formData.append('dateOfBirth', dateOfBirth);
      formData.append('background', background.trim());
      if (file) {
        formData.append('file', file);
      }

      const res = await fetch(`${apiUrl}/api/clients`, {
        method: 'POST',
        headers: {
          Authorization: authHeader
          // DO NOT set Content-Type here; the browser sets the multipart boundary
        },
        body: formData
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status ${res.status}`);
      }
      const newClient = await res.json();
      // Prepend to the list of clients
      setClients((prev) => [newClient, ...prev]);
      // Clear form fields
      setFirstName('');
      setLastName('');
      setEmail('');
      setGender('Other');
      setDateOfBirth('');
      setBackground('');
      setFile(null);
      setAddError(null);
    } catch (err) {
      console.error(err);
      setAddError(`Failed to add client: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h2>Clients</h2>

      {loading && <p>Loading clients…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Name</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Email</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>DOB</th>
              <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c._id}>
                <td style={{ border: '1px solid #eee', padding: '0.5rem' }}>
                  {c.firstName} {c.lastName}
                </td>
                <td style={{ border: '1px solid #eee', padding: '0.5rem' }}>{c.email}</td>
                <td style={{ border: '1px solid #eee', padding: '0.5rem' }}>
                  {c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : '—'}
                </td>
                <td style={{ border: '1px solid #eee', padding: '0.5rem' }}>
                  <button onClick={() => onViewClient(c._id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <h3>Add a New Client</h3>
      <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          First Name:<br />
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Last Name:<br />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Email:<br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Gender:<br />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          Date of Birth:<br />
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Background / Notes:<br />
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>
        <label>
          Upload File (optional):<br />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </label>

        <button type="submit" disabled={adding} style={{ padding: '0.75rem' }}>
          {adding ? 'Adding…' : 'Add Client'}
        </button>
        {addError && <p style={{ color: 'red' }}>{addError}</p>}
      </form>
    </div>
  );
}
