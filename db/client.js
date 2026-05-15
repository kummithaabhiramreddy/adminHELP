import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Enable connection caching in serverless environments
neonConfig.fetchConnectionCache = true;

const connectionString = process.env.DATABASE_URL;

// Fallback for local development
const localUrl = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const sql = neon(connectionString || localUrl);

// Create Drizzle instance using the HTTP driver (best for Vercel)
export const db = drizzle(sql, { schema });

// Export pool for local scripts (like setupdb.js)
export const pool = new Pool({
  connectionString: connectionString || localUrl,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

console.log('✅ Database client initialized (Neon HTTP)');
