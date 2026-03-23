const mongoose = require('mongoose');
const translatableField = require('../utils/translatableField');

const courseSchema = new mongoose.Schema(
  {
    titulo: translatableField(true),
    descripcion: translatableField(true),
    maestroId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El maestro es obligatorio'],
    },
    maxAlumnos: {
      type: Number,
      default: 30,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    inscripcionesAbiertas: {
      type: Boolean,
      default: true,
    },
    fechaInicio: {
      type: Date,
      default: null,
    },
    fechaFin: {
      type: Date,
      default: null,
    },
    precio: {
      type: Number,
      default: 0,
      min: 0,
    },
    moneda: {
      type: String,
      enum: ['ILS', 'USD', 'EUR'],
      default: 'ILS',
    },
    esGratuito: {
      type: Boolean,
      default: false,
    },
    horario: translatableField(false),
    whatsappLink: {
      type: String,
      trim: true,
      default: '',
    },
    numeroClases: {
      type: Number,
      default: 24,
      min: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
