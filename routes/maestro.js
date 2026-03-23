const express = require('express');
const {
  getMisCursos,
  getAlumnosCurso,
  getClasesCurso,
  actualizarClase,
} = require('../controllers/maestroController');
const { crearSubida, obtenerEstado, eliminarVideo, obtenerEstadisticasCurso, obtenerEstadisticasAlumnos } = require('../controllers/videoController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('maestro'));

router.get('/courses', getMisCursos);

router.get('/courses/:id/alumnos', getAlumnosCurso);

router.get('/courses/:id/clases', getClasesCurso);

router.put('/clases/:claseId', actualizarClase);

// Video routes
router.post('/videos/create-upload', crearSubida);
router.get('/videos/:id/status', obtenerEstado);
router.delete('/videos/:id', eliminarVideo);

// Video stats
router.get('/videos/stats/:cursoId', obtenerEstadisticasCurso);
router.get('/videos/stats/:cursoId/alumnos', obtenerEstadisticasAlumnos);

module.exports = router;
