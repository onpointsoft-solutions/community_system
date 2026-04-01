const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/regist', async (req, res) => {
  try {
    const { name, email, password, phoneNumber, role, zoneId, householdId, adminCode } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Validate admin registration code if registering as admin
    if (role === 'admin') {
      const validAdminCode = process.env.ADMIN_REGISTRATION_CODE || 'admin123';
      if (adminCode !== validAdminCode) {
        return res.status(400).json({ success: false, message: 'Invalid admin registration code' });
      }
    }

    // Validate zone for leaders and household members
    if ((role === 'leader' || role === 'household') && !zoneId) {
      return res.status(400).json({ success: false, message: 'Zone is required for leaders and household members' });
    }

    // Validate household for household members
    if (role === 'household' && !householdId) {
      return res.status(400).json({ success: false, message: 'Household is required for household members' });
    }

    // Create user with required fields
    user = new User({
      name,
      email,
      password, // Password will be hashed by the User model pre-save middleware
      phoneNumber,
      role,
      zone: role === 'leader' || role === 'household' ? zoneId : undefined,
      household: role === 'household' ? householdId : undefined
    });

    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    // Return success without sending back the password
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        zone: user.zone,
        household: user.household
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide an email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;



module.exports = router;
