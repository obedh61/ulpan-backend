const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');

// Cargar env ANTES de configs que las usan
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const passport = require('./config/passport');

connectDB();

const app = express();

// Seguridad y compresión
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// CORS — permitir frontend en dev y producción
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'https://ulpanjerusalem.com',
  'https://www.ulpanjerusalem.com',
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (Postman, curl, healthchecks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Session para Passport OAuth flow
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ulpan-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/maestro', require('./routes/maestro'));
app.use('/api/alumno', require('./routes/alumno'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/coupons', require('./routes/coupon'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/avatar', require('./routes/avatar'));
app.use('/api/exchange-rates', require('./routes/exchangeRate'));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
