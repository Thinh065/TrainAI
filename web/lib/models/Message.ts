import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    sources: {
      type: [
        {
          _id: false,
          fileId: String,
          fileName: String,
          pageNumber: Number,
        },
      ],
      default: undefined,
    },
    report: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ "report.jobId": 1 }, { sparse: true });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

// Dev hot reload keeps the old compiled model, which silently drops new fields (report).
if (process.env.NODE_ENV !== "production" && mongoose.models.Message) {
  mongoose.deleteModel("Message");
}

export const MessageModel: Model<MessageDocument> =
  mongoose.models.Message ??
  mongoose.model<MessageDocument>("Message", messageSchema);
