// models/KnowledgeDoc.js
import mongoose from 'mongoose';

const knowledgeDocSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  fileUrl:    { type: String, required: true },
  uploadedAt: { type: Date, default: () => new Date() }
});

export default mongoose.model('KnowledgeDoc', knowledgeDocSchema);
