import mongoose, { Schema } from 'mongoose';

// A revision session is an ordered list of question slugs. Results live in Attempt (by sessionId);
// progress is derived from them, so session state can never disagree with the history.
const RevisionSessionSchema = new Schema(
  {
    userId: { type: String, required: true },
    sessionId: { type: String, required: true, unique: true },
    type: { type: String, enum: ['daily', 'extra'], required: true },
    localDate: { type: String, required: true }, // YYYY-MM-DD, Asia/Kolkata
    questionSlugs: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    completedAt: { type: Date },
  },
  { timestamps: true },
);
RevisionSessionSchema.index({ userId: 1, localDate: 1, createdAt: -1 });
// Exactly one daily session per user per India-local day.
RevisionSessionSchema.index({ userId: 1, localDate: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'daily' } });

export default mongoose.models.RevisionSession || mongoose.model('RevisionSession', RevisionSessionSchema);
