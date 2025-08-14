// server.js
const express = require('express');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const { Pool } = require('pg');
const { validate } = require('./validator');

// Enhanced CORS configuration
const allowedOrigins = [
  'https://udyam-project-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite default
  process.env.FRONTEND_URL
].filter(Boolean); // Remove any undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ],
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser support
  preflightContinue: false,
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Manual CORS headers as fallback (in case cors middleware fails)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`Preflight request from: ${origin}`);
    res.status(200).end();
    return;
  }
  
  next();
});

// Middleware to handle JSON and URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' })); // Added limit for large payloads

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
  next();
});

// Configure PostgreSQL connection using environment variables
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: allowedOrigins
  });
});

// API route for React frontend to get form fields
app.get('/api/form-fields', (req, res) => {
  try {
    console.log('📋 Fetching form fields...');
    
    // Check if file exists
    if (!fs.existsSync('formFields.json')) {
      console.error('❌ formFields.json not found');
      return res.status(404).json({ error: 'Form fields configuration not found' });
    }
    
    const fields = JSON.parse(fs.readFileSync('formFields.json', 'utf-8'));
    console.log('✅ Form fields loaded successfully');
    
    res.json({
      success: true,
      data: fields,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error loading form fields:', error);
    res.status(500).json({ 
      success: false,
      error: 'Could not load form fields configuration',
      message: error.message 
    });
  }
});

// API route to handle form submission from React
app.post('/api/submit', async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('📝 Processing form submission...');
    const submittedData = req.body;
    
    // Validate the submitted data
    const validationError = validate(submittedData);
    if (validationError) {
      console.warn('⚠️ Validation failed:', validationError);
      return res.status(400).json({ 
        success: false,
        error: validationError,
        timestamp: new Date().toISOString()
      });
    }

    const { aadhaarNumber, panNumber } = submittedData;
    
    // Check if record already exists
    const checkQuery = 'SELECT id FROM registrations WHERE aadhaar = $1 OR pan = $2';
    const existingRecord = await client.query(checkQuery, [aadhaarNumber, panNumber]);
    
    if (existingRecord.rows.length > 0) {
      console.warn('⚠️ Duplicate registration attempt');
      return res.status(409).json({
        success: false,
        error: 'Registration already exists with this Aadhaar or PAN number',
        timestamp: new Date().toISOString()
      });
    }
    
    // Insert new registration
    await client.query('BEGIN');
    
    const queryText = `
      INSERT INTO registrations (aadhaar, pan, payload, created_at, updated_at) 
      VALUES ($1, $2, $3, NOW(), NOW()) 
      RETURNING id, created_at
    `;
    const values = [aadhaarNumber, panNumber, submittedData];
    const result = await client.query(queryText, values);
    
    await client.query('COMMIT');
    
    console.log('✅ Form data saved to database with ID:', result.rows[0].id);
    
    res.status(201).json({ 
      success: true,
      message: 'Form submitted successfully!', 
      data: {
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error submitting form:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Error submitting form. Please try again.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Get all registrations (for admin purposes)
app.get('/api/registrations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const countQuery = 'SELECT COUNT(*) FROM registrations';
    const dataQuery = `
      SELECT id, aadhaar, pan, created_at, updated_at 
      FROM registrations 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery),
      pool.query(dataQuery, [limit, offset])
    ]);
    
    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);
    
    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching registrations',
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Udyam Project API Server',
    version: '1.0.0',
    endpoints: [
      'GET /health - Health check',
      'GET /api/form-fields - Get form configuration',
      'POST /api/submit - Submit form data',
      'GET /api/registrations - Get all registrations (paginated)'
    ],
    cors: allowedOrigins,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
});

module.exports = server;