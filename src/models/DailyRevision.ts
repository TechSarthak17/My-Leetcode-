
import mongoose, { Schema } from "mongoose";

const DailyRevisionSchema = new Schema(
  {
    userId: { type: String, required: true, default: "local-user" },
    dateKey: { type: String, required: true },
    problemSlugs: { type: [String], default: [] },
    results: {
      type: [
        {
          slug: { type: String, required: true },
          status: {
            type: String,
            enum: ["solved", "hint", "failed"],
            required: true,
          },
          recordedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

DailyRevisionSchema.index(
  { userId: 1, dateKey: 1 },
  { unique: true }
);

export default mongoose.models.DailyRevision ||
  mongoose.model("DailyRevision", DailyRevisionSchema);
