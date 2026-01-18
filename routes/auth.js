const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body } = require('express-validator');
const crypto = require('crypto');
const authController = require('../controllers/authController');

const {
  signup,
  login,
  googleAuthCallback,
  getCurrentUser
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth');

router.options('/forgot-password', (req, res) => {
  res.sendStatus(200);
});

router.options('/reset-password', (req, res) => {
  res.sendStatus(200);
});


// Email/Password signup
router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
  ],
  signup
);

// Email/Password login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  login
);


router.post('/forgot-password', authController.forgotPassword);

router.post('/reset-password', authController.resetPassword);
// Google OAuth routes
router.get('/google', (req, res, next) => {
  const state = crypto.randomBytes(16).toString('hex');

  req.session.oauthState = state;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false
  })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    session: false
  }),
  googleAuthCallback
);

// Get current user
router.get('/me', authenticate, getCurrentUser);

module.exports = router;
