import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { connectDB } from './config/db.js';
import { stripe } from './config/stripe.js';
import { recordCompletedPayment } from './utils/paymentHelper.js';

import servicesRoutes from './routes/services.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import usersRoutes from './routes/users.routes.js';
import adminRoutes from './routes/admin.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Stripe Webhook MUST be before express.json()
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      try {
        const session = event.data.object;
        if (session.payment_status === 'paid') {
          await recordCompletedPayment(session);
        }
      } catch (err) {
        console.error('Webhook payment recording error:', err.message);
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json());

async function getCollections() {
  const db = await connectDB();
  return {
    messages: db.collection('messages'),
    users: db.collection('users'),
    services: db.collection('services'),
    bookings: db.collection('bookings'),
  };
}

async function resolveRequestUser(req) {
  const { users } = await getCollections();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token) {
    try {
      const secret =
        process.env.JWT_SECRET ||
        process.env.ACCESS_TOKEN_SECRET ||
        process.env.BETTER_AUTH_SECRET ||
        'fixmate_secret_key';
      const decoded = jwt.verify(token, secret);
      const email = (decoded.email || '').toLowerCase();
      const dbUser = email ? await users.findOne({ email }) : null;

      return {
        email,
        name: dbUser?.name || decoded.name || 'User',
        role: (dbUser?.role || decoded.role || 'customer').toLowerCase(),
        phone: dbUser?.phone || '',
      };
    } catch {
      return null;
    }
  }

  return null;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'FixMate API Server' });
});

app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ১. মেসেজ সেভ করা (About / Footer থেকে Admin-এ অথবা Service Details থেকে Technician-এ)
app.post('/api/messages', async (req, res) => {
  try {
    const {
      senderName,
      senderEmail,
      senderPhone = '',
      senderRole = 'guest',
      recipientRole = 'admin',
      recipientEmail = '',
      serviceId = '',
      serviceTitle = '',
      topic = 'General Inquiry',
      message,
    } = req.body;

    if (!senderName?.trim() || !senderEmail?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Name, email, and message are required.' });
    }

    const { messages } = await getCollections();
    const doc = {
      senderName: senderName.trim(),
      senderEmail: senderEmail.trim().toLowerCase(),
      senderPhone: senderPhone.trim(),
      senderRole: (senderRole || 'guest').toLowerCase(),
      recipientRole: recipientRole === 'technician' ? 'technician' : 'admin',
      recipientEmail: recipientEmail.trim().toLowerCase(),
      serviceId: serviceId ? String(serviceId) : '',
      serviceTitle: serviceTitle ? String(serviceTitle) : '',
      topic: topic?.trim() || 'General Inquiry',
      message: message.trim(),
      reply: '',
      repliedBy: '',
      repliedAt: null,
      createdAt: new Date(),
    };

    const result = await messages.insertOne(doc);
    res.status(201).json({
      message: 'Message sent successfully',
      id: result.insertedId,
      data: doc,
    });
  } catch (err) {
    console.error('POST /api/messages error:', err);
    res.status(500).json({ message: err.message || 'Failed to send message' });
  }
});

// ২. লগইন করা ইউজারের রোল অনুযায়ী মেসেজ দেখা
app.get('/api/messages/my', async (req, res) => {
  try {
    const currentUser = await resolveRequestUser(req);
    if (!currentUser?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messages } = await getCollections();
    const userEmail = currentUser.email.toLowerCase();
    const role = currentUser.role;

    let query = {};
    if (role === 'admin') {
      query = { recipientRole: 'admin' };
    } else if (role === 'technician') {
      query = {
        $or: [
          { recipientRole: 'technician', recipientEmail: userEmail },
          { senderEmail: userEmail },
        ],
      };
    } else {
      query = { senderEmail: userEmail };
    }

    const list = await messages.find(query).sort({ createdAt: -1 }).toArray();
    res.json({ messages: list });
  } catch (err) {
    console.error('GET /api/messages/my error:', err);
    res.status(500).json({ message: err.message || 'Failed to load messages' });
  }
});

// ৩. মেসেজের রিপ্লাই দেওয়া (Admin, Technician, অথবা মেসেজের প্রেরক Customer)
app.patch('/api/messages/:id/reply', async (req, res) => {
  try {
    const currentUser = await resolveRequestUser(req);
    if (!currentUser?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { reply } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }
    if (!reply?.trim()) {
      return res.status(400).json({ message: 'Reply cannot be empty' });
    }

    const { messages } = await getCollections();
    const target = await messages.findOne({ _id: new ObjectId(id) });
    if (!target) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const userEmail = currentUser.email.toLowerCase();
    const isAllowed =
      (currentUser.role === 'admin' && target.recipientRole === 'admin') ||
      (currentUser.role === 'technician' &&
        target.recipientRole === 'technician' &&
        (target.recipientEmail || '').toLowerCase() === userEmail) ||
      (target.senderEmail || '').toLowerCase() === userEmail;

    if (!isAllowed) {
      return res.status(403).json({ message: 'Not allowed to reply to this message' });
    }

    await messages.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reply: reply.trim(),
          repliedBy: currentUser.name || currentUser.role,
          repliedAt: new Date(),
        },
      }
    );

    res.json({ message: 'Reply sent successfully' });
  } catch (err) {
    console.error('PATCH /api/messages/:id/reply error:', err);
    res.status(500).json({ message: err.message || 'Failed to send reply' });
  }
});

// ৪. মেসেজ ডিলিট করা (প্রেরক, প্রাপক Technician, অথবা Admin)
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const currentUser = await resolveRequestUser(req);
    if (!currentUser?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    const { messages } = await getCollections();
    const target = await messages.findOne({ _id: new ObjectId(id) });
    if (!target) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const userEmail = currentUser.email.toLowerCase();
    const isAllowed =
      currentUser.role === 'admin' ||
      (target.senderEmail || '').toLowerCase() === userEmail ||
      (currentUser.role === 'technician' &&
        target.recipientRole === 'technician' &&
        (target.recipientEmail || '').toLowerCase() === userEmail);

    if (!isAllowed) {
      return res.status(403).json({ message: 'Not allowed to delete this message' });
    }

    await messages.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/messages/:id error:', err);
    res.status(500).json({ message: err.message || 'Failed to delete message' });
  }
});

// ৫. Technician-এর প্রতিটি সার্ভিস অনুযায়ী Reviews লোড করা
app.get('/api/reviews/technician', async (req, res) => {
  try {
    const currentUser = await resolveRequestUser(req);
    if (!currentUser?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { services, bookings } = await getCollections();
    const techEmail = currentUser.email.toLowerCase();

    const techServices = await services
      .find({
        $or: [
          { technicianEmail: techEmail },
          { providerEmail: techEmail },
          { email: techEmail },
        ],
      })
      .toArray();

    const serviceIds = techServices.map((s) => String(s._id));
    const serviceTitleMap = {};
    techServices.forEach((s) => {
      serviceTitleMap[String(s._id)] = s.title;
    });

    const relatedBookings = await bookings
      .find({
        $or: [
          { technicianEmail: techEmail },
          { serviceId: { $in: serviceIds } },
        ],
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();

    const reviews = relatedBookings
      .filter((b) => typeof b.rating === 'number' || (b.review && b.review.trim()))
      .map((b) => ({
        id: b._id,
        serviceId: b.serviceId,
        serviceTitle:
          b.serviceTitle ||
          serviceTitleMap[String(b.serviceId)] ||
          'Repair Service',
        customerName: b.customerName || 'Customer',
        rating: Number(b.rating) || 5,
        review: b.review || '',
        createdAt: b.reviewedAt || b.updatedAt || b.createdAt,
      }));

    res.json({ reviews, services: techServices });
  } catch (err) {
    console.error('GET /api/reviews/technician error:', err);
    res.status(500).json({ message: err.message || 'Failed to load reviews' });
  }
});

// ৬. Admin-এর জন্য সব সার্ভিস ও টেকনিশিয়ানের Reviews লোড করা
app.get('/api/reviews/admin', async (req, res) => {
  try {
    const currentUser = await resolveRequestUser(req);
    if (!currentUser?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access only' });
    }

    const { services, bookings } = await getCollections();
    const [allServices, allBookings] = await Promise.all([
      services.find({}).toArray(),
      bookings.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray(),
    ]);

    const serviceMap = {};
    allServices.forEach((s) => {
      serviceMap[String(s._id)] = s;
    });

    const reviews = allBookings
      .filter((b) => typeof b.rating === 'number' || (b.review && b.review.trim()))
      .map((b) => {
        const srv = serviceMap[String(b.serviceId)] || {};
        return {
          id: b._id,
          serviceId: b.serviceId,
          serviceTitle: b.serviceTitle || srv.title || 'Repair Service',
          technicianName: b.technicianName || srv.technicianName || 'Technician',
          technicianEmail: b.technicianEmail || srv.technicianEmail || '',
          customerName: b.customerName || 'Customer',
          rating: Number(b.rating) || 5,
          review: b.review || '',
          createdAt: b.reviewedAt || b.updatedAt || b.createdAt,
        };
      });

    res.json({ reviews });
  } catch (err) {
    console.error('GET /api/reviews/admin error:', err);
    res.status(500).json({ message: err.message || 'Failed to load admin reviews' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FixMate Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });