const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Task = require('../models/Task');
const User = require('../models/User');
const Household = require('../models/Household');
const sendTaskEmails = require('../utils/sendTaskEmails');
// @route   GET api/tasks
// @desc    Get all tasks (filtered by query params)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, priority, household, category } = req.query;
    const filterQuery = {};
    
    // If user is a leader or admin, they can see tasks they assigned
    if (req.user.role === 'leader' || req.user.role === 'admin') {
      // Allow leader/admin to view all tasks or filter by household if specified
      if (household) {
        filterQuery.assignedTo = household;
      } else {
        filterQuery.assignedBy = req.user.id;
      }
    }
    
    // If user is a household member, they can only see tasks assigned to their household
    if (req.user.role === 'household') {
      // Find the household this user belongs to
      const household = await Household.findOne({ members: req.user.id });
      if (!household) {
        return res.status(404).json({ message: 'Household not found for this user' });
      }
      filterQuery.assignedTo = household._id;
    }
    
    // Apply filters if provided
    if (status) filterQuery.status = status;
    if (priority) filterQuery.priority = priority;
    if (household && (req.user.role === 'leader' || req.user.role === 'admin')) {
      filterQuery.assignedTo = household;
    }
    if (category) filterQuery.category = category;
    
    const tasks = await Task.find(filterQuery)
      .populate('assignedBy', 'name role')
      .populate('assignedTo', 'name address')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks/:id
// @desc    Get task by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedBy', 'name role')
      .populate('assignedTo', 'name address');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if user has permission to view this task
    const household = await Household.findById(task.assignedTo);
    const isHouseholdMember = household?.members.includes(req.user.id);
    const isTaskAssigner = task.assignedBy.toString() === req.user.id;
    
    if (!isHouseholdMember && !isTaskAssigner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this task' });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/tasks
// @desc    Create a new task
// @access  Private (Leaders and Admins only)
router.post('/',
  protect,
  [
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('assignedTo', 'Household ID is required').not().isEmpty(),
    check('dueDate', 'Due date is required').not().isEmpty(),
    check('priority', 'Priority must be low, medium, or high').isIn(['low', 'medium', 'high']),
    check('category', 'Category is required').isIn(['cleanliness', 'security', 'community_participation', 'maintenance', 'other'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Only leaders and admins can create tasks
    if (req.user.role !== 'leader' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to create tasks' });
    }
    
    try {
      const { title, description, assignedTo, dueDate, priority, category } = req.body;
      
      // Verify the household exists
      const household = await Household.findById(assignedTo);
      if (!household) {
        return res.status(404).json({ message: 'Household not found' });
      }
      
      const task = new Task({
        title,
        description,
        assignedBy: req.user.id,
        assignedTo,
        dueDate,
        priority,
        category,
        status: 'pending'
      });
      
      await task.save();
      await sendTaskEmails(req.body.zone, req.body);
      // Create the alert in the database
      res.json({
        success: true,
        data: task
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check permissions
    // Leaders/admins can update any field
    // Household members can only update status
    const updateFields = {};
    
    if (req.user.role === 'leader' || req.user.role === 'admin') {
      // Task creator can update all fields
      if (task.assignedBy.toString() === req.user.id || req.user.role === 'admin') {
        const { title, description, dueDate, priority, category, status, rating, feedback } = req.body;
        
        if (title) updateFields.title = title;
        if (description) updateFields.description = description;
        if (dueDate) updateFields.dueDate = dueDate;
        if (priority) updateFields.priority = priority;
        if (category) updateFields.category = category;
        if (status) updateFields.status = status;
        if (rating !== undefined) updateFields.rating = rating;
        if (feedback) updateFields.feedback = feedback;
      } else {
        return res.status(403).json({ message: 'Not authorized to update this task' });
      }
    } else {
      // Household members can only update status
      const household = await Household.findById(task.assignedTo);
      const isHouseholdMember = household?.members.includes(req.user.id);
      
      if (isHouseholdMember) {
        const { status } = req.body;
        if (status) updateFields.status = status;
      } else {
        return res.status(403).json({ message: 'Not authorized to update this task' });
      }
    }
    
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    // If status is being set to 'completed', set completedAt date
    if (updateFields.status === 'completed' && task.status !== 'completed') {
      updateFields.completedAt = Date.now();
    }
    
    // Update the updatedAt timestamp
    updateFields.updatedAt = Date.now();
    
    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );
    
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/tasks/:id
// @desc    Delete a task
// @access  Private (Task creator or Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if user is authorized to delete
    if (task.assignedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }
    
    await Task.deleteOne({ _id: task._id });
    
    res.json({
      success: true,
      message: 'Task deleted'
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/tasks/:id/rate
// @desc    Rate a completed task
// @access  Private (Leaders only)
router.put('/:id/rate',
  protect,
  [
    check('rating', 'Rating must be between 0 and 5').isFloat({ min: 0, max: 5 }),
    check('feedback', 'Feedback is required when rating a task').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const task = await Task.findById(req.params.id);
      
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Check if user is authorized to rate (must be the assigner)
      if (task.assignedBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to rate this task' });
      }
      
      // Check if task is completed
      if (task.status !== 'completed') {
        return res.status(400).json({ message: 'Only completed tasks can be rated' });
      }
      
      const { rating, feedback } = req.body;
      
      task.rating = rating;
      task.feedback = feedback;
      task.updatedAt = Date.now();
      
      await task.save();
      
      res.json({
        success: true,
        data: task
      });
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Task not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;
