require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authenticateJWT = require('./authMiddleware');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

// Apply CORS middleware before other middleware and routes
app.use(cors({
  origin: 'https://tangentinhouse.netlify.app', // Replace '*' with specific origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle pre-flight requests
app.options('*', cors());

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Database setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL_POOLED,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database', err.stack);
    } else {
        console.log('Connected to the database:', res.rows[0]);
    }
});

pool.on('connect', () => {
    console.log('Connected to the database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Routes
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Hardcoded user for testing purposes
    const testEmail = 'benjaminkakaimasai001@gmail.com';
    const testPassword = 'co37x74bobG';
    const hashedPassword = bcrypt.hashSync(testPassword, 10);
    const user = { email: testEmail, password: hashedPassword };

    if (email === user.email && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).send('Invalid credentials');
    }
});

app.get('/', (req, res) => {
    res.status(200).send('Welcome to the client management app');
});

app.post('/clients', authenticateJWT, async (req, res) => {
    const { project, bedrooms, budget, schedule, email, fullname, phone, quality, conversation_status, paymentDetails } = req.body;
    try {
        await pool.query('BEGIN');

        const clientResult = await pool.query(
            'INSERT INTO clients (project, bedrooms, budget, schedule, email, fullname, phone, quality, conversation_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [project, bedrooms, budget, schedule, email, fullname, phone, quality, conversation_status]
        );
        const newClient = clientResult.rows[0];

        if (paymentDetails) {
            await pool.query(
                'INSERT INTO payment_details (client_id, amount_paid, payment_duration, total_amount, balance, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
                [newClient.id, paymentDetails.amountPaid, paymentDetails.paymentDuration, paymentDetails.totalAmount, paymentDetails.balance, new Date()]
            );
        }

        await pool.query('COMMIT');
        res.status(201).json(newClient);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    }
});

app.post('/clients/:id/documents', authenticateJWT, upload.array('documents'), async (req, res) => {
    const clientId = req.params.id;
    const files = req.files;

    try {
        for (const file of files) {
            const documentPath = file.path;

            await pool.query(
                'INSERT INTO client_documents (client_id, document_name, document_path) VALUES ($1, $2, $3)',
                [clientId, file.originalname, documentPath]
            );
            console.log(`Document saved: ${documentPath}`);
        }

        res.status(200).send('Documents uploaded successfully');
    } catch (err) {
        console.error('Error uploading documents', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/clients/:id/documents', authenticateJWT, async (req, res) => {
    const clientId = req.params.id;
    try {
        const result = await pool.query(
            'SELECT * FROM client_documents WHERE client_id = $1',
            [clientId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching documents', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/documents/:id', authenticateJWT, async (req, res) => {
    const documentId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM client_documents WHERE id = $1', [documentId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Document not found');
        }
        const documentPath = result.rows[0].document_path;
        const documentName = result.rows[0].document_name;
        console.log(`Attempting to send file: ${documentPath}`);

        if (fs.existsSync(documentPath)) {
            const mimeType = mime.lookup(documentPath) || 'application/octet-stream';
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${path.basename(documentPath)}"`);
            fs.createReadStream(documentPath).pipe(res);
        } else {
            console.error(`File not found: ${documentPath}`);
            res.status(404).send('File not found');
        }
    } catch (err) {
        console.error('Error retrieving document', err.stack);
        res.status(500).send('Server error');
    }
});

app.delete('/documents/:id', authenticateJWT, async (req, res) => {
    const documentId = req.params.id;
    try {
        const result = await pool.query('DELETE FROM client_documents WHERE id = $1 RETURNING *', [documentId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Document not found');
        }

        fs.unlink(result.rows[0].document_path, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            }
        });

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error deleting document', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/clients', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, pd.amount_paid, pd.payment_duration, pd.total_amount, pd.balance, pd.payment_date
            FROM clients c
            LEFT JOIN payment_details pd ON c.id = pd.client_id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/clients/finalized', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM clients WHERE conversation_status = 'Finalized Deal'");
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/clients/high-quality', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM clients WHERE quality = 'high'");
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/clients/pending', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM clients WHERE conversation_status = 'Pending'");
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    }
});

app.get('/clients/:id', authenticateJWT, async (req, res) => {
    const clientId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Client not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching client', err.stack);
        res.status(500).send('Server error');
    }
});

app.delete('/clients/:id', authenticateJWT, async (req, res) => {
    const clientId = req.params.id;
    try {
        await pool.query('BEGIN');
        await pool.query('DELETE FROM client_documents WHERE client_id = $1', [clientId]);
        const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [clientId]);

        if (result.rows.length === 0) {
            return res.status(404).send('Client not found');
        }
        await pool.query('COMMIT');
        res.status(200).json(result.rows[0]);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error deleting client', err.stack);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
