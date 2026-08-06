import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const conversationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, default: "Cuộc trò chuyện mới" },
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ConversationModel: Model<ConversationDocument> =
  mongoose.models.Conversation ??
  mongoose.model<ConversationDocument>("Conversation", conversationSchema);
