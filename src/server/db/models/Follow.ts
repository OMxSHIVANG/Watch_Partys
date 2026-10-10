import mongoose, { Schema, Document } from 'mongoose';

export interface IFollowDocument extends Document {
  followerId: string;
  followingId: string;
  createdAt: number;
}

const FollowSchema = new Schema<IFollowDocument>({
  followerId: { type: String, required: true, index: true },
  followingId: { type: String, required: true, index: true },
  createdAt: { type: Number, default: () => Date.now() }
});

FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export const FollowModel = mongoose.model<IFollowDocument>('Follow', FollowSchema);
