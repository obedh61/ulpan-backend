const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Clase = require('../models/Clase');
const User = require('../models/User');
const { sendNewVideoEmail, sendZoomLinkEmail } = require('../services/emailService');

// GET /api/maestro/courses
const getMisCursos = async (req, res) => {
  try {
    const cursos = await Course.find({ maestroId: req.user._id }).sort({ createdAt: -1 });
    res.json(cursos);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/maestro/courses/:id/alumnos
const getAlumnosCurso = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' });
    }

    if (course.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para ver este curso' });
    }

    const inscripciones = await Enrollment.find({ cursoId: req.params.id })
      .populate('alumnoId', 'nombre email')
      .sort({ fechaInscripcion: -1 });

    res.json(inscripciones);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/maestro/courses/:id/clases
const getClasesCurso = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' });
    }

    if (course.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para ver este curso' });
    }

    const clases = await Clase.find({ cursoId: req.params.id })
      .populate('videoId')
      .sort({ numeroClase: 1 });
    res.json(clases);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// PUT /api/maestro/clases/:claseId
const actualizarClase = async (req, res) => {
  try {
    const { zoomLink, videoUrl, pdfUrl, pdfUrl2 } = req.body;

    const clase = await Clase.findById(req.params.claseId);
    if (!clase) {
      return res.status(404).json({ message: 'Clase no encontrada' });
    }

    const course = await Course.findById(clase.cursoId);
    if (!course || course.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para modificar esta clase' });
    }

    const oldVideoUrl = clase.videoUrl;
    const oldZoomLink = clase.zoomLink;

    if (zoomLink !== undefined) clase.zoomLink = zoomLink;
    if (videoUrl !== undefined) clase.videoUrl = videoUrl;
    if (pdfUrl !== undefined) clase.pdfUrl = pdfUrl;
    if (pdfUrl2 !== undefined) clase.pdfUrl2 = pdfUrl2;

    await clase.save();

    // Notificar alumnos si se agregó/actualizó video o zoom
    const videoChanged = videoUrl && videoUrl !== oldVideoUrl;
    const zoomChanged = zoomLink && zoomLink !== oldZoomLink;

    if (videoChanged || zoomChanged) {
      // Buscar alumnos inscritos en el curso
      const inscripciones = await Enrollment.find({ cursoId: course._id }).select('alumnoId');
      const alumnoIds = inscripciones.map((e) => e.alumnoId);
      const alumnos = await User.find({ _id: { $in: alumnoIds } }).select('nombre email');

      if (alumnos.length > 0) {
        if (videoChanged) {
          sendNewVideoEmail(alumnos, course, clase).catch((err) =>
            console.error('Error enviando video email:', err)
          );
        }
        if (zoomChanged) {
          sendZoomLinkEmail(alumnos, course, clase).catch((err) =>
            console.error('Error enviando zoom email:', err)
          );
        }
      }
    }

    res.json(clase);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = {
  getMisCursos,
  getAlumnosCurso,
  getClasesCurso,
  actualizarClase,
};
