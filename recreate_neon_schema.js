// recreate_neon_schema.js
import { Pool } from 'pg';
import 'dotenv/config';

const neonPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('⏳ Recreating donors table on Neon...');
    
    // DROP existing table (careful, but necessary to align schema)
    await neonPool.query('DROP TABLE IF EXISTS donors');
    
    // CREATE table according to db/schema.js
    await neonPool.query(`
      CREATE TABLE donors (
        id SERIAL PRIMARY KEY,
        donorid VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        dob VARCHAR(50),
        bloodgroup VARCHAR(10),
        type VARCHAR(50),
        organs TEXT,
        city VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(255),
        biometric TEXT,
        registeredon VARCHAR(100),
        timestamp BIGINT,
        donated_count BIGINT DEFAULT 0,
        donated_detail TEXT,
        received_count BIGINT DEFAULT 0,
        received_detail TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Donors table recreated with correct schema!');

    // Also recreate other tables if needed
    await neonPool.query('DROP TABLE IF EXISTS emergency_requests');
    await neonPool.query(`
      CREATE TABLE emergency_requests (
        id SERIAL PRIMARY KEY,
        donor_id VARCHAR(100) NOT NULL,
        requester_name VARCHAR(255) NOT NULL,
        request_type VARCHAR(50),
        blood_group VARCHAR(10),
        organ_type TEXT,
        details TEXT,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Emergency requests table recreated!');

  } catch (err) {
    console.error('❌ Schema recreation failed:', err);
  } finally {
    await neonPool.end();
  }
}

main();
