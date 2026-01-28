const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields required' });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: 'Email already in use' });

    const user = new User({ username, email, password });
    await user.save();

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not defined in .env");
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token });

  } catch (error) {
    console.error('REGISTER ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.comparePassword)
      throw new Error("comparePassword method missing in User model");

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });

  } catch (error) {
    console.error('LOGIN ERROR:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
