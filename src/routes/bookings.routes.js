import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
} from '../middleware/auth.js';

const router = express.Router();

const TECHNICIAN_TRANSITIONS = {
  requested: ['accepted', 'rejected'],
  accepted: ['in-progress'],
  'in-progress': ['completed'],
};

// CUSTOMER: Create repair request
router.post('/', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { serviceId, customerPhone, address, preferredDate, problemDescription } =
      req.body;

    if (!serviceId || !ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service selected' });
    }
    if (!customerPhone?.trim() || !address?.trim() || !preferredDate) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!problemDescription || problemDescription.trim().length < 20) {
      return res
        .status(400)
        .json({ message: 'Problem description must be at least 20 characters' });
    }

    const reqDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(reqDate.getTime()) || reqDate < today) {
      return res
        .status(400)
        .json({ message: 'Preferred date must be today or a future date' });
    }

    const { services, bookings } = getCollections();
    const service = await services.findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: 'approved',
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not available for booking' });
    }

    const duplicate = await bookings.findOne({
      serviceId,
      customerEmail: req.user.email,
      status: { $in: ['requested', 'accepted', 'in-progress'] },
    });

    if (duplicate) {
      return res
        .status(409)
        .json({ message: 'You already have an active request for this service' });
    }

    const now = new Date();
    const bookingDoc = {
      serviceId,
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      preferredDate: reqDate,
      problemDescription: problemDescription.trim(),
      status: 'requested',
      finalAmount: service.basePrice,
      paymentStatus: 'unpaid',
      statusHistory: [{ status: 'requested', changedAt: now }],
      createdAt: now,
    };

    const result = await bookings.insertOne(bookingDoc);
    res.status(201).json({
      message: 'Repair request submitted successfully',
      booking: { ...bookingDoc, _id: result.insertedId },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit repair request' });
  }
});

// CUSTOMER: Get own bookings
router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookings } = getCollections();
    const list = await bookings
      .find({ customerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ bookings: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load your bookings' });
  }
});

// CUSTOMER: Cancel booking while status === 'requested'
router.patch('/:id/cancel', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const { bookings } = getCollections();
    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: Not your booking' });
    }
    if (booking.status !== 'requested') {
      return res
        .status(400)
        .json({ message: 'Only requested bookings can be cancelled' });
    }

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: { status: 'cancelled' },
        $push: { statusHistory: { status: 'cancelled', changedAt: new Date() } },
      }
    );

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

// CUSTOMER: Submit rating & review after paid
router.patch('/:id/review', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const numRating = Number(rating);

    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    if (!(numRating >= 1 && numRating <= 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const { bookings } = getCollections();
    const booking = await bookings.findOne({ _id: new ObjectId(id) });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'You can only review paid jobs' });
    }

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: {
          rating: numRating,
          review: (review || '').trim(),
          reviewedAt: new Date(),
        },
      }
    );

    res.json({ message: 'Review submitted! Thank you.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

// TECHNICIAN: Get incoming requests
router.get('/technician', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { bookings } = getCollections();
    const { status } = req.query;
    const query = { technicianEmail: req.user.email };
    if (status && status !== 'all') query.status = status;

    const list = await bookings.find(query).sort({ createdAt: -1 }).toArray();
    res.json({ bookings: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load repair requests' });
  }
});

// TECHNICIAN: Strict forward-only status transition
router.patch('/:id/status', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    const { status: nextStatus, finalAmount } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const { bookings } = getCollections();
    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You do not own this job' });
    }

    const allowedNext = TECHNICIAN_TRANSITIONS[booking.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from '${booking.status}' to '${nextStatus}'`,
      });
    }

    const updateFields = { status: nextStatus };

    if (nextStatus === 'completed') {
      const amount = Number(finalAmount);
      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ message: 'A valid finalAmount greater than 0 is required' });
      }
      updateFields.finalAmount = amount;
    }

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: updateFields,
        $push: { statusHistory: { status: nextStatus, changedAt: new Date() } },
      }
    );

    res.json({ message: `Job status updated to ${nextStatus}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update job status' });
  }
});

export default router;
