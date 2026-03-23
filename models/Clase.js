const mongoose = require('mongoose');
const translatableField = require('../utils/translatableField');

const claseSchema = new mongoose.Schema(
  {
    cursoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'El curso es obligatorio'],
    },
    numeroClase: {
      type: Number,
      required: [true, 'El numero de clase es obligatorio'],
      min: 1,
    },
    titulo: translatableField(false),
    fecha: {
      type: Date,
      default: null,
    },
    zoomLink: {
      type: String,
      default: '',
    },
    videoUrl: {
      type: String,
      default: '',
    },
    pdfUrl: {
      type: String,
      default: '',
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      default: null,
    },
  },
  { timestamps: true }
);

claseSchema.index({ cursoId: 1, numeroClase: 1 }, { unique: true });

module.exports = mongoose.model('Clase', claseSchema);
