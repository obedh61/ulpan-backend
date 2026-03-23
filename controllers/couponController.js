const { validationResult } = require('express-validator');
const Coupon = require('../models/Coupon');

// POST /api/coupons
const crearCupon = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { codigo, tipo, descuento, cursosAplicables, usoMaximo, fechaInicio, fechaExpiracion, activo } = req.body;

    const existeCupon = await Coupon.findOne({ codigo: codigo.toUpperCase() });
    if (existeCupon) {
      return res.status(400).json({ message: 'Ya existe un cupon con ese codigo' });
    }

    const cupon = await Coupon.create({
      codigo: codigo.toUpperCase(),
      tipo,
      descuento,
      cursosAplicables: cursosAplicables || [],
      usoMaximo: usoMaximo || null,
      fechaInicio: fechaInicio || null,
      fechaExpiracion: fechaExpiracion || null,
      activo: activo !== undefined ? activo : true,
    });

    res.status(201).json(cupon);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cupon', error: error.message });
  }
};

// GET /api/coupons
const getCupones = async (req, res) => {
  try {
    const cupones = await Coupon.find()
      .populate('cursosAplicables', 'titulo')
      .sort({ createdAt: -1 });
    res.json(cupones);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cupones', error: error.message });
  }
};

// POST /api/coupons/validate
const validarCupon = async (req, res) => {
  try {
    const { codigo, cursoId } = req.body;

    if (!codigo) {
      return res.status(400).json({ message: 'El codigo del cupon es obligatorio' });
    }

    const cupon = await Coupon.findOne({ codigo: codigo.toUpperCase(), activo: true });

    if (!cupon) {
      return res.status(404).json({ message: 'Cupon no encontrado o inactivo' });
    }

    const now = new Date();
    if (cupon.fechaInicio && now < cupon.fechaInicio) {
      return res.status(400).json({ message: 'El cupon aun no esta activo' });
    }
    if (cupon.fechaExpiracion && now > cupon.fechaExpiracion) {
      return res.status(400).json({ message: 'El cupon ha expirado' });
    }
    if (cupon.usoMaximo !== null && cupon.usosActuales >= cupon.usoMaximo) {
      return res.status(400).json({ message: 'El cupon ha alcanzado su limite de uso' });
    }
    if (cursoId && cupon.cursosAplicables.length > 0 && !cupon.cursosAplicables.some((id) => id.toString() === cursoId)) {
      return res.status(400).json({ message: 'El cupon no aplica para este curso' });
    }

    res.json({
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      descuento: cupon.descuento,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al validar cupon', error: error.message });
  }
};

// PUT /api/coupons/:id/toggle
const toggleCupon = async (req, res) => {
  try {
    const cupon = await Coupon.findById(req.params.id);
    if (!cupon) {
      return res.status(404).json({ message: 'Cupon no encontrado' });
    }

    cupon.activo = !cupon.activo;
    await cupon.save();

    res.json(cupon);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cupon', error: error.message });
  }
};

// DELETE /api/coupons/:id
const eliminarCupon = async (req, res) => {
  try {
    const cupon = await Coupon.findById(req.params.id);
    if (!cupon) {
      return res.status(404).json({ message: 'Cupon no encontrado' });
    }

    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Cupon eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar cupon', error: error.message });
  }
};

// PUT /api/coupons/:id
const actualizarCupon = async (req, res) => {
  try {
    const { codigo, tipo, descuento, cursosAplicables, usoMaximo, fechaInicio, fechaExpiracion, activo } = req.body;

    const cupon = await Coupon.findById(req.params.id);
    if (!cupon) {
      return res.status(404).json({ message: 'Cupon no encontrado' });
    }

    if (codigo && codigo.toUpperCase() !== cupon.codigo) {
      const existeCupon = await Coupon.findOne({ codigo: codigo.toUpperCase() });
      if (existeCupon) {
        return res.status(400).json({ message: 'Ya existe un cupon con ese codigo' });
      }
      cupon.codigo = codigo.toUpperCase();
    }

    if (tipo !== undefined) cupon.tipo = tipo;
    if (descuento !== undefined) cupon.descuento = descuento;
    if (cursosAplicables !== undefined) cupon.cursosAplicables = cursosAplicables;
    if (usoMaximo !== undefined) cupon.usoMaximo = usoMaximo || null;
    if (fechaInicio !== undefined) cupon.fechaInicio = fechaInicio || null;
    if (fechaExpiracion !== undefined) cupon.fechaExpiracion = fechaExpiracion || null;
    if (activo !== undefined) cupon.activo = activo;

    await cupon.save();
    res.json(cupon);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cupon', error: error.message });
  }
};

module.exports = { crearCupon, getCupones, validarCupon, toggleCupon, eliminarCupon, actualizarCupon };
