const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const passport = require('passport');
const { registro, login, getPerfil, forgotPassword, resetPassword, verificarEmail, reenviarVerificacion } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('nombre', 'El nombre es obligatorio').notEmpty(),
    body('email', 'Email válido requerido').isEmail(),
    body('password', 'La contraseña debe tener al menos 6 caracteres').isLength({ min: 6 }),
  ],
  registro
);

router.post(
  '/login',
  [
    body('email', 'Email válido requerido').isEmail(),
    body('password', 'La contraseña es obligatoria').notEmpty(),
  ],
  login
);

router.get('/perfil', authMiddleware, getPerfil);

// Password reset
router.post(
  '/forgot-password',
  [body('email', 'Email valido requerido').isEmail()],
  forgotPassword
);

router.post(
  '/reset-password/:token',
  [
    body('password', 'La contrasena debe tener al menos 6 caracteres').isLength({ min: 6 }),
    body('confirmPassword', 'Confirmar contrasena es obligatorio').notEmpty(),
  ],
  resetPassword
);

// Email verification
router.get('/verify-email/:token', verificarEmail);

router.post(
  '/resend-verification',
  [body('email', 'Email valido requerido').isEmail()],
  reenviarVerificacion
);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/auth/callback?token=${token}`);
  }
);

module.exports = router;
