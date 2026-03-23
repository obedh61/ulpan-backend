const express = require('express');
const { body } = require('express-validator');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', getCourses);
router.get('/:id', getCourse);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'maestro'),
  [
    body('titulo.es', 'El titulo en espanol es obligatorio').notEmpty(),
    body('descripcion.es', 'La descripcion en espanol es obligatoria').notEmpty(),
  ],
  createCourse
);

router.put('/:id', authMiddleware, roleMiddleware('admin', 'maestro'), updateCourse);
router.delete('/:id', authMiddleware, roleMiddleware('admin', 'maestro'), deleteCourse);

module.exports = router;
