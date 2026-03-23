const express = require('express');
const {
  enrollStudent,
  getMyEnrollments,
  getEnrollmentsByCourse,
  deleteEnrollment,
} = require('../controllers/enrollmentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware('alumno'), enrollStudent);
router.get('/mis-cursos', authMiddleware, getMyEnrollments);
router.get(
  '/curso/:cursoId',
  authMiddleware,
  roleMiddleware('admin', 'maestro'),
  getEnrollmentsByCourse
);
router.delete('/:id', authMiddleware, deleteEnrollment);

module.exports = router;
