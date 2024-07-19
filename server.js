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
  const { project, bedrooms, budget, schedule, email, fullname, phone, quality, conversation_status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO clients (project, bedrooms, budget, schedule, email, fullname, phone, quality, conversation_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [project, bedrooms, budget, schedule, email, fullname, phone, quality, conversation_status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err.stack);
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

app.get('/clients/finalized', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients WHERE conversation_status = 'Finalized Deal'");
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/clients/high-quality', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients WHERE quality = 'high'");
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/clients/pending', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients WHERE conversation_status = 'Pending'");
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

app.put('/clients/:id', async (req, res) => {
  const clientId = req.params.id;
  const { conversation_status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE clients SET conversation_status = $1 WHERE id = $2 RETURNING *',
      [conversation_status, clientId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Client not found');
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

app.delete('/clients/:id', async (req, res) => {
  const clientId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [clientId]);
    if (result.rows.length === 0) {
      return res.status(404).send('Client not found');
    }
    res.status(200).json(result.rows[0]);
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