const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    claseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clase',
      required: [true, 'La clase es obligatoria'],
      unique: true,
    },
    cursoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'El curso es obligatorio'],
    },
    maestroId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El maestro es obligatorio'],
    },
    titulo: {
      type: String,
      default: '',
    },
    bunnyVideoId: {
      type: String,
      required: [true, 'El ID de Bunny es obligatorio'],
    },
    bunnyLibraryId: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      default: '',
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },
    embedUrl: {
      type: String,
      default: '',
    },
    duracion: {
      type: Number,
      default: 0,
    },
    resolucion: {
      type: String,
      default: '',
    },
    tamanio: {
      type: Number,
      default: 0,
    },
    estado: {
      type: String,
      enum: ['subiendo', 'procesando', 'listo', 'error'],
      default: 'subiendo',
    },
    progresoSubida: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    vistas: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

videoSchema.index({ cursoId: 1 });
videoSchema.index({ bunnyVideoId: 1 });

module.exports = mongoose.model('Video', videoSchema);
