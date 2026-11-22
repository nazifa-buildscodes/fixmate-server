import express from 'express';
import { getCollections } from '../config/db.js';
import {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
  verifyAdmin,
} from '../middleware/auth.js';

const router = express.Router();

router.get('/customer-stats', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookings, payments } = getCollections();
    const email = req.user.email;

    const [myBookings, myPayments] = await Promise.all([
      bookings.find({ customerEmail: email }).toArray(),
      payments.find({ customerEmail: email }).toArray(),
    ]);

    const totalRequests = myBookings.length;
    const activeJobs = myBookings.filter((b) =>
      ['requested', 'accepted', 'in-progress'].includes(b.status)
    ).length;
    const completedJobs = myBookings.filter((b) => b.status === 'completed').length;
    const totalSpent = myPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const statusCounts = ['requested', 'accepted', 'in-progress', 'completed', 'cancelled', 'rejected'].map(
      (st) => ({
        status: st,
        count: myBookings.filter((b) => b.status === st).length,
      })
    );

    res.json({ totalRequests, activeJobs, completedJobs, totalSpent, statusCounts });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load customer stats' });
  }
});

router.get('/technician-stats', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { services, bookings, payments } = getCollections();
    const email = req.user.email;

    const [myServices, myJobs, myEarnings] = await Promise.all([
      services.find({ technicianEmail: email }).toArray(),
      bookings.find({ technicianEmail: email }).toArray(),
      payments.find({ technicianEmail: email }).toArray(),
    ]);

    const totalServices = myServices.length;
    const approvedServices = myServices.filter((s) => s.approvalStatus === 'approved').length;
    const pendingRequests = myJobs.filter((b) => b.status === 'requested').length;
    const totalEarned = myEarnings.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const jobBreakdown = ['requested', 'accepted', 'in-progress', 'completed', 'rejected'].map(
      (st) => ({
        status: st,
        count: myJobs.filter((b) => b.status === st).length,
      })
    );

    res.json({ totalServices, approvedServices, pendingRequests, totalEarned, jobBreakdown });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load technician stats' });
  }
});

router.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { users, services, bookings, payments } = getCollections();

    const [totalUsers, totalTechnicians, pendingServices, allBookings, allPayments] =
      await Promise.all([
        users.countDocuments(),
        users.countDocuments({ role: 'technician' }),
        services.countDocuments({ approvalStatus: 'pending' }),
        bookings.find({}).toArray(),
        payments.find({}).toArray(),
      ]);

    const totalRevenue = allPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const categoryMap = {};
    allBookings.forEach((b) => {
      categoryMap[b.category] = (categoryMap[b.category] || 0) + 1;
    });
    const bookingsByCategory = Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count,
    }));

    res.json({
      totalUsers,
      totalTechnicians,
      pendingServices,
      totalBookings: allBookings.length,
      totalRevenue,
      bookingsByCategory,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load admin stats' });
  }
});

export default router;
