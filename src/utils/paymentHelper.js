import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';

export async function recordCompletedPayment(session) {
  const { bookings, payments } = getCollections();
  const bookingId = session.metadata?.bookingId;

  if (!bookingId || !ObjectId.isValid(bookingId)) {
    throw new Error('Invalid bookingId in Stripe session metadata');
  }

  const existingPayment = await payments.findOne({ stripeSessionId: session.id });
  if (existingPayment) {
    return { alreadyRecorded: true, payment: existingPayment };
  }

  const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
  if (!booking) {
    throw new Error('Booking not found');
  }

  const paymentDoc = {
    bookingId: booking._id.toString(),
    serviceTitle: booking.serviceTitle,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    technicianName: booking.technicianName,
    technicianEmail: booking.technicianEmail,
    amount: booking.finalAmount,
    currency: session.currency || 'usd',
    transactionId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || session.id,
    stripeSessionId: session.id,
    paymentStatus: 'paid',
    paidAt: new Date(),
  };

  try {
    const insertResult = await payments.insertOne(paymentDoc);
    paymentDoc._id = insertResult.insertedId;
  } catch (err) {
    if (err.code === 11000) {
      const existing = await payments.findOne({ stripeSessionId: session.id });
      return { alreadyRecorded: true, payment: existing };
    }
    throw err;
  }

  await bookings.updateOne(
    { _id: booking._id },
    {
      $set: { paymentStatus: 'paid', paidAt: new Date() },
      $push: { statusHistory: { status: 'paid', changedAt: new Date() } },
    }
  );

  return { alreadyRecorded: false, payment: paymentDoc };
}
