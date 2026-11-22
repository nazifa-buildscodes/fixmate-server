import express from 'express';
import { getCollections } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', verifyToken, async (req, res) => {
  try {
    const { users } = getCollections();
    const user = await users.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, area, bio, image } = req.body;
    const { users } = getCollections();

    const updateDoc = {};
    if (name !== undefined && name.trim()) updateDoc.name = name.trim();
    if (phone !== undefined) updateDoc.phone = phone.trim();
    if (area !== undefined) updateDoc.area = area.trim();
    if (bio !== undefined) updateDoc.bio = bio.trim();
    if (image !== undefined && image.trim()) updateDoc.image = image.trim();

    await users.updateOne({ email: req.user.email }, { $set: updateDoc });

    const updatedUser = await users.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router;
