const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const NyumbaKumiZone = require('../models/NyumbaKumiZone');
const { protect, authorize } = require('../middleware/auth');
const { main } = require('../utils/email');
const {User}=require('../models/User');
const sendAlertEmails = require('../utils/sendAlertEmails');

// @route   GET /api/alerts
// @desc    Get all alerts for user (leaders get all in their zones, households get only their zone alerts)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query;

    // Different queries based on user role
    if (req.user.role === 'admin') {
      // Admins can see all alerts
      query = Alert.find();
    } else if (req.user.role === 'leader') {
      // Leaders can see alerts for their zones
      const zones = await NyumbaKumiZone.find({ leader: req.user.id });
      const zoneIds = zones.map(zone => zone._id);
      query = Alert.find({ zone: { $in: zoneIds } });
    } else {
      // Household users can only see alerts for their zone or targeted to them
      // This assumes we have the household info in the request
      // You might need to adjust this to look up the household first
      query = Alert.find({ 
        $or: [
          { targetHouseholds: req.user.id }, // Direct alerts to this household user
          { zone: req.user.zoneId } // Zone-wide alerts (you would need to add zoneId to req.user)
        ]
      });
    }

    // Add filtering
    if (req.query.priority) {
      query = query.find({ priority: req.query.priority });
    }

    if (req.query.status) {
      query = query.find({ status: req.query.status });
    } else {
      // By default, only show active alerts
      query = query.find({ status: 'active' });
    }

    // Add pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Alert.countDocuments(query);

    query = query.skip(startIndex).limit(limit)
                 .populate('sender', 'name')
                 .populate('zone', 'name')
                 .sort({ createdAt: -1 }); // Newest first

    // Execute query
    const alerts = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: alerts.length,
      pagination,
      data: alerts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/alerts/:id
// @desc    Get single alert
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
                              .populate('sender', 'name')
                              .populate('zone', 'name')
                              .populate('targetHouseholds', 'address houseNumber');

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Check if user has access to this alert
    if (req.user.role === 'household') {
      // Logic to check if alert is in user's zone or targeted to user
      // This would need to be adjusted based on your data structure
    }

    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/alerts
// @desc    Create a new alert
// @access  Private (Leaders and Admins only)
router.post('/', protect, authorize('leader', 'admin'), async (req, res) => {
  try {
    // Add user as sender
    req.body.sender = req.user.id;

    // If leader, verify they manage the zone
    if (req.user.role === 'leader') {
      const zone = await NyumbaKumiZone.findOne({ 
        _id: req.body.zone,
        leader: req.user.id
      });

      if (!zone) {
        return res.status(403).json({ message: 'Not authorized to create alerts for this zone' });
      }
    }
    // Send emails concurrently
    await sendAlertEmails(req.body.zone, req.body);
    // Create the alert in the database
    const alert = await Alert.create(req.body);

    res.status(201).json({
      success: true,
      data: alert
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route   PUT /api/alerts/:id
// @desc    Update alert
// @access  Private (Leader who created it or Admin)
router.put('/:id', protect, authorize('leader', 'admin'), async (req, res) => {
  try {
    let alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Check if user is authorized to update this alert
    if (req.user.role === 'leader' && alert.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this alert' });
    }

    alert = await Alert.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: alert
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/alerts/:id
// @desc    Delete alert (or mark as deleted)
// @access  Private (Leader who created it or Admin)
router.delete('/:id', protect, authorize('leader', 'admin'), async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Check if user is authorized to delete this alert
    if (req.user.role === 'leader' && alert.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this alert' });
    }

    // Option 1: Hard delete
    await alert.remove();

    // Option 2: Soft delete (mark as deleted)
    // alert.status = 'deleted';
    // await alert.save();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
