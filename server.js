const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// PostgreSQL Pool
const pool = new Pool({
  user: 'clientuser',
  host: 'localhost',
  database: 'clientdb',
  password: 'password',
  port: 5432,
});

// Test Database Connection
pool.connect((err) => {
  if (err) {
    console.error('Connection error', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

// Routes
app.post('/clients', async (req, res) => {
  const { project, bedrooms, budget, schedule, email, fullname, phone } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO clients (project, bedrooms, budget, schedule, email, fullname, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [project, bedrooms, budget, schedule, email, fullname, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
