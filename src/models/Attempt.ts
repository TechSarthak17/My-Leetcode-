import mongoose, { Schema } from 'mongoose';

// One document per attempt. Attempts are only ever inserted, never overwritten.
const AttemptSchema = new Schema({
  userId: { type: String, required: true, default: 'local-user' },
  problemSlug: { type: String, required: true },
  problemTitle: { type: String, default: '' },
  code: { type: String, default: '' },
  language: { type: String, default: 'python' },
  // solved / hint / failed come from revision sessions; 'attempted' is the Python editor's "Save attempt".
  result: { type: String, enum: ['solved', 'hint', 'failed', 'attempted'], default: 'attempted' },
  testMode: { type: Boolean, default: false },
  sessionId: { type: String },
  sessionType: { type: String, enum: ['daily', 'extra', 'practice'], default: 'practice' },
  localDate: { type: String }, // YYYY-MM-DD, Asia/Kolkata
  localTime: { type: String }, // Asia/Kolkata display time
  notes: { type: String, default: '', maxlength: 2000 },
  timeSpentSec: { type: Number, min: 0 },
  createdAt: { type: Date, default: Date.now },
});
AttemptSchema.index({ userId: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, problemSlug: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, result: 1, createdAt: -1 });
// A question can be answered only once per revision session. This is what makes double-clicks safe.
AttemptSchema.index({ sessionId: 1, problemSlug: 1 }, { unique: true, partialFilterExpression: { sessionId: { $type: 'string' } } });

export default mongoose.models.Attempt || mongoose.model('Attempt', AttemptSchema);
