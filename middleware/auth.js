const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token no válido' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        message: `Rol '${req.user.rol}' no tiene permiso para esta acción`,
      });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
