const { validationResult } = require('express-validator');
const Course = require('../models/Course');
const Clase = require('../models/Clase');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Video = require('../models/Video');
const VideoView = require('../models/VideoView');
const bunnyService = require('../services/bunnyService');

// GET /api/courses
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find({ activo: true }).populate(
      'maestroId',
      'nombre email'
    );
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cursos', error: error.message });
  }
};

// GET /api/courses/:id
const getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate(
      'maestroId',
      'nombre email'
    );
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' });
    }
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener curso', error: error.message });
  }
};

// POST /api/courses
const createCourse = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { titulo, descripcion, maestroId, maxAlumnos, inscripcionesAbiertas, fechaInicio, fechaFin, precio, moneda, esGratuito, whatsappLink, numeroClases, horario, imagenUrl } = req.body;

    const assignedMaestroId = req.user.rol === 'admin' ? maestroId : req.user._id;
    const totalClases = Math.max(1, Math.floor(numeroClases || 24));

    const course = await Course.create({
      titulo,
      descripcion,
      maestroId: assignedMaestroId,
      maxAlumnos: maxAlumnos || 30,
      inscripcionesAbiertas: inscripcionesAbiertas !== undefined ? inscripcionesAbiertas : true,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      precio: precio || 0,
      moneda: moneda || 'ILS',
      esGratuito: esGratuito || false,
      horario: horario || { es: '', en: '', he: '' },
      whatsappLink: whatsappLink || '',
      imagenUrl: imagenUrl || '',
      numeroClases: totalClases,
    });

    // Auto-crear clases
    const clases = [];
    for (let i = 1; i <= totalClases; i++) {
      clases.push({
        cursoId: course._id,
        numeroClase: i,
        titulo: { es: `Lección ${i}`, en: `Lesson ${i}`, he: `שיעור ${i}` },
      });
    }
    await Clase.insertMany(clases);

    const populated = await Course.findById(course._id).populate('maestroId', 'nombre email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear curso', error: error.message });
  }
};

// PUT /api/courses/:id
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' });
    }

    if (
      course.maestroId.toString() !== req.user._id.toString() &&
      req.user.rol !== 'admin'
    ) {
      return res.status(403).json({ message: 'No autorizado para editar este curso' });
    }

    const updateData = { ...req.body };
    if (updateData.fechaInicio === '' || updateData.fechaInicio === undefined) updateData.fechaInicio = null;
    if (updateData.fechaFin === '' || updateData.fechaFin === undefined) updateData.fechaFin = null;

    const updated = await Course.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('maestroId', 'nombre email');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar curso', error: error.message });
  }
};

// DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Curso no encontrado' });
    }

    if (
      course.maestroId.toString() !== req.user._id.toString() &&
      req.user.rol !== 'admin'
    ) {
      return res.status(403).json({ message: 'No autorizado para eliminar este curso' });
    }

    // Delete videos from Bunny and DB, plus their views
    const videos = await Video.find({ cursoId: req.params.id });
    const videoIds = videos.map((v) => v._id);
    for (const video of videos) {
      try {
        await bunnyService.deleteVideo(video.bunnyVideoId);
      } catch (err) {
        // Continue even if Bunny delete fails
      }
    }
    if (videoIds.length > 0) {
      await VideoView.deleteMany({ videoId: { $in: videoIds } });
    }
    await Video.deleteMany({ cursoId: req.params.id });

    await Clase.deleteMany({ cursoId: req.params.id });
    await Enrollment.deleteMany({ cursoId: req.params.id });
    await Payment.deleteMany({ cursoId: req.params.id });
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Curso eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar curso', error: error.message });
  }
};

module.exports = { getCourses, getCourse, createCourse, updateCourse, deleteCourse };
