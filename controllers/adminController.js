const { validationResult } = require('express-validator');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Clase = require('../models/Clase');
const Payment = require('../models/Payment');
const { generateIncomesReport, generatePaymentsCsv } = require('../services/pdfService');

// GET /api/admin/estadisticas
const getEstadisticas = async (req, res) => {
  try {
    const [totalUsuarios, totalCursos, totalInscripciones, totalClases, admins, maestros, alumnos, totalPagos, ingresosAgg] =
      await Promise.all([
        User.countDocuments(),
        Course.countDocuments(),
        Enrollment.countDocuments(),
        Clase.countDocuments(),
        User.countDocuments({ rol: 'admin' }),
        User.countDocuments({ rol: 'maestro' }),
        User.countDocuments({ rol: 'alumno' }),
        Payment.countDocuments({ estado: 'completado' }),
        Payment.aggregate([
          { $match: { estado: 'completado' } },
          { $group: { _id: null, total: { $sum: '$monto' } } },
        ]),
      ]);

    const totalIngresos = ingresosAgg.length > 0 ? ingresosAgg[0].total : 0;

    // Ultimas 5 ventas
    const ventasRecientes = await Payment.find({ estado: 'completado' })
      .populate('alumnoId', 'nombre email')
      .populate('cursoId', 'titulo')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalUsuarios,
      totalCursos,
      totalInscripciones,
      totalClases,
      totalPagos,
      totalIngresos,
      usuariosPorRol: { admins, maestros, alumnos },
      ventasRecientes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/admin/usuarios
const getUsuarios = async (req, res) => {
  try {
    const usuarios = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// POST /api/admin/usuarios
const crearUsuario = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { nombre, email, password, rol } = req.body;

    const existeUsuario = await User.findOne({ email });
    if (existeUsuario) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const user = await User.create({ nombre, email, password, rol });

    res.status(201).json({
      _id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// PUT /api/admin/usuarios/:id
const actualizarUsuario = async (req, res) => {
  try {
    const { nombre, email, rol } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (email && email !== user.email) {
      const existeEmail = await User.findOne({ email });
      if (existeEmail) {
        return res.status(400).json({ message: 'El email ya está registrado' });
      }
    }

    user.nombre = nombre || user.nombre;
    user.email = email || user.email;
    user.rol = rol || user.rol;

    await user.save();

    res.json({
      _id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// DELETE /api/admin/usuarios/:id
const eliminarUsuario = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await Enrollment.deleteMany({ alumnoId: user._id });
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/admin/maestros
const getMaestros = async (req, res) => {
  try {
    const maestros = await User.find({ rol: 'maestro' }).select('nombre email');
    res.json(maestros);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/admin/courses
const getCoursesAdmin = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('maestroId', 'nombre email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/admin/courses/:id/clases
const getClasesCursoAdmin = async (req, res) => {
  try {
    const clases = await Clase.find({ cursoId: req.params.id })
      .populate('videoId')
      .sort({ numeroClase: 1 });
    res.json(clases);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// PUT /api/admin/clases/:claseId
const actualizarClaseAdmin = async (req, res) => {
  try {
    const { fecha, titulo } = req.body;
    const clase = await Clase.findById(req.params.claseId);
    if (!clase) {
      return res.status(404).json({ message: 'Clase no encontrada' });
    }

    if (titulo !== undefined) clase.titulo = titulo;
    if (fecha !== undefined) clase.fecha = fecha;

    await clase.save();
    res.json(clase);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// GET /api/admin/ingresos
const getIngresos = async (req, res) => {
  try {
    // Total por moneda
    const totalPorMoneda = await Payment.aggregate([
      { $match: { estado: 'completado' } },
      { $group: { _id: '$moneda', total: { $sum: '$monto' }, count: { $sum: 1 } } },
    ]);

    // Ingresos por mes (ultimos 12 meses)
    const hace12Meses = new Date();
    hace12Meses.setMonth(hace12Meses.getMonth() - 12);

    const ingresosPorMes = await Payment.aggregate([
      { $match: { estado: 'completado', createdAt: { $gte: hace12Meses } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Ingresos por curso
    const ingresosPorCurso = await Payment.aggregate([
      { $match: { estado: 'completado' } },
      {
        $group: {
          _id: '$cursoId',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'curso',
        },
      },
      { $unwind: '$curso' },
      {
        $project: {
          cursoTitulo: '$curso.titulo',
          total: 1,
          count: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({ totalPorMoneda, ingresosPorMes, ingresosPorCurso });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ingresos', error: error.message });
  }
};

// GET /api/admin/payments
const getPayments = async (req, res) => {
  try {
    const { estado, cursoId } = req.query;
    const filter = {};
    if (estado) filter.estado = estado;
    if (cursoId) filter.cursoId = cursoId;

    const payments = await Payment.find(filter)
      .populate('alumnoId', 'nombre email')
      .populate('cursoId', 'titulo')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener pagos', error: error.message });
  }
};

// GET /api/admin/ingresos/export
const exportIngresos = async (req, res) => {
  try {
    const { format = 'pdf', fechaInicio, fechaFin } = req.query;

    const filter = { estado: 'completado' };
    if (fechaInicio || fechaFin) {
      filter.createdAt = {};
      if (fechaInicio) filter.createdAt.$gte = new Date(fechaInicio);
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = fin;
      }
    }

    const payments = await Payment.find(filter)
      .populate('alumnoId', 'nombre email')
      .populate('cursoId', 'titulo')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csv = generatePaymentsCsv(payments);
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reporte-ingresos.csv"',
      });
      // BOM for Excel UTF-8 compatibility
      return res.send('\uFEFF' + csv);
    }

    // PDF
    const [totalPorMoneda, ingresosPorMes, ingresosPorCurso] = await Promise.all([
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: '$moneda', total: { $sum: '$monto' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            total: { $sum: '$monto' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: '$cursoId', total: { $sum: '$monto' }, count: { $sum: 1 } } },
        { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'curso' } },
        { $unwind: '$curso' },
        { $project: { cursoTitulo: '$curso.titulo', total: 1, count: 1 } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const pdfBuffer = await generateIncomesReport({
      payments,
      totalPorMoneda,
      ingresosPorMes,
      ingresosPorCurso,
      fechaInicio,
      fechaFin,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="reporte-ingresos.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exportando ingresos:', error);
    res.status(500).json({ message: 'Error al exportar ingresos', error: error.message });
  }
};

module.exports = {
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
};
