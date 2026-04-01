const express = require('express');
const router = express.Router();
const Household = require('../models/Household');
const NyumbaKumiZone = require('../models/NyumbaKumiZone');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/households
// @desc    Get all households
// @access  Private (Leader, Admin)
router.get('/', protect, authorize('leader', 'admin'), async (req, res) => {
  try {
    let query;

    // If user is a leader, only get households in their zone
    if (req.user.role === 'leader') {
      // This will need to be adjusted based on how we store the leader's zone info
      const nyumbaKumiZones = await NyumbaKumiZone.find({ leader: req.user.id });
      const zoneIds = nyumbaKumiZones.map(zone => zone._id);
      query = Household.find({ nyumbaKumiZone: { $in: zoneIds } });
    } else {
      query = Household.find();
    }

    // Add pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Household.countDocuments(query);

    query = query.skip(startIndex).limit(limit).populate('user', 'name email phoneNumber');

    // Execute query
    const households = await query;

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
      count: households.length,
      pagination,
      data: households
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/public', async (req, res) => {
  try {
    let query = {};
    
    // Filter by zone if provided
    if (req.query.zoneId) {
      query.nyumbaKumiZone = req.query.zoneId;
    }

    const households = await Household.find(query)
      .populate('user', 'name email phoneNumber')
      .populate('nyumbaKumiZone', 'name');

    res.status(200).json({
      success: true,
      count: households.length,
      data: households
    });
  } catch (err) {
    console.error('Error fetching households:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// @route   GET /api/households/:id
// @desc    Get household by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id).populate('user', 'name email phoneNumber');

    if (!household) {
      return res.status(404).json({ message: 'Household not found' });
    }

    // Make sure user is authorized to view this household
    if (req.user.role !== 'admin' && 
        req.user.role !== 'leader' && 
        household.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this household' });
    }

    res.status(200).json({
      success: true,
      data: household
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/households
// @desc    Create new household
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    // Add user to req.body - MongoDB uses _id not id
    req.body.user = req.user._id;

    // Create household
    const household = await Household.create(req.body);

    res.status(201).json({
      success: true,
      data: household
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/households/:id
// @desc    Update household
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let household = await Household.findById(req.params.id);

    if (!household) {
      return res.status(404).json({ message: 'Household not found' });
    }

    // Make sure user is household owner or admin
    if (household.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this household' });
    }

    household = await Household.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: household
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// @route   GET /api/households/member
// @desc    Get household details for the logged-in household member
// @access  Private
router.get('/member',async (req, res) => {
  try {
    // Find the household where the user is a member
    const household = await Household.findOne({ members: req.user.id })
      .populate('nyumbaKumiZone', 'name')
      .populate('members', 'name email phoneNumber');

    if (!household) {
      return res.status(404).json({ message: 'You are not associated with any household' });
    }

    // Fetch tasks assigned to this household
    const tasks = await Task.find({ householdId: household._id });

    // Fetch alerts related to the household's zone
    const alerts = await Alert.find({ zoneId: household.nyumbaKumiZone });

    res.status(200).json({
      success: true,
      household,
      tasks,
      alerts
    });
  } catch (err) {
    console.error('Error fetching household member data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route   POST /api/households/:id/members
// @desc    Add a user to household members
// @access  Private (Admin, Leader)
router.post('/:id/members', protect, authorize('admin', 'leader'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'Please provide a user ID' });
    }
    
    const household = await Household.findById(req.params.id);
    
    if (!household) {
      return res.status(404).json({ message: 'Household not found' });
    }
    
    // Check if user is already a member
    if (household.members.includes(userId)) {
      return res.status(400).json({ message: 'User is already a member of this household' });
    }
    
    // Add user to household members
    household.members.push(userId);
    await household.save();
    
    res.status(200).json({
      success: true,
      data: household
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/households/:id/members/:userId
// @desc    Remove a user from household members
// @access  Private (Admin, Leader)
router.delete('/:id/members/:userId', protect, authorize('admin', 'leader'), async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    
    if (!household) {
      return res.status(404).json({ message: 'Household not found' });
    }
    
    // Check if user is a member
    if (!household.members.includes(req.params.userId)) {
      return res.status(400).json({ message: 'User is not a member of this household' });
    }
    
    // Remove user from household members
    household.members = household.members.filter(
      member => member.toString() !== req.params.userId
    );
    await household.save();
    
    res.status(200).json({
      success: true,
      data: household
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/households/my-household
// @desc    Get the household a user belongs to
// @access  Private
router.get('/my-household', protect, async (req, res) => {
  try {
    // Find household where the user is a member
    const household = await Household.findOne({ members: req.user.id })
      .populate('nyumbaKumiZone', 'name')
      .populate('members', 'name email phoneNumber');
    
    if (!household) {
      return res.status(404).json({ message: 'You are not associated with any household' });
    }
    
    res.status(200).json({
      success: true,
      data: household
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/households/:id
// @desc    Delete household
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);

    if (!household) {
      return res.status(404).json({ message: 'Household not found' });
    }

    // Make sure user is household owner or admin
    if (household.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this household' });
    }

    await household.remove();

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
