// lib/generateJournalService.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import mongoose from 'mongoose';

import dbConnect from './dbConnect.js';
import Journal from '../models/Journal.js';
import KnowledgeDoc from '../models/KnowledgeDoc.js';
import Client from '../models/Client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Maximum characters we’ll read from *each* KnowledgeDoc file (to avoid hitting token limits)
const MAX_PER_DOC_CHARS = 2000;

async function generateJournal({ topic, backgroundText = '', bookingLink = '', ownerId, clientId }) {
  // 0) Basic validation
  if (!topic || typeof topic !== 'string') {
    throw new Error('Must supply a non‐empty string for "topic".');
  }
  if (!ownerId || !clientId) {
    throw new Error('generateJournal requires both ownerId and clientId.');
  }

  // 1) Connect to MongoDB
  await dbConnect();

  // 2) Look up the Client’s record (to get name + background text)
  const client = await Client.findById(clientId).lean();
  if (!client) {
    throw new Error('Client not found in generateJournalService.');
  }
  const clientName = `${client.firstName} ${client.lastName}`;
  const clientBackground = client.background || '';

  // 3) Load all KnowledgeDoc entries from MongoDB
  const allDocs = await KnowledgeDoc.find().sort({ uploadedAt: -1 }).lean();

  let knowledgeBankText = '';
  for (const doc of allDocs) {
    try {
      // fileUrl is stored like "/uploads/1685751234567-MyFramework.txt"
      const rawPath  = doc.fileUrl.replace(/^\//, ''); // e.g. "uploads/1685751234567-MyFramework.txt"
      const diskPath = path.resolve(__dirname, '..', rawPath);

      // Read the file from disk
      let text = await fs.readFile(diskPath, 'utf-8');

      console.log(`→ Reading KnowledgeDoc from disk: ${diskPath} (length ${text.length} chars)`);

      // If the file is huge, truncate it
      if (text.length > MAX_PER_DOC_CHARS) {
        text = text.slice(0, MAX_PER_DOC_CHARS) + '\n\n[...truncated]';
      }

      knowledgeBankText += `\n\n=== ${doc.name} ===\n${text.trim()}`;
    } catch (err) {
      console.warn(`Could not read KnowledgeDoc [${doc._id}]: ${err.message}`);
      // skip this doc and continue
      continue;
    }
  }

  // 4) Decide on the “finalBackground” block to send to GPT:
  //    • If we found at least one KnowledgeDoc, use that.
  //    • Otherwise fall back to the passed‐in backgroundText (from Admin’s “background” field).
  let finalBackground = '';
  if (knowledgeBankText.trim()) {
    finalBackground = `Knowledge Bank Documents:${knowledgeBankText}`;
  } else if (backgroundText.trim()) {
    finalBackground = backgroundText.trim();
  }

  // 5) Build the “system” prompt, including:
  //    • Any background from Knowledge Bank (or admin’s fallback).
  //    • The Client’s name + background.
  let systemPrompt = '';
  if (finalBackground) {
    systemPrompt += finalBackground + '\n\n';
  }
  systemPrompt += `Client Name: ${clientName}\n`;
  if (clientBackground.trim()) {
    systemPrompt += `Client Background: ${clientBackground.trim()}\n\n`;
  }
  systemPrompt += `
You are a journal writer. Your task is to generate a complete guided journal for the topic below based on the user's backgrond and the framework's objective as indicated in your knowledge bank. 
The structure must include:

1. A clear **title** based on the topic.
2. A brief **description** explaining the journal's content.
3. A **Table of Contents**: an array of sections, each having:
   • entryType (either "Part", "Section", or "Closing")  
   • title (string)  
   • content (3–5 paragraphs of explanatory text)  
   • prompts: exactly 5 reflection prompts, each as {"text": "…"}  

After all Parts and Sections, append a final section called **Closing** with its own set of prompts.

Return exactly one valid JSON object with keys:
- "title" (string)
- "description" (string)
- "tableOfContents" (array of objects)

If you cannot generate the full structure, return a refusal JSON like:  
\`\`\`json
{"error": "Unable to generate complete journal."}
\`\`\`

Begin now.
`.trim();

  // 6) Call OpenAI to build the journal structure
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `Generate a complete guided journal on the topic: "${topic}".` }
    ],
    max_tokens: 7000,
    temperature: 0.7
  });

  const gptRaw = completion.choices[0].message?.content;
  if (!gptRaw) {
    throw new Error('GPT did not return any content.');
  }

  // 7) Parse GPT’s JSON output
  let parsed;
  try {
    parsed = JSON.parse(gptRaw);
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

  // 8) Ensure there is a “Closing” section
  const hasClosing = tableOfContents.some((e) => e.entryType === 'Closing');
  if (!hasClosing) {
    tableOfContents.push({
      entryType: 'Closing',
      title: 'Closing',
      content: 'Thank you for completing this journal. Please use the prompts below to finalize your reflection.',
      prompts: [
        { text: 'How do you feel after this journey?' },
        { text: 'What is your main takeaway?' },
        { text: 'How will you apply these insights going forward?' },
        { text: 'Do you have any final reflections?' },
        { text: 'Write a final commitment to yourself.' }
      ]
    });
  }

  // 9) Convert ownerId/clientId strings into ObjectId and save to Mongo‐with‐their‐tableOfContents.
  const doc = new Journal({
    topic,
    title,
    description,
    ownerId:        new mongoose.Types.ObjectId(ownerId),
    clientId:       new mongoose.Types.ObjectId(clientId),
    bookingLink:    bookingLink || '',
    tableOfContents: tableOfContents.map((entry) => ({
      entryType: entry.entryType,
      title:     entry.title,
      content:   entry.content || '',
      prompts:   (entry.prompts || []).map((p) => ({ text: p.text }))
    }))
  });

  const saved = await doc.save();
  return saved.toObject();
}

export default generateJournal;
