import mongoose, { Schema } from 'mongoose';

const TrackedProblemSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    questionNumber: { type: Number },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Unknown'], default: 'Unknown' },
    topic: { type: String, default: 'Imported' },
    tags: { type: [String], default: [] },
    url: { type: String },
    // 'manual' | 'public-sync' | 'file-import' (older records may hold 'leetcode-public-api' or 'import')
    source: { type: String, default: 'import' },
    solvedAt: { type: Date },
    nextReviewAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true }, // createdAt is the "date added"
);
TrackedProblemSchema.index({ userId: 1, slug: 1 }, { unique: true });
TrackedProblemSchema.index(
  { userId: 1, questionNumber: 1 },
  { unique: true, partialFilterExpression: { questionNumber: { $type: 'number' } } },
);

export default mongoose.models.TrackedProblem || mongoose.model('TrackedProblem', TrackedProblemSchema);
