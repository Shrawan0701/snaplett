const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { validationResult } = require('express-validator');
const { sendOTPEmail } = require('../services/emailService');
const crypto = require('crypto');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, country } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, country)
       VALUES ($1, $2, $3)
       RETURNING id, email, country, is_paid, free_uploads_used`,
      [email, passwordHash, country || 'IN']
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        country: user.country,
        is_paid: user.is_paid,
        free_uploads_used: user.free_uploads_used
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
      return res.status(400).json({ error: 'Please login with Google' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        country: user.country,
        is_paid: user.is_paid,
        free_uploads_used: user.free_uploads_used
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

const googleAuthCallback = async (req, res) => {
  try {
    const token = generateToken(req.user.id);

    // Redirect to frontend with token
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/google/callback?token=${token}`
    );
  } catch (error) {
    console.error('Google auth callback error:', error);
    res.redirect(
      `${process.env.FRONTEND_URL}/login?error=auth_failed`
    );
  }
};

const getCurrentUser = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        country: req.user.country,
        is_paid: req.user.is_paid,
        free_uploads_used: req.user.free_uploads_used,
        created_at: req.user.created_at,
        subscription_expires_at: req.user.subscription_expires_at

      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// SEND OTP
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const userRes = await pool.query(
    'SELECT id FROM users WHERE email=$1',
    [email]
  );

  if (userRes.rowCount === 0) {
    return res.json({ message: 'If email exists, OTP sent' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `UPDATE users
     SET reset_otp_hash=$1, reset_otp_expires=$2
     WHERE email=$3`,
    [otpHash, expires, email]
  );

  await sendOTPEmail(email, otp);
  res.json({ message: 'OTP sent' });
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  const userRes = await pool.query(
    `SELECT id FROM users
     WHERE email=$1
     AND reset_otp_hash=$2
     AND reset_otp_expires > NOW()`,
    [email, otpHash]
  );

  if (userRes.rowCount === 0) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await pool.query(
    `UPDATE users
     SET password_hash=$1,
         reset_otp_hash=NULL,
         reset_otp_expires=NULL
     WHERE email=$2`,
    [passwordHash, email]
  );

  res.json({ message: 'Password reset successful' });
};


module.exports = {
  signup,
  login,
  googleAuthCallback,
  getCurrentUser,
  forgotPassword,
  resetPassword
};
