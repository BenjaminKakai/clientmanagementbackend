const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
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
  const { project, bedrooms, budget, schedule, email, fullname, phone, quality } = req.body;
  console.log('Received client data:', req.body); // Log received data
  try {
    const result = await pool.query(
      'INSERT INTO clients (project, bedrooms, budget, schedule, email, fullname, phone, quality) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [project, bedrooms, budget, schedule, email, fullname, phone, quality]
    );
    console.log('Client added to database:', result.rows[0]); // Log inserted client data
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err.stack); // Log any errors
    res.status(500).send('Server error');
  }
});

app.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients');
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
