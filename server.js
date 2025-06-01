// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import path from 'path';
import dbConnect from './lib/dbConnect.js';
import Journal from './models/Journal.js';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json()); // necessary to parse JSON bodies

// GET /api/journals/:id → fetch a journal by its Mongo _id
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

// POST /api/journals/:id/report → generate a “report” from user responses
app.post('/api/journals/:id/report', async (req, res) => {
  const { id } = req.params;
  const { responses } = req.body;

  // 1) Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid journal ID format.' });
  }
  // 2) Validate that “responses” is an array
  if (!Array.isArray(responses)) {
    return res.status(400).json({ error: 'Missing or invalid "responses" array.' });
  }

  try {
    // 3) Read Background.txt from project root → lib/Background.txt
    let backgroundText = '';
    try {
      // Convert import.meta.url into a real filesystem path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Build the absolute path to lib/Background.txt
      const bgPath = path.resolve(__dirname, 'lib/Background.txt');
      console.log('📂 Attempting to load Background.txt from:', bgPath);

      // Check if it exists
      await fs.access(bgPath);
      console.log('✅  Background.txt was found!');

      // Read its contents
      backgroundText = await fs.readFile(bgPath, 'utf-8');
      console.log(
        '✏️  Background.txt contents (first 200 chars):',
        backgroundText.slice(0, 200).replace(/\n/g, ' ') + '…'
      );
    } catch (err) {
      console.warn('⚠️  Could not read Background.txt; proceeding without it.');
      backgroundText = '';
    }

    // 4) Fetch journal from Mongo
    await dbConnect();
    const journal = await Journal.findById(id).lean();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found.' });
    }

    // 5) Build a GPT prompt, prepending backgroundText if present
    let promptText = '';
    if (backgroundText.trim()) {
      promptText += backgroundText.trim() + '\n\n';
    }
    promptText += `You are a coach's assistant based on the framework in your background text. Based on the following guided journal, generate a personalized report with suggestions, insights, and next steps for the user, all from within the framework in your background text.\n\n`;
    promptText += `Journal Title: ${journal.title}\n`;
    promptText += `Journal Description: ${journal.description}\n\n`;

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

    // 6) Log the combined prompt so you can verify the background is included
    console.log('\n===== COMBINED PROMPT SENT TO GPT =====');
    console.log(promptText);
    console.log('======================================\n');

    // 7) Call OpenAI
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

    // 8) Return the report text
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
