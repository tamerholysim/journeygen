// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dbConnect from './lib/dbConnect.js';
import Journal from './models/Journal.js';
import generateJournal from './lib/generateJournalService.js';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json()); // parse JSON bodies

// ——————————————————————————————————————————————
// POST /api/journals
// → Create a brand‐new journal from { topic, background } in request body
// ——————————————————————————————————————————————
app.post('/api/journals', async (req, res) => {
  const { topic, background } = req.body;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "topic".' });
  }
  if (background !== undefined && typeof background !== 'string') {
    return res.status(400).json({ error: '"background" must be a string if provided.' });
  }

  try {
    const newJournal = await generateJournal({
      topic: topic.trim(),
      backgroundText: background.trim()
    });

    return res.status(201).json(newJournal);
  } catch (err) {
    console.error('Error in POST /api/journals:', err);
    return res.status(500).json({ error: 'Server error generating journal.' });
  }
});

// ——————————————————————————————————————————————
// GET /api/journals/:id
// → Fetch an existing journal by _id
// ——————————————————————————————————————————————
app.get('/api/journals/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid journal ID format.' });
  }

  try {
    await dbConnect();
    const journal = await Journal.findById(id).lean();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found.' });
    }
    return res.json(journal);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ——————————————————————————————————————————————
// POST /api/journals/:id/report
// → Generate a “report” given user responses; includes Holy Sim background
// ——————————————————————————————————————————————
app.post('/api/journals/:id/report', async (req, res) => {
  const { id } = req.params;
  const { responses } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid journal ID format.' });
  }
  if (!Array.isArray(responses)) {
    return res.status(400).json({ error: 'Missing or invalid "responses" array.' });
  }

  try {
    // 1) Read Background.txt from disk (if it exists)
    let backgroundText = '';
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const bgPath = path.resolve(__dirname, 'lib/Background.txt');
      await fs.access(bgPath);
      backgroundText = await fs.readFile(bgPath, 'utf-8');
    } catch {
      backgroundText = '';
    }

    // 2) Fetch the journal by ID
    await dbConnect();
    const journal = await Journal.findById(id).lean();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found.' });
    }

    // 3) Build GPT prompt (prepend background if any)
    let promptText = '';
    if (backgroundText.trim()) {
      promptText += backgroundText.trim() + '\n\n';
    }
    promptText += `
You are a coach’s assistant using the framework in your background text. Based on the following guided journal, generate a personalized report with suggestions, insights, and next steps for the user, all from within that framework.

Journal Title: ${journal.title}
Journal Description: ${journal.description}

`;
    journal.tableOfContents.forEach((section, secIdx) => {
      promptText += `---\nSection (${section.entryType}): ${section.title}\n`;
      promptText += `Content: ${section.content}\n`;
      promptText += `Prompts:\n`;
      section.prompts.forEach((pObj, pIdx) => {
        promptText += `  Prompt ${pIdx + 1}: ${pObj.text}\n`;
      });
      promptText += `\nUser’s Answers:\n`;
      const sectionResponses = Array.isArray(responses[secIdx]) ? responses[secIdx] : [];
      section.prompts.forEach((pObj, pIdx) => {
        const answer = sectionResponses[pIdx] || '[No answer provided]';
        promptText += `  Answer ${pIdx + 1}: ${answer}\n`;
      });
      promptText += `\n`;
    });
    promptText += `---\nNow provide a cohesive report for the user: highlight strengths, offer constructive feedback, and suggest next steps based on their responses.\n\nReport:\n`;

    // 4) Call OpenAI for report
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-0613',
      messages: [
        { role: 'system', content: 'You are a helpful coach.' },
        { role: 'user', content: promptText }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const gptMessage = completion.choices[0].message.content;
    if (!gptMessage) {
      return res.status(500).json({ error: 'GPT did not return a report.' });
    }

    return res.json({ report: gptMessage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error generating report.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📄  API server listening on http://localhost:${PORT}`);
});
