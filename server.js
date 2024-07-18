const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  user: 'clientuser',
  host: 'localhost',
  database: 'clientdb',
  password: 'password',
  port: 5432,
});

pool.connect((err) => {
  if (err) {
    console.error('Connection error', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

// Add a client
app.post('/clients', async (req, res) => {
  const { project, bedrooms, budget, schedule, email, fullname, phone, quality } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO clients (project, bedrooms, budget, schedule, email, fullname, phone, quality) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [project, bedrooms, budget, schedule, email, fullname, phone, quality]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

// Remove a client (assuming you have client ID)
app.delete('/clients/:id', async (req, res) => {
  const clientId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM clients WHERE id = $1', [clientId]);
    res.status(200).send(`Client with ID ${clientId} deleted successfully.`);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

// List all clients
app.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients');
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).send('Server error');
  }
});

// List high-quality clients
app.get('/clients/high-quality', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients WHERE quality = $1', ['high']);
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
