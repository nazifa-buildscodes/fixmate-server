import express from 'express';
import { ObjectId } from 'mongodb';
import { stripe } from '../config/stripe.js';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyCustomer } from '../middleware/auth.js';
import { recordCompletedPayment } from '../utils/paymentHelper.js';

const router = express.Router();

router.post(
  '/create-checkout-session',
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const { bookingId } = req.body;
      if (!bookingId || !ObjectId.isValid(bookingId)) {
        return res.status(400).json({ message: 'Invalid bookingId' });
      }

      const { bookings } = getCollections();
      const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });

      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.customerEmail !== req.user.email) {
        return res.status(403).json({ message: 'Forbidden: Not your booking' });
      }
      if (booking.status !== 'completed') {
        return res
          .status(400)
          .json({ message: 'Payment is only allowed after the job is completed' });
      }
      if (booking.paymentStatus === 'paid') {
        return res.status(400).json({ message: 'This booking is already paid' });
      }

      const amount = Number(booking.finalAmount);
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid final amount' });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: req.user.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: booking.serviceTitle,
                description: `Repair by ${booking.technicianName} (${booking.category})`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: booking._id.toString(),
          customerEmail: req.user.email,
        },
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Failed to create checkout session', error: error.message });
    }
  }
);

router.get('/verify', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ message: 'Missing session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Payment has not been completed' });
    }

    if (session.metadata?.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: Session mismatch' });
    }

    const { payment } = await recordCompletedPayment(session);
    res.json({ message: 'Payment verified successfully', payment });
  } catch (error) {
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
});

router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { payments } = getCollections();
    const list = await payments
      .find({ customerEmail: req.user.email })
      .sort({ paidAt: -1 })
      .toArray();
    res.json({ payments: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load payment history' });
  }
});

export default router;
