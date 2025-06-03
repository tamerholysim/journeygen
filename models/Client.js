// models/Client.js

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const { Schema, model } = mongoose;

const clientSchema = new Schema({
  firstName:   { type: String, required: true },
  lastName:    { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  gender:      { type: String, enum: ['Male','Female','Other'], default: 'Other' },
  dateOfBirth: { type: Date },
  background:  { type: String, default: '' },

  // File uploads metadata (unchanged)
  fileUploads: [{
    filename: { type: String },
    path:     { type: String },
    mimetype: { type: String },
    size:     { type: Number }
  }],

  // ← NEW FIELDS:
  passwordHash: { type: String, default: '' },
  isActive:     { type: Boolean, default: false },
  inviteToken:  { type: String, default: '' },

  createdAt:   { type: Date, default: () => new Date() },
  updatedAt:   { type: Date, default: () => new Date() }
});

// Whenever the client sets a new password, we store a bcrypt hash:
clientSchema.methods.setPassword = async function (plainText) {
  const saltRounds = 10;
  this.passwordHash = await bcrypt.hash(plainText, saltRounds);
  this.isActive = true;
  this.inviteToken = '';
  return this.save();
};

// To check a plain password against the stored hash:
clientSchema.methods.checkPassword = async function (plainText) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainText, this.passwordHash);
};

// Before saving any change, bump updatedAt:
clientSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default model('Client', clientSchema);
