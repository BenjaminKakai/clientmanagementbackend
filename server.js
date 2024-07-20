const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

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

app.post('/clients/:id/documents', upload.array('documents'), async (req, res) => {
    const clientId = req.params.id;
    const files = req.files;

    try {
        for (const file of files) {
            const documentPath = file.path;

            // Insert document metadata into the database
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

app.get('/clients/:id/documents', async (req, res) => {
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

// Updated /documents/:id route
app.get('/documents/:id', async (req, res) => {
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

app.delete('/documents/:id', async (req, res) => {
    const documentId = req.params.id;
    try {
        const result = await pool.query('DELETE FROM client_documents WHERE id = $1 RETURNING *', [documentId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Document not found');
        }

        // Delete the file from the filesystem
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
    const { conversation_status, project, bedrooms, budget, schedule, email, fullname, phone, quality } = req.body;
    try {
        const result = await pool.query(
            'UPDATE clients SET conversation_status = $1, project = $2, bedrooms = $3, budget = $4, schedule = $5, email = $6, fullname = $7, phone = $8, quality = $9 WHERE id = $10 RETURNING *',
            [conversation_status, project, bedrooms, budget, schedule, email, fullname, phone, quality, clientId]
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
        // First, delete associated documents
        const documentResult = await pool.query('SELECT * FROM client_documents WHERE client_id = $1', [clientId]);
        for (const doc of documentResult.rows) {
            fs.unlink(doc.document_path, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                }
            });
        }
        await pool.query('DELETE FROM client_documents WHERE client_id = $1', [clientId]);

        // Then, delete the client
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
