const jwt = require('jsonwebtoken');

// Middleware to protect routes
const authenticateJWT = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Get token from Authorization header

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403); // Forbidden
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401); // Unauthorized
    }
};

module.exports = authenticateJWT;
