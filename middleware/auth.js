const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const checkUploadLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT is_paid, free_uploads_used FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    if (user.is_paid) {
      return next();
    }

    if (user.free_uploads_used >= 5) {
      return res.status(403).json({
        error: 'Free upload limit reached',
        requiresPayment: true,
        message: 'You have used all 5 free uploads. Please upgrade to continue.'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking upload limit:', error);
    return res.status(500).json({ error: 'Error checking upload limit' });
  }
};

module.exports = { authenticate, checkUploadLimit };
