// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'No token provided or invalid Authorization header format'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user id (you can also attach full object if needed)
        req.userId = decoded.id;        // ← more explicit name
        // req.user = decoded;          // ← alternative if you want full payload

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.name, error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token has expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        return res.status(401).json({ success: false, message: 'Authentication failed' });
    }
};