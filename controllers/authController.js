const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emailService');

const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// POST /api/auth/register
const registro = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { nombre, email, password, rol } = req.body;

    const existeUsuario = await User.findOne({ email });
    if (existeUsuario) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const user = await User.create({ nombre, email, password, rol });

    // Enviar email de bienvenida (no bloquea la respuesta)
    sendWelcomeEmail(user).catch((err) =>
      console.error('Error enviando welcome email:', err)
    );

    res.status(201).json({
      _id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      token: generarToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Usuario registrado solo con Google
    if (!user.password && user.googleId) {
      return res.status(401).json({
        message: 'Esta cuenta fue creada con Google. Usa "Continuar con Google" para ingresar.',
      });
    }

    const passwordCorrecto = await user.compararPassword(password);
    if (!passwordCorrecto) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    res.json({
      _id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      token: generarToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/auth/perfil
const getPerfil = async (req, res) => {
  res.json({
    _id: req.user._id,
    nombre: req.user.nombre,
    email: req.user.email,
    rol: req.user.rol,
    googleId: req.user.googleId || null,
  });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;

    // Siempre responder igual por seguridad
    const mensajeExito = 'Si el email esta registrado, recibiras instrucciones para restablecer tu contrasena';

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.json({ message: mensajeExito });
    }

    // Usuarios Google-only no pueden resetear password
    if (!user.password && user.googleId) {
      return res.json({ message: mensajeExito });
    }

    // Generar token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
    await user.save({ validateBeforeSave: false });

    // Enviar email con token sin hashear
    sendPasswordResetEmail(user, resetToken).catch((err) =>
      console.error('Error enviando reset email:', err)
    );

    res.json({ message: mensajeExito });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// POST /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Las contrasenas no coinciden' });
    }

    // Hashear token recibido para buscar en DB
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'Token invalido o expirado' });
    }

    // Actualizar password y limpiar tokens
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Enviar confirmación
    sendPasswordChangedEmail(user).catch((err) =>
      console.error('Error enviando password changed email:', err)
    );

    res.json({ message: 'Contrasena actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = { registro, login, getPerfil, forgotPassword, resetPassword };
