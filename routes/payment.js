const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createOrder, verifyPayment, getPaymentStatus } = require('../controllers/paymentController');
// Create payment order
router.post('/create-order', authenticate, createOrder);
// Verify payment
router.post('/verify', authenticate, verifyPayment);
// Get payment status
router.get('/status', authenticate, getPaymentStatus);
module.exports = router;