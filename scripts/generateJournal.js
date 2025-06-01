// scripts/generateJournal.js
import 'dotenv/config';          // Loads .env into process.env
import fs from 'fs/promises';    // to read Background.txt
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';     // v5 import style

import dbConnect from '../lib/dbConnect.js';
import Journal from '../models/Journal.js';
import { generateJournalTool } from '../lib/openaiFunctions.js';

async function generateAndSaveJournal(topic) {
  if (!topic || typeof topic !== 'string') {
    console.error('❌  Please provide a non‐empty journal topic.');
    process.exit(1);
  }

  // 1) Read the “Background” file (Holy Sim Framework) from ../lib/Background.txt
  let backgroundText = '';
  try {
    // Resolve the directory of this script in ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    // Build absolute path to lib/Background.txt
    const bgPath = path.resolve(__dirname, '../lib/Background.txt');

    console.log('📂 Attempting to load Background.txt from:', bgPath);
    await fs.access(bgPath); // verify it exists
    console.log('✅  Background.txt was found!');

    // Read its full contents
    backgroundText = await fs.readFile(bgPath, 'utf-8');
    console.log(
      '✏️  Background.txt contents (first 200 chars):',
      backgroundText.slice(0, 200).replace(/\n/g, ' ') + '…'
    );
  } catch (err) {
    console.warn('⚠️  Could not read Background.txt; proceeding without it.');
    backgroundText = '';
  }

  // 2) Connect to MongoDB
  await dbConnect();
  console.log('🗄️  Connected to MongoDB');

  // 3) Initialize OpenAI client (v5 style)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // 4) Build our system prompt, *including* the backgroundText at the very top
  let systemPrompt = '';
  if (backgroundText.trim()) {
    systemPrompt += backgroundText.trim() + '\n\n';
  }
  systemPrompt += `
You are a journal writer operating within the framework provided above in your background text. Based on that framework and the user’s topic, generate a complete guided journal that includes:

1. **Title**: A clear title based on the topic.
2. **Description**: A brief description explaining the journal’s purpose.
3. **Table of Contents**: An array of sections (each must have):
   - entryType (one of "Part", "Section", or "Closing")
   - title (string)
   - content (3–5 paragraphs of educational/explanatory text)
   - prompts: exactly 5 reflection prompts, each formatted as { "text": "…" }

After all your parts and sections, append a final section called **Closing** that contains a final set of prompts for reflection and wrap‐up.

Return **one valid JSON object** with keys:
- **title** (string)
- **description** (string)
- **tableOfContents** (array of section objects)

Ensure each “content” field is multiple paragraphs (not just one sentence). If you cannot generate the full structure, return exactly:
\`\`\`
{"error": "Unable to generate complete journal."}
\`\`\`
`.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate a complete guided journal on the topic: "${topic}".` }
  ];

  // 5) Call the chat endpoint with max_tokens: 4000
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-0613',            // any model that supports function‐calling
    messages,
    tools: [generateJournalTool],
    max_tokens: 4000
  });

  // 6) Inspect the response for debugging
  const msg = completion.choices[0].message;
  console.log('📝 OpenAI Response message:', JSON.stringify(msg, null, 2));

  if (!msg.content) {
    console.error('❌  Model did not return any content. Response:', msg);
    process.exit(1);
  }

  // 7) Parse the returned JSON
  let parsedContent;
  try {
    parsedContent = JSON.parse(msg.content);
  } catch (err) {
    console.error('❌  Failed to JSON.parse the GPT output:', msg.content);
    process.exit(1);
  }

  // 8) Basic validation of the parsed structure
  const { title, description, tableOfContents } = parsedContent;
  if (
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !Array.isArray(tableOfContents)
  ) {
    console.error('❌  Unexpected response shape from GPT:', parsedContent);
    process.exit(1);
  }

  // 9) Ensure there’s a “Closing” section at the end
  const hasClosing = tableOfContents.some(entry => entry.entryType === 'Closing');
  if (!hasClosing) {
    tableOfContents.push({
      entryType: 'Closing',
      title: 'Closing',
      content: 'Thank you for completing this journal. Please use the prompts below to finalize your reflection.',
      prompts: [
        { text: 'How do you feel now that you have explored this topic?' },
        { text: 'What is your main takeaway from this journal?' },
        { text: 'How will you apply these insights going forward?' },
        { text: 'Is there anything else you wish to reflect on before closing?' },
        { text: 'Submit your final thoughts when you’re ready.' }
      ]
    });
  }

  // 10) Map into a Mongoose document and save
  const doc = new Journal({
    topic,
    title,
    description,
    tableOfContents: tableOfContents.map(entry => ({
      entryType: entry.entryType,
      title:     entry.title,
      content:   entry.content || '',
      prompts:   entry.prompts ? entry.prompts.map(p => ({ text: p.text })) : []
    }))
  });

  const saved = await doc.save();
  console.log('✅  Journal saved with _id:', saved._id.toString());
  console.log('Full document:', saved);
}

// 11) Read CLI arguments (everything after “node scripts/generateJournal.js”)
const args = process.argv.slice(2);
const topicArg = args.join(' ').trim();

// 12) Invoke the function
generateAndSaveJournal(topicArg)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
