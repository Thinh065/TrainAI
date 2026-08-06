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
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const MessageModel: Model<MessageDocument> =
  mongoose.models.Message ??
  mongoose.model<MessageDocument>("Message", messageSchema);
