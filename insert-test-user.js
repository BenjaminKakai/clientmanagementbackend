
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function insertTestUser() {
    const client = await pool.connect();
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash('yourpassword', 10);

        // Insert the test user
        const result = await client.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
            ['user@example.com', hashedPassword]
        );

        console.log('Test user inserted:', result.rows[0]);
    } catch (err) {
        console.error('Error inserting test user:', err);
    } finally {
        client.release();
    }
}

insertTestUser().catch(console.error);
