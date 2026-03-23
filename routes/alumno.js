const express = require('express');
const { getMisCursos, getCursoDetalle, getCursosDisponibles } = require('../controllers/alumnoController');
const { obtenerStream, registrarProgreso } = require('../controllers/videoController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('alumno'));

router.get('/courses', getMisCursos);
router.get('/cursos-disponibles', getCursosDisponibles);
router.get('/courses/:id', getCursoDetalle);

// Video
router.get('/videos/:id/stream', obtenerStream);
router.post('/videos/:id/track', registrarProgreso);

module.exports = router;
