import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyTechnician } from '../middleware/auth.js';

const router = express.Router();

const ALLOWED_CATEGORIES = [
  'Smartphone',
  'Laptop & PC',
  'AC',
  'Refrigerator',
  'TV',
  'Washing Machine',
  'Electrical',
];

// PUBLIC: Browse approved & available services (server-side search, filter, sort, pagination)
router.get('/', async (req, res) => {
  try {
    const { services, bookings } = getCollections();
    const {
      search = '',
      category = '',
      serviceMode = '',
      sort = 'newest',
      featured = '',
      page = '1',
      limit = '9',
    } = req.query;

    const query = {
      approvalStatus: 'approved',
      isAvailable: true,
    };

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { category: regex }];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (serviceMode && serviceMode !== 'all') {
      query.serviceMode = serviceMode;
    }

    let sortQuery = { createdAt: -1 };
    if (sort === 'price_asc') sortQuery = { basePrice: 1 };
    if (sort === 'price_desc') sortQuery = { basePrice: -1 };
    if (sort === 'newest') sortQuery = { createdAt: -1 };

    if (featured === 'true') {
      const featuredList = await services
        .find(query)
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      return res.json({ services: featuredList, total: featuredList.length });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(24, Math.max(1, parseInt(limit, 10) || 9));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      services.find(query).sort(sortQuery).skip(skip).limit(limitNum).toArray(),
      services.countDocuments(query),
    ]);

    const serviceIds = items.map((s) => s._id.toString());
    const ratingsAgg = await bookings
      .aggregate([
        { $match: { serviceId: { $in: serviceIds }, rating: { $exists: true } } },
        {
          $group: {
            _id: '$serviceId',
            avgRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const ratingMap = Object.fromEntries(ratingsAgg.map((r) => [r._id, r]));
    const enriched = items.map((s) => ({
      ...s,
      avgRating: ratingMap[s._id.toString()]?.avgRating
        ? Number(ratingMap[s._id.toString()].avgRating.toFixed(1))
        : null,
      reviewCount: ratingMap[s._id.toString()]?.reviewCount || 0,
    }));

    res.json({
      services: enriched,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load services', error: error.message });
  }
});

// TECHNICIAN: Get own services
router.get('/my', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { services } = getCollections();
    const list = await services
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ services: list });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your services' });
  }
});

// PUBLIC: Single service details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const { services, users, bookings } = getCollections();
    const service = await services.findOne({
      _id: new ObjectId(id),
      approvalStatus: 'approved',
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not found or unavailable' });
    }

    const technician = await users.findOne(
      { email: service.technicianEmail },
      { projection: { name: 1, image: 1, area: 1, bio: 1, email: 1 } }
    );

    const reviews = await bookings
      .find(
        { serviceId: id, rating: { $exists: true } },
        { projection: { customerName: 1, rating: 1, review: 1, reviewedAt: 1 } }
      )
      .sort({ reviewedAt: -1 })
      .toArray();

    const avgRating =
      reviews.length > 0
        ? Number(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          )
        : null;

    res.json({ service, technician, reviews, avgRating });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load service details' });
  }
});

// TECHNICIAN: Create service
router.post('/', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    if (
      !title?.trim() ||
      !ALLOWED_CATEGORIES.includes(category) ||
      !description?.trim() ||
      !image?.trim() ||
      !(Number(basePrice) > 0) ||
      !estimatedDuration?.trim() ||
      !['Home Visit', 'Shop Drop-off'].includes(serviceMode) ||
      !serviceArea?.trim()
    ) {
      return res.status(400).json({ message: 'Please fill all required fields validly' });
    }

    const { services } = getCollections();
    const newService = {
      title: title.trim(),
      category,
      description: description.trim(),
      image: image.trim(),
      basePrice: Number(basePrice),
      estimatedDuration: estimatedDuration.trim(),
      serviceMode,
      serviceArea: serviceArea.trim(),
      technicianName: req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: 'pending',
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await services.insertOne(newService);
    res.status(201).json({
      message: 'Service submitted and waiting for admin approval',
      service: { ...newService, _id: result.insertedId },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create service' });
  }
});

// TECHNICIAN: Update service or toggle availability
router.patch('/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid service ID' });
    }

    const { services } = getCollections();
    const existing = await services.findOne({ _id: new ObjectId(id) });

    if (!existing) return res.status(404).json({ message: 'Service not found' });
    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You do not own this service' });
    }

    if (Object.keys(req.body).length === 1 && typeof req.body.isAvailable === 'boolean') {
      await services.updateOne(
        { _id: existing._id },
        { $set: { isAvailable: req.body.isAvailable } }
      );
      return res.json({
        message: `Service is now ${req.body.isAvailable ? 'available' : 'unavailable'}`,
      });
    }

    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    const updateDoc = {
      title: title?.trim() || existing.title,
      category: ALLOWED_CATEGORIES.includes(category) ? category : existing.category,
      description: description?.trim() || existing.description,
      image: image?.trim() || existing.image,
      basePrice: Number(basePrice) > 0 ? Number(basePrice) : existing.basePrice,
      estimatedDuration: estimatedDuration?.trim() || existing.estimatedDuration,
      serviceMode: ['Home Visit', 'Shop Drop-off'].includes(serviceMode)
        ? serviceMode
        : existing.serviceMode,
      serviceArea: serviceArea?.trim() || existing.serviceArea,
      approvalStatus: 'pending',
    };

    await services.updateOne({ _id: existing._id }, { $set: updateDoc });
    res.json({ message: 'Service updated and sent for admin re-approval' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update service' });
  }
});

// TECHNICIAN: Delete service
router.delete('/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid service ID' });
    }

    const { services } = getCollections();
    const existing = await services.findOne({ _id: new ObjectId(id) });

    if (!existing) return res.status(404).json({ message: 'Service not found' });
    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You do not own this service' });
    }

    await services.deleteOne({ _id: existing._id });
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete service' });
  }
});

export default router;
