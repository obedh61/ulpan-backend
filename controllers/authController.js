const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emailService');

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
    const { nombre, email, password, rol, idioma } = req.body;

    const existeUsuario = await User.findOne({ email });
    if (existeUsuario) {
      return res.status(400).json({ message: 'El email ya está registrado', messageKey: 'auth.emailAlreadyRegistered' });
    }

    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const lang = ['es', 'en', 'he'].includes(idioma) ? idioma : 'es';

    const user = await User.create({
      nombre,
      email,
      password,
      rol,
      idioma: lang,
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 3600000, // 24 horas
    });

    // Enviar email de verificación (no bloquea la respuesta)
    sendVerificationEmail(user, verificationToken).catch((err) =>
      console.error('Error enviando verification email:', err)
    );

    res.status(201).json({
      message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.',
      needsVerification: true,
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

    const user = await User.findOne({ email }).select('+password +emailVerificationToken');
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas', messageKey: 'auth.invalidCredentials' });
    }

    // Usuario registrado solo con Google
    if (!user.password && user.googleId) {
      return res.status(401).json({
        message: 'Esta cuenta fue creada con Google. Usa "Continuar con Google" para ingresar.',
        messageKey: 'auth.googleOnlyAccount',
      });
    }

    const passwordCorrecto = await user.compararPassword(password);
    if (!passwordCorrecto) {
      return res.status(401).json({ message: 'Credenciales inválidas', messageKey: 'auth.invalidCredentials' });
    }

    // Verificar que el email esté confirmado
    // Usuarios legacy (sin emailVerificationToken) se tratan como verificados
    if (!user.emailVerified && user.emailVerificationToken) {
      return res.status(403).json({
        message: 'Debes verificar tu email antes de iniciar sesión. Revisa tu correo.',
        messageKey: 'auth.mustVerifyEmail',
        needsVerification: true,
        email: user.email,
      });
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
    const respuestaGenerica = { message: 'Si el email esta registrado, recibiras instrucciones para restablecer tu contrasena', messageKey: 'auth.forgotPasswordSuccess' };

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.json(respuestaGenerica);
    }

    // Usuarios Google-only no pueden resetear password
    if (!user.password && user.googleId) {
      return res.json(respuestaGenerica);
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

    res.json(respuestaGenerica);
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
      return res.status(400).json({ message: 'Las contrasenas no coinciden', messageKey: 'auth.passwordsNoMatch' });
    }

    // Hashear token recibido para buscar en DB
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'Token invalido o expirado', messageKey: 'auth.tokenExpired' });
    }

    // Actualizar password y limpiar tokens
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Si el usuario resetea su password, su email es válido
    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
    }
    await user.save();

    // Enviar confirmación
    sendPasswordChangedEmail(user).catch((err) =>
      console.error('Error enviando password changed email:', err)
    );

    res.json({ message: 'Contrasena actualizada exitosamente', messageKey: 'auth.passwordUpdatedSuccess' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/auth/verify-email/:token
const verificarEmail = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({ message: 'Token de verificación inválido o expirado', messageKey: 'auth.verifyTokenExpired' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Enviar email de bienvenida ahora que la cuenta está verificada
    sendWelcomeEmail(user).catch((err) =>
      console.error('Error enviando welcome email:', err)
    );

    res.json({
      message: 'Email verificado exitosamente. Ya puedes iniciar sesión.',
      messageKey: 'auth.emailVerifiedSuccess',
      verified: true,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// POST /api/auth/resend-verification
const reenviarVerificacion = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, idioma } = req.body;

    const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) {
      // Respuesta genérica por seguridad
      return res.json({ message: 'Si el email está registrado, recibirás un nuevo enlace de verificación.', messageKey: 'auth.resendVerificationSuccess' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Tu cuenta ya está verificada. Puedes iniciar sesión.', messageKey: 'auth.alreadyVerified' });
    }

    // Generar nuevo token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 3600000; // 24 horas
    // Actualizar idioma si se envía
    if (['es', 'en', 'he'].includes(idioma)) {
      user.idioma = idioma;
    }
    await user.save({ validateBeforeSave: false });

    sendVerificationEmail(user, verificationToken).catch((err) =>
      console.error('Error reenviando verification email:', err)
    );

    res.json({ message: 'Si el email está registrado, recibirás un nuevo enlace de verificación.', messageKey: 'auth.resendVerificationSuccess' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = { registro, login, getPerfil, forgotPassword, resetPassword, verificarEmail, reenviarVerificacion };
