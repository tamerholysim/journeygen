import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

import dbConnect from './lib/dbConnect.js';
import generateJournal from './lib/generateJournalService.js';
import OpenAI from 'openai'; // ← needed for the report endpoint

// Models
import User from './models/User.js';
import Client from './models/Client.js';
import KnowledgeDoc from './models/KnowledgeDoc.js';
import Journal from './models/Journal.js';

const app = express();
app.use(cors());
app.use(express.json()); // parse JSON bodies

//
// ─── BASIC “admin:pass” AUTH MIDDLEWARE ────────────────────────────────────────
//
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  let decoded;
  try {
    decoded = Buffer.from(auth.split(' ')[1], 'base64').toString(); // "admin:pass"
  } catch {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }
  const [username, password] = decoded.split(':');
  if (username === 'admin' && password === 'pass') {
    return next();
  }
  return res.status(403).json({ error: 'Invalid credentials' });
}

//
// ─── SEED ADMIN USER (run once at startup) ────────────────────────────────────
//
async function seedAdminUser() {
  await dbConnect();
  const existing = await User.findOne({ username: 'admin' });
  if (!existing) {
    await User.create({ username: 'admin', password: 'pass' });
    console.log('✅  Seeded admin user (username="admin", password="pass").');
  }
}
seedAdminUser().catch(console.error);

//
// ─── MULTER SETUP FOR FILE UPLOADS ─────────────────────────────────────────────
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, 'uploads');

// Ensure the uploads directory exists
;(async () => {
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
})();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Serve uploaded files (Knowledge / Client files) at /uploads
app.use('/uploads', express.static(uploadDir));

//
// ─── KNOWLEDGE BANK ENDPOINTS ─────────────────────────────────────────────────
//

/**
 * POST /api/knowledge
 * Upload a new background document.
 * • Requires Basic Auth = “admin:pass”
 * • multipart/form-data field “doc” + optional “name”
 */
app.post(
  '/api/knowledge',
  requireAdmin,
  upload.single('doc'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const docName = req.body.name || req.file.originalname;
    const fileUrl = `/uploads/${req.file.filename}`;

    try {
      await dbConnect();
      const saved = await KnowledgeDoc.create({
        name: docName,
        fileUrl,
        uploadedAt: new Date()
      });
      return res.status(201).json(saved);
    } catch (err) {
      console.error('Error in POST /api/knowledge:', err);
      return res.status(500).json({ error: 'Failed to save knowledge document.' });
    }
  }
);

/**
 * GET /api/knowledge
 * List all background documents.
 * • Requires Basic Auth = “admin:pass”
 */
app.get('/api/knowledge', requireAdmin, async (req, res) => {
  try {
    await dbConnect();
    const allDocs = await KnowledgeDoc.find().sort({ uploadedAt: -1 }).lean();
    return res.json(allDocs);
  } catch (err) {
    console.error('Error in GET /api/knowledge:', err);
    return res.status(500).json({ error: 'Server error listing knowledge.' });
  }
});

/**
 * DELETE /api/knowledge/:id
 * Delete a background document by ID.
 * • Requires Basic Auth = “admin:pass”
 */
app.delete('/api/knowledge/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }
  try {
    await dbConnect();
    const doc = await KnowledgeDoc.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    // Delete the file from disk if present
    const localFilePath = path.resolve(__dirname, doc.fileUrl.replace(/^\//, ''));
    try {
      await fs.unlink(localFilePath);
    } catch {
      /* ignore missing file */
    }
    await doc.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/knowledge/:id:', err);
    return res.status(500).json({ error: 'Delete failed.' });
  }
});

//
// ─── CLIENT CRUD ENDPOINTS ─────────────────────────────────────────────────────
//

/**
 * POST /api/clients
 * Create a new client.
 * • Requires Basic Auth = “admin:pass”
 * • multipart/form-data: fields “firstName, lastName, email, gender, dateOfBirth, background” + optional file under “file”
 */
app.post(
  '/api/clients',
  requireAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        gender,
        dateOfBirth,
        background
      } = req.body;
      if (!firstName || !lastName || !email) {
        return res
          .status(400)
          .json({ error: 'firstName, lastName, and email are required.' });
      }

      const newClientData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        gender: gender || 'Other',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        background: background || ''
      };

      if (req.file) {
        newClientData.fileUploads = [
          {
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
            mimetype: req.file.mimetype,
            size: req.file.size
          }
        ];
      }

      await dbConnect();
      const created = await Client.create(newClientData);
      return res.status(201).json(created);
    } catch (err) {
      console.error('Error in POST /api/clients:', err);
      return res.status(500).json({ error: 'Failed to create client.' });
    }
  }
);

/**
 * GET /api/clients
 * List all clients.
 * • Requires Basic Auth = “admin:pass”
 */
app.get('/api/clients', requireAdmin, async (req, res) => {
  try {
    await dbConnect();
    const all = await Client.find().sort({ lastName: 1, firstName: 1 }).lean();
    return res.json(all);
  } catch (err) {
    console.error('Error in GET /api/clients:', err);
    return res.status(500).json({ error: 'Server error listing clients.' });
  }
});

/**
 * GET /api/clients/:id
 * Fetch a single client by ID.
 * • Requires Basic Auth = “admin:pass”
 */
app.get('/api/clients/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }
  try {
    await dbConnect();
    const client = await Client.findById(id).lean();
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    return res.json(client);
  } catch (err) {
    console.error('Error in GET /api/clients/:id:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PUT /api/clients/:id
 * Update a client by ID.
 * • Requires Basic Auth = “admin:pass”
 * • JSON body may contain fields to update (file upload has separate route)
 */
app.put('/api/clients/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }
  try {
    await dbConnect();
    updates.updatedAt = new Date();
    const updated = await Client.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    return res.json(updated);
  } catch (err) {
    console.error('Error in PUT /api/clients/:id:', err);
    return res.status(500).json({ error: 'Update failed.' });
  }
});

/**
 * DELETE /api/clients/:id
 * Remove a client by ID.
 * • Requires Basic Auth = “admin:pass”
 */
app.delete('/api/clients/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }
  try {
    await dbConnect();
    await Client.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/clients/:id:', err);
    return res.status(500).json({ error: 'Delete failed.' });
  }
});

//
// ─── JOURNAL ENDPOINTS ─────────────────────────────────────────────────────────
//

/**
 * GET /api/journals
 * List all journals owned by the admin user.
 * • Requires Basic Auth = “admin:pass”
 */
app.get('/api/journals', requireAdmin, async (req, res) => {
  try {
    await dbConnect();
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      return res.status(500).json({ error: 'Admin user missing.' });
    }
    const allJ = await Journal.find({ ownerId: adminUser._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(allJ);
  } catch (err) {
    console.error('Error in GET /api/journals:', err);
    return res.status(500).json({ error: 'Server error listing journals.' });
  }
});

/**
 * POST /api/journals
 * Create a new journal.
 * • Requires Basic Auth = “admin:pass”
 * • JSON body: { topic, background, bookingLink, clientId }
 */
app.post('/api/journals', requireAdmin, async (req, res) => {
  const { topic, background, bookingLink, clientId } = req.body;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "topic".' });
  }
  if (background !== undefined && typeof background !== 'string') {
    return res.status(400).json({ error: '"background" must be a string if provided.' });
  }
  if (bookingLink !== undefined && typeof bookingLink !== 'string') {
    return res.status(400).json({ error: '"bookingLink" must be a string if provided.' });
  }
  if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
    return res.status(400).json({ error: 'Missing or invalid "clientId".' });
  }

  try {
    await dbConnect();
    // Verify client exists
    const client = await Client.findById(clientId).lean();
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // Get admin user’s _id
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      return res.status(500).json({ error: 'Admin user missing.' });
    }

    // Delegate to generateJournalService (saves a Journal without bookingLink)
    const savedJournal = await generateJournal({
      topic,
      backgroundText: background || '',
      bookingLink: '',
      ownerId: adminUser._id.toString(),
      clientId: client._id.toString()
    });

    // Update that saved journal to set bookingLink
    const updated = await Journal.findByIdAndUpdate(
      savedJournal._id,
      { bookingLink: bookingLink || '' },
      { new: true }
    ).lean();

    return res.status(201).json(updated);
  } catch (err) {
    console.error('Error in POST /api/journals:', err);
    return res.status(500).json({ error: 'Server error generating journal.' });
  }
});

/**
 * GET /api/journals/:id
 * Fetch one journal by ID.
 * - ADMIN (username="admin", password="pass") can fetch any journal.
 * - CLIENT (email:pass) can fetch only if journal.clientId === their client._id.
 */
app.get('/api/journals/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid journal ID.' });
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  let decoded;
  try {
    decoded = Buffer.from(auth.split(' ')[1], 'base64').toString(); // e.g. "admin:pass" or "user@…:pass"
  } catch {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }
  const [username, password] = decoded.split(':');

  try {
    await dbConnect();

    // 1) ADMIN case:
    if (username === 'admin' && password === 'pass') {
      const journal = await Journal.findById(id).lean();
      if (!journal) {
        return res.status(404).json({ error: 'Journal not found.' });
      }
      return res.json(journal);
    }

    // 2) CLIENT case:
    if (!username.includes('@') || password !== 'pass') {
      return res.status(403).json({ error: 'Invalid credentials' });
    }
    const client = await Client.findOne({ email: username.trim() }).lean();
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // 3) Only allow fetch if journal.clientId matches this client’s ID
    const journal = await Journal.findById(id).lean();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found.' });
    }
    if (journal.clientId.toString() !== client._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json(journal);
  } catch (err) {
    console.error('Error in GET /api/journals/:id:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/journals/client/:clientId
 * List all journals for a given client.
 * - ADMIN (admin:pass) can list any client’s journals.
 * - CLIENT (email:pass) can list only their own journals.
 */
app.get('/api/journals/client/:clientId', async (req, res) => {
  const { clientId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  let decoded;
  try {
    decoded = Buffer.from(auth.split(' ')[1], 'base64').toString(); // "admin:pass" or "user@…:pass"
  } catch {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }
  const [username, password] = decoded.split(':');

  try {
    await dbConnect();

    // 1) ADMIN: can list any client’s journals
    if (username === 'admin' && password === 'pass') {
      const userJournals = await Journal.find({ clientId }).sort({ createdAt: -1 }).lean();
      return res.json(userJournals);
    }

    // 2) CLIENT: can only list if auth’s email matches that clientId
    if (!username.includes('@') || password !== 'pass') {
      return res.status(403).json({ error: 'Invalid credentials' });
    }
    const client = await Client.findOne({ email: username.trim() }).lean();
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    if (client._id.toString() !== clientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userJournals = await Journal.find({ clientId }).sort({ createdAt: -1 }).lean();
    return res.json(userJournals);
  } catch (err) {
    console.error('Error in GET /api/journals/client/:clientId:', err);
    return res.status(500).json({ error: 'Server error listing client journals.' });
  }
});

/**
 * POST /api/journals/:id/report
 * Generate a “report” given user’s responses.
 * - ADMIN (admin:pass) may generate a report on any journal.
 * - CLIENT (email:pass) may generate only on their own journal.
 */
app.post('/api/journals/:id/report', async (req, res) => {
  const { id } = req.params;
  const { responses } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid journal ID format.' });
  }
  if (!Array.isArray(responses)) {
    return res.status(400).json({ error: 'Missing or invalid "responses" array.' });
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  let decoded;
  try {
    decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
  } catch {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }
  const [username, password] = decoded.split(':');

  try {
    await dbConnect();

    // 1) ADMIN: allowed on any journal
    if (username === 'admin' && password === 'pass') {
      // proceed to GPT
    } else {
      // 2) CLIENT: must match journal.clientId
      if (!username.includes('@') || password !== 'pass') {
        return res.status(403).json({ error: 'Invalid credentials' });
      }
      const client = await Client.findOne({ email: username.trim() }).lean();
      if (!client) {
        return res.status(404).json({ error: 'Client not found.' });
      }

      const journal = await Journal.findById(id).lean();
      if (!journal) {
        return res.status(404).json({ error: 'Journal not found.' });
      }
      if (journal.clientId.toString() !== client._id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // allowed — fall through to GPT portion
    }

    // ─── Build the GPT prompt with Knowledge Bank + Client info ──────────────

    // 1) Fetch the journal again (to ensure we have it)
    const journal = await Journal.findById(id).lean();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found.' });
    }

    // 2) Fetch the client record (to get name + background)
    const client = await Client.findById(journal.clientId).lean();
    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }
    const clientName = `${client.firstName} ${client.lastName}`;
    const clientBackground = client.background || '';

    // 3) Load all KnowledgeDoc entries from MongoDB
    const allDocs = await KnowledgeDoc.find().sort({ uploadedAt: -1 }).lean();
    let knowledgeBankText = '';
    const MAX_PER_DOC_CHARS = 2000;

    for (const doc of allDocs) {
      try {
        // fileUrl is stored like "/uploads/1234567890-someFile.txt"
        const rawPath = doc.fileUrl.replace(/^\//, '');
        const diskPath = path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          '..',
          rawPath
        );

        let text = await fs.readFile(diskPath, 'utf-8');
        console.log(`→ Reading KnowledgeDoc from disk: ${diskPath} (length ${text.length} chars)`);

        if (text.length > MAX_PER_DOC_CHARS) {
          text = text.slice(0, MAX_PER_DOC_CHARS) + '\n\n[...truncated]';
        }
        knowledgeBankText += `\n\n=== ${doc.name} ===\n${text.trim()}`;
      } catch (readErr) {
        console.warn(`Could not read KnowledgeDoc [${doc._id}]: ${readErr.message}`);
        continue;
      }
    }

    // 4) Fallback to static Background.txt if no KnowledgeDocs found
    let fallbackBackground = '';
    if (!knowledgeBankText.trim()) {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const bgPath = path.resolve(__dirname, 'lib/Background.txt');
        await fs.access(bgPath);
        fallbackBackground = (await fs.readFile(bgPath, 'utf-8')).trim();
      } catch {
        fallbackBackground = '';
      }
    }

    // 5) Build the “system” prompt
    let systemPrompt = '';
    if (knowledgeBankText.trim()) {
      systemPrompt += `Knowledge Bank Documents:${knowledgeBankText}\n\n`;
    } else if (fallbackBackground.trim()) {
      systemPrompt += fallbackBackground + '\n\n';
    }

    // 6) Inject the client’s information
    systemPrompt += `Client Name: ${clientName}\n`;
    if (clientBackground.trim()) {
      systemPrompt += `Client Background: ${clientBackground.trim()}\n\n`;
    }

    systemPrompt += `
You are a coach’s assistant using the Holy Sim framework. Based on the guided journal below (which was created specifically for ${clientName}), generate a personalized report with suggestions, insights, and next steps for the user. Include any relevant context from the knowledge bank and the client’s background in your response.
`.trim() + '\n\n';

    // 7) Append the journal’s sections and user answers
    let promptText = systemPrompt;
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

    promptText += `---\nNow provide a cohesive report for ${clientName}: highlight strengths, offer constructive feedback, and suggest next steps based on their background and their responses.\n\nReport:\n`;

    // 8) Call OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText }
      ],
      max_tokens: 7000,
      temperature: 0.7
    });

    const gptMessage = completion.choices[0].message.content;
    if (!gptMessage) {
      return res.status(500).json({ error: 'GPT did not return a report.' });
    }
    return res.json({ report: gptMessage });
  } catch (err) {
    console.error('Error in POST /api/journals/:id/report:', err);
    return res.status(500).json({ error: 'Server error generating report.' });
  }
});

//
// ─── START THE SERVER ─────────────────────────────────────────────────────────
//
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📄  API server listening on http://localhost:${PORT}`);
});
