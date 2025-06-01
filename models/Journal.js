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
  tableOfContents: [sectionSchema]
});

const Journal = mongoose.model('Journal', journalSchema);
export default Journal;
