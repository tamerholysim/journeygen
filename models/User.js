// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true } // for MVP, stored in plain text
});

export default mongoose.model('User', userSchema);
