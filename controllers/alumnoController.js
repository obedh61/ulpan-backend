const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Clase = require('../models/Clase');

// GET /api/alumno/courses
const getMisCursos = async (req, res) => {
  try {
    const inscripciones = await Enrollment.find({ alumnoId: req.user._id })
      .populate({
        path: 'cursoId',
        populate: { path: 'maestroId', select: 'nombre' },
      })
      .sort({ fechaInscripcion: -1 });

    const cursos = inscripciones
      .filter((i) => i.cursoId)
      .map((i) => ({
        ...i.cursoId.toObject(),
        fechaInscripcion: i.fechaInscripcion,
        enrollmentId: i._id,
      }));

    res.json(cursos);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/alumno/courses/:id
const getCursoDetalle = async (req, res) => {
  try {
    const inscripcion = await Enrollment.findOne({
      alumnoId: req.user._id,
      cursoId: req.params.id,
    }).populate({
      path: 'cursoId',
      populate: { path: 'maestroId', select: 'nombre email' },
    });

    if (!inscripcion || !inscripcion.cursoId) {
      return res.status(404).json({ message: 'Curso no encontrado o no estás inscrito' });
    }

    const clases = await Clase.find({ cursoId: req.params.id })
      .populate('videoId')
      .sort({ numeroClase: 1 });

    res.json({
      curso: inscripcion.cursoId,
      clases,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/alumno/cursos-disponibles
const getCursosDisponibles = async (req, res) => {
  try {
    // Get IDs of courses the student is already enrolled in
    const inscripciones = await Enrollment.find({ alumnoId: req.user._id }).select('cursoId');
    const cursosInscritos = inscripciones.map((i) => i.cursoId);

    // Get active paid courses the student is NOT enrolled in
    const cursos = await Course.find({
      activo: true,
      _id: { $nin: cursosInscritos },
      esGratuito: false,
      precio: { $gt: 0 },
    })
      .populate('maestroId', 'nombre')
      .sort({ createdAt: -1 });

    res.json(cursos);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = { getMisCursos, getCursoDetalle, getCursosDisponibles };
