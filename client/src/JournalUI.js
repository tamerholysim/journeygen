// client/src/JournalUI.js

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

export default function JournalUI({ journalId, apiUrl }) {
  const [journal, setJournal] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // 1) Fetch journal on mount
  useEffect(() => {
    setJournal(null);
    setLoadError(null);

    const token = localStorage.getItem('clientToken');
    fetch(`${apiUrl}/api/journals/${journalId}`, {
      headers: {
        Authorization: 'Bearer ' + token
      }
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error('Forbidden: invalid credentials.');
          }
          throw new Error(`Network response was not OK (status ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setJournal(data);
        // Initialize one empty string per prompt
        const initial = data.tableOfContents.map((section) =>
          section.prompts.map(() => '')
        );
        setResponses(initial);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(err.message);
      });
  }, [journalId, apiUrl]);

  const handlePromptChange = (secIdx, promptIdx, text) => {
    setResponses((prev) => {
      const copy = prev.map((arr) => [...arr]);
      copy[secIdx][promptIdx] = text;
      return copy;
    });
  };

  // 2) Submit responses → generate a report
  const handleSubmit = () => {
    if (!journal) return;
    setLoadingReport(true);
    setReportError(null);

    const token = localStorage.getItem('clientToken');
    fetch(`${apiUrl}/api/journals/${journalId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ responses })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || `Status ${res.status}`);
          });
        }
        return res.json();
      })
      .then((data) => {
        setReport(data.report);
        // Jump to the “Report” tab
        setCurrentIndex(1 + journal.tableOfContents.length);
      })
      .catch((err) => {
        console.error(err);
        setReportError(err.message);
      })
      .finally(() => {
        setLoadingReport(false);
      });
  };

  // 3) Render loading / error states first
  if (loadError) {
    return (
      <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>
        <h3>Error: {loadError}</h3>
      </div>
    );
  }
  if (!journal) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Loading journal…</h3>
      </div>
    );
  }

  // 4) Journal & report loaded; now build the “Overview / Sections / Report” UI
  const numSections = journal.tableOfContents.length;
  const isOverview = currentIndex === 0;
  const isReport = report && currentIndex === numSections + 1;
  const sectionIndex = !isOverview && !isReport ? currentIndex - 1 : null;

  // Utility: ensure bookingLink has “https://” if not present
  const normalizeLink = (raw) => {
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return 'https://' + raw;
  };

  // Utility: generate a PDF of the entire journal + answers + report
  const handleSavePDF = () => {
    const doc = new jsPDF();
    const leftMargin = 20;
    let yPos = 20;
    const lineHeight = 10;
    const pageHeight = doc.internal.pageSize.height;

    // 1) Title
    doc.setFontSize(16);
    doc.text(journal.title, leftMargin, yPos);
    yPos += lineHeight + 2;

    // 2) Description
    doc.setFontSize(12);
    const descLines = doc.splitTextToSize(journal.description, 170);
    descLines.forEach((line) => {
      if (yPos + lineHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, leftMargin, yPos);
      yPos += lineHeight;
    });
    yPos += lineHeight;

    // 3) Each section: print title, content, prompts & user answers
    journal.tableOfContents.forEach((section, secIdx) => {
      if (yPos + lineHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.text(`${section.entryType}: ${section.title}`, leftMargin, yPos);
      yPos += lineHeight;

      doc.setFontSize(12);
      section.prompts.forEach((pObj, pIdx) => {
        // Prompt text
        const promptLines = doc.splitTextToSize(`• ${pObj.text}`, 165);
        promptLines.forEach((line) => {
          if (yPos + lineHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, leftMargin + 5, yPos);
          yPos += lineHeight;
        });

        // User’s answer
        const userAnswer = (responses[secIdx] && responses[secIdx][pIdx]) || '';
        const answerLabel = `   → ${userAnswer || '[no response]'}`;
        const answerLines = doc.splitTextToSize(answerLabel, 165);
        answerLines.forEach((line) => {
          if (yPos + lineHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, leftMargin + 10, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      });

      yPos += lineHeight;
    });

    // 4) Final “Report” section
    if (yPos + lineHeight > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.text('Final Report:', leftMargin, yPos);
    yPos += lineHeight;

    doc.setFontSize(12);
    const reportLines = doc.splitTextToSize(report || '', 170);
    reportLines.forEach((line) => {
      if (yPos + lineHeight > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, leftMargin, yPos);
      yPos += lineHeight;
    });

    // 5) Save
    doc.save(`${journal.title}.pdf`);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* ─── Sidebar ──────────────────────────────────────────── */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid #ddd',
          padding: '1rem',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ marginTop: 0 }}>Contents</h3>

        {/* Overview link */}
        <div
          onClick={() => setCurrentIndex(0)}
          style={{
            padding: '0.5rem',
            marginBottom: '0.25rem',
            cursor: 'pointer',
            backgroundColor: currentIndex === 0 ? '#f0f8ff' : 'transparent',
            borderRadius: '4px'
          }}
        >
          Overview
        </div>

        {/* List all sections */}
        {journal.tableOfContents.map((sec, idx) => (
          <div
            key={idx}
            onClick={() => setCurrentIndex(idx + 1)}
            style={{
              padding: '0.5rem',
              marginBottom: '0.25rem',
              cursor: 'pointer',
              backgroundColor:
                currentIndex === idx + 1 ? '#f0f8ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            {sec.title}
          </div>
        ))}

        {/* If report exists, show “Report” link */}
        {report && (
          <div
            onClick={() => setCurrentIndex(numSections + 1)}
            style={{
              padding: '0.5rem',
              marginTop: '1rem',
              borderTop: '1px solid #ccc',
              cursor: 'pointer',
              backgroundColor:
                currentIndex === numSections + 1 ? '#f0f8ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            Report
          </div>
        )}
      </div>

      {/* ─── Main Pane ─────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto'
        }}
      >
        {/* Overview pane */}
        {isOverview && (
          <>
            <h1>{journal.title}</h1>
            <p style={{ lineHeight: 1.6, marginBottom: '2rem' }}>
              {journal.description}
            </p>
            <button
              onClick={() => setCurrentIndex(1)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Start Journal
            </button>
          </>
        )}

        {/* Section pane (for each section) */}
        {!isOverview && !isReport && sectionIndex !== null && (
          <>
            <h2>{journal.tableOfContents[sectionIndex].title}</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {journal.tableOfContents[sectionIndex].content
                .split('\n')
                .map((para, i) => (
                  <p key={i} style={{ lineHeight: 1.6 }}>
                    {para.trim()}
                  </p>
                ))}
            </div>

            {journal.tableOfContents[sectionIndex].prompts.map(
              (pObj, pIdx) => (
                <div key={pIdx} style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      fontWeight: '500',
                      display: 'block',
                      marginBottom: '0.5rem'
                    }}
                  >
                    {pObj.text}
                  </label>
                  <textarea
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '1rem'
                    }}
                    value={responses[sectionIndex][pIdx] || ''}
                    onChange={(e) =>
                      handlePromptChange(sectionIndex, pIdx, e.target.value)
                    }
                  />
                </div>
              )
            )}

            <div style={{ marginTop: '2rem' }}>
              {sectionIndex < numSections - 1 ? (
                <button
                  onClick={() => setCurrentIndex((ci) => ci + 1)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loadingReport}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: loadingReport ? '#999' : '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loadingReport ? 'default' : 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {loadingReport ? 'Generating Report…' : 'Submit'}
                </button>
              )}
            </div>

            {reportError && (
              <p style={{ color: 'red', marginTop: '1rem' }}>
                Error generating report: {reportError}
              </p>
            )}
          </>
        )}

        {/* Report pane */}
        {isReport && (
          <>
            <h1>Report</h1>
            <div
              style={{
                marginTop: '1rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}
            >
              {report}
            </div>

            {/* “Get Consultation” button */}
            {journal.bookingLink && (
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <a
                  href={normalizeLink(journal.bookingLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#007BFF',
                    color: '#fff',
                    padding: '0.75rem 1.5rem',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    marginBottom: '1rem'
                  }}
                >
                  Get Consultation
                </a>
              </div>
            )}

            {/* “Save PDF” button */}
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                onClick={handleSavePDF}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Save PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
