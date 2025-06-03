// models/Journal.js

import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

// Sub‐schema for each prompt
const promptSchema = new Schema({
  text: { type: String, required: true }
}, { _id: false });

// Sub‐schema for each section/part/closing
const sectionSchema = new Schema({
  entryType: { type: String, enum: ['Part','Section','Closing'], required: true },
  title:     { type: String, required: true },
  content:   { type: String, default: '' },
  prompts:   { type: [promptSchema], required: true }
}, { _id: false });

const journalSchema = new Schema({
  topic:           { type: String, required: true },
  title:           { type: String, required: true },
  description:     { type: String, required: true },
  ownerId:         { type: Types.ObjectId, ref: 'User',   required: true },
  clientId:        { type: Types.ObjectId, ref: 'Client', required: true },
  bookingLink:     { type: String, default: '' },
  tableOfContents: { type: [sectionSchema], required: true },
  // ← New field: “responses”
  // An array (per section) of arrays (per prompt) of strings
  responses:       { type: [[String]], default: [] },

  createdAt:       { type: Date, default: () => new Date() },
  updatedAt:       { type: Date, default: () => new Date() }
});

// Whenever we update “responses,” bump updatedAt:
journalSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

export default model('Journal', journalSchema);
