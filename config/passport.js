const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { sendWelcomeEmail } = require('../services/emailService');

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const nombre = profile.displayName;
        const googleId = profile.id;

        // Buscar usuario por googleId o email
        let user = await User.findOne({
          $or: [{ googleId }, { email }],
        });

        if (user) {
          // Si existe por email pero sin googleId, vincular la cuenta
          if (!user.googleId) {
            user.googleId = googleId;
            user.emailVerified = true;
            await user.save();
          }
          return done(null, user);
        }

        // Crear nuevo usuario con rol alumno por defecto (Google = email verificado)
        user = await User.create({
          nombre,
          email,
          googleId,
          rol: 'alumno',
          emailVerified: true,
          avatar: profile.photos?.[0]?.value || null,
        });

        // Enviar email de bienvenida
        sendWelcomeEmail(user).catch((err) =>
          console.error('Error enviando welcome email (Google):', err)
        );

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
    )
  );
} else {
  console.warn('GOOGLE_CLIENT_ID/SECRET no configurados — Google OAuth deshabilitado');
}

module.exports = passport;
