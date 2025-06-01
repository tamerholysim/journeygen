// models/Journal.js
import mongoose from 'mongoose';

const promptSchema = new mongoose.Schema({
  text: { type: String, required: true }
});

const sectionSchema = new mongoose.Schema({
  entryType: {
    type: String,
    enum: ['Part', 'Section', 'Closing'],
    required: true
  },
  title:   { type: String, required: true },
  content: { type: String, default: '' },
  prompts: [promptSchema]
});

const journalSchema = new mongoose.Schema({
  topic:           { type: String, required: true },
  title:           { type: String, required: true },
  description:     { type: String, required: true },
  tableOfContents: [sectionSchema],
  bookingLink:     { type: String, default: '' }    // ← add this line
});

export default mongoose.model('Journal', journalSchema);
