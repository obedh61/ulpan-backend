const express = require('express');
const { body } = require('express-validator');
const {
  getEstadisticas,
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  getMaestros,
  getCoursesAdmin,
  getClasesCursoAdmin,
  actualizarClaseAdmin,
  getIngresos,
  getPayments,
  exportIngresos,
} = require('../controllers/adminController');
const { obtenerEstadisticasGlobal } = require('../controllers/videoController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('admin'));

router.get('/estadisticas', getEstadisticas);

router.get('/maestros', getMaestros);

router.get('/usuarios', getUsuarios);

router.post(
  '/usuarios',
  [
    body('nombre', 'El nombre es obligatorio').notEmpty(),
    body('email', 'Email válido requerido').isEmail(),
    body('password', 'La contraseña debe tener al menos 6 caracteres').isLength({ min: 6 }),
    body('rol', 'Rol inválido').isIn(['admin', 'maestro', 'alumno']),
  ],
  crearUsuario
);

router.put('/usuarios/:id', actualizarUsuario);

router.delete('/usuarios/:id', eliminarUsuario);

router.get('/courses', getCoursesAdmin);

router.get('/courses/:id/clases', getClasesCursoAdmin);

router.put('/clases/:claseId', actualizarClaseAdmin);

router.get('/ingresos', getIngresos);
router.get('/ingresos/export', exportIngresos);
router.get('/payments', getPayments);

router.get('/video-stats', obtenerEstadisticasGlobal);

module.exports = router;
