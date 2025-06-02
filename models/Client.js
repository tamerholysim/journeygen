// models/Client.js
import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  firstName:   { type: String, required: true },
  lastName:    { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  gender:      { type: String, enum: ['Male','Female','Other'], default: 'Other' },
  dateOfBirth: { type: Date },
  background:  { type: String, default: '' },
  fileUrl:     { type: String, default: '' },
  createdAt:   { type: Date, default: () => new Date() },
  updatedAt:   { type: Date, default: () => new Date() }
});

export default mongoose.model('Client', clientSchema);
