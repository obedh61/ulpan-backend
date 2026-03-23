const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const { sendCourseEnrollmentEmail } = require('../services/emailService');

// POST /api/enrollments
const enrollStudent = async (req, res) => {
  try {
    const { cursoId } = req.body;

    const course = await Course.findById(cursoId);
    if (!course || !course.activo) {
      return res.status(404).json({ message: 'Curso no encontrado o inactivo' });
    }

    if (course.inscripcionesAbiertas === false) {
      return res.status(400).json({ message: 'Las inscripciones para este curso están cerradas' });
    }

    // Bloquear inscripcion directa si el curso requiere pago
    if (!course.esGratuito && course.precio > 0) {
      return res.status(400).json({
        message: 'Este curso requiere pago previo',
        requiresPayment: true,
        cursoId: course._id,
        precio: course.precio,
        moneda: course.moneda,
      });
    }

    const existeInscripcion = await Enrollment.findOne({
      cursoId,
      alumnoId: req.user._id,
    });
    if (existeInscripcion) {
      return res.status(400).json({ message: 'Ya estás inscrito en este curso' });
    }

    const enrollment = await Enrollment.create({
      cursoId,
      alumnoId: req.user._id,
    });

    // Enviar email de confirmación de inscripción (no bloquea la respuesta)
    sendCourseEnrollmentEmail(req.user, course).catch((err) =>
      console.error('Error enviando enrollment email:', err)
    );

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ message: 'Error al inscribirse', error: error.message });
  }
};

// GET /api/enrollments/mis-cursos
const getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ alumnoId: req.user._id }).populate({
      path: 'cursoId',
      populate: { path: 'maestroId', select: 'nombre email' },
    });
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener inscripciones', error: error.message });
  }
};

// GET /api/enrollments/curso/:cursoId
const getEnrollmentsByCourse = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      cursoId: req.params.cursoId,
    }).populate('alumnoId', 'nombre email');
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
  }
};

// DELETE /api/enrollments/:id
const deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ message: 'Inscripción no encontrada' });
    }

    if (
      enrollment.alumnoId.toString() !== req.user._id.toString() &&
      req.user.rol !== 'admin'
    ) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await Enrollment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Inscripción eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar inscripción', error: error.message });
  }
};

module.exports = { enrollStudent, getMyEnrollments, getEnrollmentsByCourse, deleteEnrollment };
