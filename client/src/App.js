// client/src/App.js
import React from 'react';
import JournalUI from './JournalUI';

function App() {
  // We’ll read ?id=<journalId> from the URL query string.
  const params = new URLSearchParams(window.location.search);
  const journalId = params.get('id');

  if (!journalId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Please provide a journal ID in the URL, e.g. ?id=683c2d43d169356dcba97bed</h2>
      </div>
    );
  }

  return <JournalUI journalId={journalId} />;
}

export default App;
