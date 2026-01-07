const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../config/database');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const userCountry = req.user.country;

    // Determine pricing based on country
    let amount, currency;

    if (userCountry === 'IN') {
      amount = parseInt(process.env.INDIA_PRICE); // ₹99 → 9900 paise
      currency = process.env.INDIA_CURRENCY;
    } else {
      amount = parseInt(process.env.INTERNATIONAL_PRICE); // $15 → 1500 cents
      currency = process.env.INTERNATIONAL_CURRENCY;
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        user_id: userId
      }
    });

    // Save order to database
    await pool.query(
      `INSERT INTO payments 
       (user_id, razorpay_order_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, order.id, amount / 100, currency, 'pending']
    );

    res.json({
      orderId: order.id,
      amount,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    // Verify signature
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update payment status
    await pool.query(
      `UPDATE payments 
       SET razorpay_payment_id = $1,
           razorpay_signature = $2,
           status = $3
       WHERE razorpay_order_id = $4`,
      [razorpay_payment_id, razorpay_signature, 'completed', razorpay_order_id]
    );

    // 🔽 ADDITION STARTS HERE
    const expiryResult = await pool.query(
      'SELECT subscription_expires_at FROM users WHERE id = $1',
      [userId]
    );

    let expiryDate = new Date();

    if (expiryResult.rows[0]?.subscription_expires_at) {
      const currentExpiry = new Date(expiryResult.rows[0].subscription_expires_at);
      if (currentExpiry > new Date()) {
        expiryDate = currentExpiry;
      }
    }

    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await pool.query(
      'UPDATE users SET is_paid = true, subscription_expires_at = $1 WHERE id = $2',
      [expiryDate, userId]
    );
    // 🔼 ADDITION ENDS HERE

    res.json({
      message: 'Payment verified successfully',
      success: true
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ hasPaid: false });
    }

    const payment = result.rows[0];

    res.json({
      hasPaid: payment.status === 'completed',
      payment
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentStatus
};
