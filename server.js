const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;
const cors = require('cors');
const { Pool } = require('pg');
const { validate } = require('./validator'); // Naya file import karo

// Middleware to handle JSON and URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Configure PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'udyam',
  password: 'YOUR_POSTGRES_PASSWORD', // Apna password yahan daalo
  port: 5432,
});

// API route for React frontend to get form fields
app.get('/api/form-fields', (req, res) => {
  try {
    const fields = JSON.parse(fs.readFileSync('formFields.json', 'utf-8'));
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: 'Could not load formFields.json' });
  }
});

// API route to handle form submission from React
app.post('/api/submit', async (req, res) => {
  try {
    const submittedData = req.body;
    
    // Naya validation function call karo
    const validationError = validate(submittedData);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { aadhaarNumber, panNumber } = submittedData;
    
    // Save data to PostgreSQL
    const queryText =
      'INSERT INTO registrations (aadhaar, pan, payload) VALUES ($1, $2, $3) RETURNING id';
    const values = [aadhaarNumber, panNumber, submittedData];
    const result = await pool.query(queryText, values);
    
    console.log('✅ Form data saved to database');
    res.status(200).json({ message: 'Form Submitted successfully!', id: result.rows[0].id });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Error submitting form.' });
  }
});

// Old HTML route
app.get('/', (req, res) => {
  res.send('<h1>Server is running! Please use the React frontend.</h1>');
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));