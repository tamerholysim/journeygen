// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dbConnect from './lib/dbConnect.js';
import Journal from './models/Journal.js';

const app = express();
app.use(cors()); // Allow requests from the React app

// GET /api/journals/:id  →  returns the journal JSON
app.get('/api/journals/:id', async (req, res) => {
  try {
    await dbConnect();
    const journal = await Journal.findById(req.params.id).lean();
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.json(journal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📄  API server listening on http://localhost:${PORT}`);
});
