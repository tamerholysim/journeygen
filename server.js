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
import generateJournal from './lib/generateJournalService.js'; // our shared service
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());


// ——————————————
// POST /api/journals
// Create a new journal with { topic, background, bookingLink }
// ——————————————
app.post('/api/journals', async (req, res) => {
  const { topic, background, bookingLink } = req.body;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "topic".' });
  }
  if (background !== undefined && typeof background !== 'string') {
    return res.status(400).json({ error: '"background" must be a string if provided.' });
  }
  if (bookingLink !== undefined && typeof bookingLink !== 'string') {
    return res.status(400).json({ error: '"bookingLink" must be a string if provided.' });
  }

  try {
    // 1) Generate & save the journal (topic + background):
    //    generateJournal returns the saved Mongo document (without bookingLink yet)
    const savedJournal = await generateJournal({
      topic,
      backgroundText: background || '',
      bookingLink: '' // we’ll attach bookingLink in the next step
    });

    // 2) Now attach bookingLink (if provided) and update that same document:
    const updated = await Journal.findByIdAndUpdate(
      savedJournal._id,
      { bookingLink: bookingLink || '' },
      { new: true } // return the updated document
    ).lean();

    return res.status(201).json(updated);
  } catch (err) {
    console.error('Error in POST /api/journals:', err);
    return res.status(500).json({ error: 'Server error generating journal.' });
  }
});


// ——————————————
// GET /api/journals/:id
// Fetch existing journal by its MongoDB _id
// ——————————————
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


// ——————————————
// POST /api/journals/:id/report
// Generate a “report” from user responses, prepending Holy Sim background
// ——————————————
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
    // 1) Read lib/Background.txt if it exists
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

    // 3) Build the GPT prompt (prepend backgroundText if present)
    let promptText = '';
    if (backgroundText.trim()) {
      promptText += backgroundText.trim() + '\n\n';
    }
    promptText += `
You are a coach’s assistant using the Holy Sim framework above. 
Based on the following guided journal, generate a personalized report with suggestions, insights, and next steps for the user, all from within that framework.

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

    // 4) Call OpenAI to generate the report
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
