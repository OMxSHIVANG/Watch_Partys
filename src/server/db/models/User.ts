import mongoose, { Schema, Document } from 'mongoose';
import { User } from '../../../shared/authTypes';

export interface IUserDocument extends Omit<User, 'id'>, Document {
  passwordHash?: string;
  googleId?: string;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  avatar: { type: String },
  bio: { type: String, default: 'Hi! I love watching videos on YouTube Watch Party.' },
  provider: { type: String, enum: ['email', 'google'], required: true },
  passwordHash: { type: String },
  googleId: { type: String },
  createdAt: { type: Number, default: () => Date.now() },
});

// Transform _id to id when sending JSON
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = (ret as any)._id.toString();
    delete (ret as any)._id;
  }
});

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
