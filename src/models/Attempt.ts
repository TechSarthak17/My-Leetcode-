import mongoose, { Schema } from 'mongoose';
const AttemptSchema = new Schema({
  userId: { type: String, required: true, index: true, default: 'local-user' },
  problemSlug: { type: String, required: true, index: true },
  code: { type: String, required: true },
  language: { type: String, default: 'java' },
  result: { type: String, enum: ['solved','attempted','failed'], default: 'attempted' },
  testMode: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.models.Attempt || mongoose.model('Attempt', AttemptSchema);
