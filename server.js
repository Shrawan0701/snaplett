const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const path = require('path');
require('dotenv').config();
const session = require('express-session');



const app = express();

app.set('trust proxy', 1);


// Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
  'https://snaplet.work',
  'https://www.snaplet.work',
  'https://snaplet-henna.vercel.app',
  'http://localhost:3000'
],

    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 👇 ADD THIS LINE (CRITICAL)
app.options('*', cors());



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'snaplet.sid',
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 10 * 60 * 1000 // 10 min
    }
  })
);


app.use(passport.initialize());






// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  limiter(req, res, next);
});

// Health check (keep-alive)
const healthCheck = (req, res) => {
  res.status(200).send('OK');
};

app.get('/api/health', healthCheck);



// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/search', require('./routes/search'));
app.use('/api/payment', require('./routes/payment'));





// Health check

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


module.exports = app;
