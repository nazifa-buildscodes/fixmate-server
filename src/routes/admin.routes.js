import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken, verifyAdmin);

router.get('/users', async (req, res) => {
  try {
    const { users } = getCollections();
    const list = await users
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ users: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load users' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['customer', 'technician', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const { users } = getCollections();
    const targetUser = await users.findOne({ _id: new ObjectId(id) });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (targetUser.email === req.user.email) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    await users.updateOne({ _id: targetUser._id }, { $set: { role } });
    res.json({ message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

router.get('/services', async (req, res) => {
  try {
    const { services } = getCollections();
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') query.approvalStatus = status;

    const list = await services.find(query).sort({ createdAt: -1 }).toArray();
    list.sort((a, b) => {
      if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
      if (a.approvalStatus !== 'pending' && b.approvalStatus === 'pending') return 1;
      return 0;
    });

    res.json({ services: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load services' });
  }
});

router.patch('/services/:id/approval', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    if (!['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ message: 'Invalid approval status' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid service ID' });
    }

    const { services } = getCollections();
    const result = await services.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approvalStatus } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json({ message: `Service ${approvalStatus} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update service approval' });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const { bookings } = getCollections();
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    const list = await bookings.find(query).sort({ createdAt: -1 }).toArray();
    res.json({ bookings: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load bookings' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const { payments } = getCollections();
    const list = await payments.find({}).sort({ paidAt: -1 }).toArray();
    const totalRevenue = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    res.json({ payments: list, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load transactions' });
  }
});

export default router;
