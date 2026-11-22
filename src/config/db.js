import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let dbInstance = null;

export async function connectDB() {
  if (dbInstance) return dbInstance;
  await client.connect();
  dbInstance = client.db(process.env.DB_NAME || 'fixmate');

  // Guarantee idempotency: same Stripe checkout session can never be saved twice
  await dbInstance
    .collection('payments')
    .createIndex({ stripeSessionId: 1 }, { unique: true });

  console.log('Connected to MongoDB:', dbInstance.databaseName);
  return dbInstance;
}

export function getCollections() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return {
    // BetterAuth MongoDB adapter uses the "user" collection by default
    users: dbInstance.collection('user'),
    services: dbInstance.collection('services'),
    bookings: dbInstance.collection('bookings'),
    payments: dbInstance.collection('payments'),
  };
}
