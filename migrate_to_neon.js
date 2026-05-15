// migrate_to_neon.js
import { Pool } from 'pg';
import 'dotenv/config';

// 1. Local Database (Source)
const localPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'donor_registry',
});

// 2. Neon Database (Destination)
const neonPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL is missing in .env file!');
    console.log('Please add: DATABASE_URL=your_neon_connection_string_here');
    process.exit(1);
  }

  try {
    console.log('⏳ Connecting to databases...');
    
    // Fetch from local
    console.log('⏳ Fetching donors from local database...');
    const { rows: donors } = await localPool.query('SELECT * FROM donors');
    console.log(`✅ Found ${donors.length} donors locally.`);

    if (donors.length === 0) {
      console.log('ℹ️ No donors found to migrate.');
      return;
    }

    console.log('⏳ Uploading to Neon Tech...');
    let successCount = 0;
    
    for (const donor of donors) {
      try {
        await neonPool.query(
          `INSERT INTO donors (donorid, name, dob, bloodgroup, type, organs, city, phone, email, biometric, registeredon, timestamp, donated_count, donated_detail, received_count, received_detail)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (donorid) DO UPDATE SET
             name = EXCLUDED.name,
             dob = EXCLUDED.dob,
             bloodgroup = EXCLUDED.bloodgroup,
             type = EXCLUDED.type,
             organs = EXCLUDED.organs,
             city = EXCLUDED.city,
             phone = EXCLUDED.phone,
             email = EXCLUDED.email,
             biometric = EXCLUDED.biometric,
             registeredon = EXCLUDED.registeredon,
             timestamp = EXCLUDED.timestamp,
             donated_count = EXCLUDED.donated_count,
             donated_detail = EXCLUDED.donated_detail,
             received_count = EXCLUDED.received_count,
             received_detail = EXCLUDED.received_detail`,
          [
            donor.donorid, donor.name, donor.dob, donor.bloodgroup, donor.type, 
            donor.organs, donor.city, donor.phone, donor.email, donor.biometric, 
            donor.registeredon, donor.timestamp, donor.donated_count, 
            donor.donated_detail, donor.received_count, donor.received_detail
          ]
        );
        successCount++;
        if (successCount % 10 === 0) console.log(`  ... migrated ${successCount} donors`);
      } catch (err) {
        console.error(`  ❌ Failed to migrate donor ${donor.name}:`, err.message);
      }
    }

    console.log(`🎉 Success! Migrated ${successCount} donors to Neon Tech.`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await localPool.end();
    await neonPool.end();
  }
}

migrate();
