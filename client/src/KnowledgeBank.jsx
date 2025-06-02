// client/src/KnowledgeBank.jsx
import React, { useState, useEffect } from 'react';

export default function KnowledgeBank({ apiUrl }) {
  const [docs, setDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  // Precompute the Basic Auth header (admin:pass)
  const authHeader = 'Basic ' + btoa('admin:pass');

  useEffect(() => {
    fetch(`${apiUrl}/api/knowledge`, {
      headers: {
        Authorization: authHeader
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(setDocs)
      .catch(err => {
        console.error(err);
        setError('Failed to load documents.');
      });
  }, [apiUrl, authHeader]);

  const handleUpload = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please choose a file.');
      return;
    }
    const form = new FormData();
    form.append('doc', selectedFile);
    form.append('name', name || selectedFile.name);

    fetch(`${apiUrl}/api/knowledge`, {
      method: 'POST',
      headers: {
        Authorization: authHeader
      },
      body: form
    })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then((newDoc) => {
        setDocs(prev => [newDoc, ...prev]);
        setName('');
        setSelectedFile(null);
        setError(null);
      })
      .catch(err => setError(err.message));
  };

  const handleDelete = (id) => {
    fetch(`${apiUrl}/api/knowledge/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: authHeader
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Delete failed');
        setDocs(prev => prev.filter(d => d._id !== id));
      })
      .catch(err => {
        console.error(err);
        setError('Failed to delete document.');
      });
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Knowledge Bank</h2>
      <form onSubmit={handleUpload} style={{ marginBottom: '2rem' }}>
        <label>
          Document Name<br />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Optional (defaults to filename)"
            style={{ width: '100%', padding: '.5rem', marginBottom: '1rem' }}
          />
        </label>
        <label>
          Choose File<br />
          <input
            type="file"
            onChange={e => setSelectedFile(e.target.files[0])}
            style={{ marginBottom: '1rem' }}
          />
        </label><br/>
        <button
          type="submit"
          style={{
            padding: '.75rem 1.5rem',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: 4
          }}
        >
          Upload Document
        </button>
        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      </form>

      <h3>Uploaded Documents</h3>
      <ul>
        {docs.map(doc => (
          <li key={doc._id} style={{ marginBottom: '1rem' }}>
            <a href={`${apiUrl}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer">
              {doc.name}
            </a>
            &nbsp;
            <button
              onClick={() => handleDelete(doc._id)}
              style={{ color: 'red', marginLeft: '1rem' }}
            >
              Delete
            </button>
          </li>
        ))}
        {docs.length === 0 && <p>No documents yet.</p>}
      </ul>
    </div>
  );
}
