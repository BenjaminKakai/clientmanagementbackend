// authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
    console.log('Incoming request headers:', req.headers);
    const authHeader = req.headers.authorization;
    console.log('Authorization Header:', authHeader);
  
    if (!authHeader) {
      console.log('No authorization header provided');
      return res.status(401).json({ message: 'No authorization header provided' });
    }
  
    if (!authHeader.startsWith('Bearer ')) {
      console.log('Invalid authorization header format');
      return res.status(401).json({ message: 'Invalid authorization header format' });
    }
  
    const token = authHeader.split(' ')[1];
    console.log('Extracted token:', token);
  
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('Successfully authenticated user:', decoded.email);
      next();
    } catch (error) {
      console.error('JWT verification failed:', error);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      return res.status(403).json({ message: 'Invalid token' });
    }
  };

module.exports = authenticateJWT;