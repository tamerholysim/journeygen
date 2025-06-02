// lib/generateJournalService.js

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import dbConnect from './dbConnect.js';
import Journal from '../models/Journal.js';

/**
 * Attempts to parse a JSON string, with a fallback that strips
 * trailing commas before closing braces/brackets.
 */
function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    // Remove any “,]” → “]” and “,}” → “}”
    const sanitized = raw
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    return JSON.parse(sanitized);
  }
}

async function generateJournal({ topic, backgroundText = '', bookingLink = '', ownerId, clientId }) {
  // 0) Validate required inputs
  if (!topic || typeof topic !== 'string') {
    throw new Error('Must supply a non-empty string for "topic".');
  }
  if (!ownerId || !clientId) {
    throw new Error('generateJournal requires both ownerId and clientId.');
  }

  // 1) Ensure DB connection
  await dbConnect();

  // 2) Initialize OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 3) Determine the “finalBackground” to use
  let finalBackground = '';
  if (backgroundText.trim()) {
    finalBackground = backgroundText.trim();
  } else {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const bgPath = path.resolve(__dirname, 'Background.txt');
      await fs.access(bgPath);
      finalBackground = (await fs.readFile(bgPath, 'utf-8')).trim();
    } catch {
      finalBackground = '';
    }
  }

  // 4) Build the system prompt (including any background)
  let systemPrompt = '';
  if (finalBackground) {
    systemPrompt += finalBackground + '\n\n';
  }
  systemPrompt += `
You are a journal writer. Your task is to generate a complete guided journal based on the user's topic. The journal must include:

1. **title** (string)
2. **description** (string)
3. **tableOfContents** (array of sections). Each section must have:
   - entryType  ("Part", "Section", or "Closing")
   - title      (string)
   - content    (3–5 paragraphs of explanatory text)
   - prompts    (exactly 5 reflection prompts, each of the form {"text": "…"})

After all "Part" and "Section" entries, append a final section whose entryType is "Closing", containing wrap-up prompts.

**IMPORTANT**: Respond with _only_ the final JSON object—no extra commentary or markdown fences. Your reply must start with “{” and end with “}” and be valid JSON.`;

  // 5) Call OpenAI to get the journal structure
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-0613',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate a complete guided journal on the topic: "${topic}".` }
    ],
    max_tokens: 4000
  });

  const raw = completion.choices[0].message?.content;
  if (!raw) {
    throw new Error('GPT did not return any content.');
  }

  // 6) Parse the JSON (with fallback sanitization)
  let parsed;
  try {
    parsed = safeJsonParse(raw);
  } catch (err) {
    console.error('Full GPT response:', raw);
    throw new Error(`Failed to JSON.parse GPT output: ${err.message}`);
  }

  // 7) Validate parsed shape
  const { title, description, tableOfContents } = parsed;
  if (
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !Array.isArray(tableOfContents)
  ) {
    throw new Error('Unexpected response shape from GPT.');
  }

  // 8) Ensure a “Closing” section exists
  const hasClosing = tableOfContents.some(e => e.entryType === 'Closing');
  if (!hasClosing) {
    tableOfContents.push({
      entryType: 'Closing',
      title:     'Closing',
      content:   'Thank you for completing this journal. Please use the prompts below to finalize your reflection.',
      prompts: [
        { text: 'How do you feel now that you have explored this topic?' },
        { text: 'What is your main takeaway from this journal?' },
        { text: 'How will you apply these insights going forward?' },
        { text: 'Is there anything else you wish to reflect on before closing?' },
        { text: 'Submit your final thoughts when you’re ready.' }
      ]
    });
  }

  // 9) Persist to MongoDB, including ownerId and clientId
  const newJournal = await Journal.create({
    topic,
    title,
    description,
    ownerId:        new mongoose.Types.ObjectId(ownerId),
    clientId:       new mongoose.Types.ObjectId(clientId),
    bookingLink:    bookingLink || '',
    tableOfContents: tableOfContents.map(entry => ({
      entryType: entry.entryType,
      title:     entry.title,
      content:   entry.content || '',
      prompts:   (entry.prompts || []).map(p => ({ text: p.text }))
    })),
    createdAt: new Date()
  });

  return newJournal.toObject();
}

export default generateJournal;
