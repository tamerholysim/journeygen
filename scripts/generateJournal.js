// scripts/generateJournal.js
import 'dotenv/config';          // Loads .env into process.env
import OpenAI from 'openai';     // v5 import style
import dbConnect from '../lib/dbConnect.js';
import Journal from '../models/Journal.js';
import { generateJournalTool } from '../lib/openaiFunctions.js'; // Correct import for the updated tool

async function generateAndSaveJournal(topic) {
  if (!topic || typeof topic !== 'string') {
    console.error('❌  Please provide a non‐empty journal topic.');
    process.exit(1);
  }

  // 1) Connect to MongoDB
  await dbConnect();
  console.log('🗄️  Connected to MongoDB');

  // 2) Initialize OpenAI client (v5 style)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // 3) Build the messages array to enforce structured JSON output
  const messages = [
    {
      role: 'system',
      content: `
You are a journal writer. Your task is to generate a complete guided journal based on the user's topic. The journal must include:

1. **Title**: A clear title based on the topic.
2. **Description**: A brief description explaining the journal's content.
3. **Table of Contents**: An array of sections, where each section has:
   - entryType (either "Part", "Section", or "Closing")
   - title (string)
   - content (3–5 paragraphs of educational/explanatory text)
   - prompts: exactly 5 reflection prompts, each formatted as {"text": "prompt here"}

After all your parts and sections, append a final section called **Closing** that contains a final set of prompts for reflection and wrap-up.

Return a single valid JSON object with keys:
- "title" (string)
- "description" (string)
- "tableOfContents" (array of the section objects)

If you cannot generate the full structure, return a refusal JSON like {"error": "Unable to generate complete journal."}.
      `.trim()
    },
    {
      role: 'user',
      content: `Generate a complete guided journal on the topic: "${topic}".`
    }
  ];

  // 4) Call the chat endpoint with max_tokens: 4000
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-0613',                  
    messages,
    tools: [generateJournalTool],         
    max_tokens: 4000                     
  });

  // 5) Check if the response includes content and log for debugging
  const msg = completion.choices[0].message;
  console.log('OpenAI Response:', JSON.stringify(msg, null, 2));

  if (!msg.content) {
    console.error('❌  Model did not return any content. Response:', msg);
    process.exit(1);
  }

  // 6) Parse the returned JSON
  let parsedContent;
  try {
    parsedContent = JSON.parse(msg.content);
  } catch (err) {
    console.error('❌  Failed to JSON.parse the GPT output:', msg.content);
    process.exit(1);
  }

  // 7) Basic validation of the parsed structure
  const { title, description, tableOfContents } = parsedContent;
  if (
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !Array.isArray(tableOfContents)
  ) {
    console.error('❌  Unexpected response shape from GPT:', parsedContent);
    process.exit(1);
  }

  // 8) Post-processing: ensure there is a Closing section at the end
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

  // 9) Map into a Mongoose document and save
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

// 10) Read CLI arguments (everything after “node scripts/generateJournal.js”)
const args = process.argv.slice(2);
const topicArg = args.join(' ').trim();

// 11) Invoke the function
generateAndSaveJournal(topicArg)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
