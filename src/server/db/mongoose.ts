import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  const primaryURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/watchparty';
  try {
    await mongoose.connect(primaryURI, { serverSelectionTimeoutMS: 5000 });
    console.log('[MongoDB] Connected successfully');
  } catch (error) {
    if (primaryURI.includes('127.0.0.1') || primaryURI.includes('localhost')) {
      console.error('[MongoDB] Connection error:', error);
      process.exit(1);
    }
    console.warn('[MongoDB] Remote connection failed, attempting local MongoDB fallback (127.0.0.1:27017)...');
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/watchparty', { serverSelectionTimeoutMS: 5000 });
      console.log('[MongoDB] Connected to local fallback MongoDB successfully');
    } catch (fallbackError) {
      console.error('[MongoDB] Both remote and local MongoDB connections failed:', error);
      process.exit(1);
    }
  }
};
