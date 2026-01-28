// backend/routes/tasks.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');

// GET all tasks of logged-in user
router.get('/', auth, async (req, res) => {
    try {
        const tasks = await Task.find({ user: req.userId }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
});

// POST new task
router.post('/', auth, async (req, res) => {
    try {
        const task = new Task({
            ...req.body,
            user: req.userId
        });
        await task.save();
        res.status(201).json(task);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// PUT update task
router.put('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found or not owned by you' });
        }

        res.json(task);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// DELETE task
router.delete('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found or not owned by you' });
        }

        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;