import jwt from 'jsonwebtoken';
import { getCollections } from '../config/db.js';

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { users } = getCollections();
    const dbUser = await users.findOne({ email: decoded.email });

    if (!dbUser) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    req.user = {
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role || 'customer',
      image: dbUser.image || '',
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
}

export function verifyCustomer(req, res, next) {
  if (req.user?.role !== 'customer') {
    return res.status(403).json({ message: 'Forbidden: Customer access only' });
  }
  next();
}

export function verifyTechnician(req, res, next) {
  if (req.user?.role !== 'technician') {
    return res.status(403).json({ message: 'Forbidden: Technician access only' });
  }
  next();
}

export function verifyAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access only' });
  }
  next();
}
