// lib/generateJournalService.js

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';         // ← Make sure to import mongoose here
import OpenAI from 'openai';
import dbConnect from './dbConnect.js';
import Journal from '../models/Journal.js';

async function generateJournal({
  topic,
  backgroundText = '',
  bookingLink = '',
  ownerId,
  clientId
}) {
  // 0) Basic sanity checks
  if (!topic || typeof topic !== 'string') {
    throw new Error('Must supply a non‐empty string for "topic".');
  }
  if (!ownerId || !clientId) {
    throw new Error('generateJournal requires both ownerId and clientId.');
  }

  // 1) Connect to MongoDB
  await dbConnect();

  // 2) Initialize OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 3) Determine finalBackground (either passed in or read from disk)
  let finalBackground = '';
  if (backgroundText.trim()) {
    finalBackground = backgroundText.trim();
  } else {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname  = path.dirname(__filename);
      const bgPath     = path.resolve(__dirname, 'Background.txt');
      await fs.access(bgPath);
      finalBackground = (await fs.readFile(bgPath, 'utf-8')).trim();
    } catch {
      finalBackground = '';
    }
  }

  // 4) Build the system prompt
  let systemPrompt = '';
  if (finalBackground) {
    systemPrompt += finalBackground + '\n\n';
  }
  systemPrompt += `
You are a journal writer. Your task is to generate a complete guided journal based on the user's topic. The journal must include:

1. **Title**: A clear title based on the topic.
2. **Description**: A brief description explaining the journal's content.
3. **Table of Contents**: An array of sections, where each section has:
   - entryType (either "Part", "Section", or "Closing")
   - title (string)
   - content (3–5 paragraphs of educational/explanatory text)
   - prompts: exactly 5 reflection prompts, each formatted as {"text": "prompt here"}

After all parts and sections, append a final section called **Closing** that contains a final set of prompts for reflection and wrap-up.

Return a single valid JSON object with keys:
- "title" (string)
- "description" (string)
- "tableOfContents" (array of the section objects)

If you cannot generate the full structure, return a refusal JSON like {"error": "Unable to generate complete journal."}.
`.trim();

  // 5) Ask GPT to build the JSON structure
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-0613',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `Generate a complete guided journal on the topic: "${topic}".` }
    ],
    max_tokens: 4000
  });

  const msg = completion.choices[0].message?.content;
  if (!msg) {
    throw new Error('GPT did not return any content.');
  }

  // 6) Parse the JSON
  let parsed;
  try {
    parsed = JSON.parse(msg);
  } catch (err) {
    throw new Error(`Failed to JSON.parse GPT output: ${err.message}`);
  }

  const { title, description, tableOfContents } = parsed;
  if (
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !Array.isArray(tableOfContents)
  ) {
    throw new Error('Unexpected response shape from GPT.');
  }

  // 7) Ensure there is a “Closing” section
  const hasClosing = tableOfContents.some(entry => entry.entryType === 'Closing');
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

  // 8) Save to MongoDB, including ownerId and clientId
  const newDoc = await Journal.create({
    topic,
    title,
    description,
    ownerId:        mongoose.Types.ObjectId(ownerId),
    clientId:       mongoose.Types.ObjectId(clientId),
    bookingLink:    bookingLink || '',
    tableOfContents: tableOfContents.map(entry => ({
      entryType: entry.entryType,
      title:     entry.title,
      content:   entry.content || '',
      prompts:   (entry.prompts || []).map(p => ({ text: p.text }))
    })),
    createdAt: new Date()
  });

  return newDoc.toObject();
}

export default generateJournal;
