import mongoose from 'mongoose';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalWithMongoose = globalThis as typeof globalThis & { mongooseCache?: Cache };
const cache: Cache = globalWithMongoose.mongooseCache ?? { conn: null, promise: null };
globalWithMongoose.mongooseCache = cache;

export function isDbConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

// The URI is read lazily so a missing value produces a handled API error
// instead of crashing the module at import time.
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI. Add it to .env.local.');
  if (cache.conn) return cache.conn;
  if (!cache.promise) cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null; // allow a retry on the next request
    throw error;
  }
  return cache.conn;
}
