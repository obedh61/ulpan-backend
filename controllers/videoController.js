const crypto = require('crypto');
const Video = require('../models/Video');
const VideoView = require('../models/VideoView');
const Clase = require('../models/Clase');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const bunnyService = require('../services/bunnyService');

// POST /api/maestro/videos/create-upload
const crearSubida = async (req, res) => {
  try {
    const { claseId } = req.body;
    if (!claseId) {
      return res.status(400).json({ message: 'claseId es obligatorio' });
    }

    const clase = await Clase.findById(claseId);
    if (!clase) {
      return res.status(404).json({ message: 'Clase no encontrada' });
    }

    // Verify maestro owns the course
    const curso = await Course.findById(clase.cursoId);
    if (!curso || curso.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado para este curso' });
    }

    // Check if clase already has a video
    if (clase.videoId) {
      return res.status(400).json({ message: 'Esta clase ya tiene un video. Elimina el video actual primero.' });
    }

    const titulo = clase.titulo?.es || clase.titulo || `Clase ${clase.numeroClase}`;

    // Create video in Bunny
    const bunnyVideo = await bunnyService.createVideo(titulo);

    // Create Video document
    const video = await Video.create({
      claseId: clase._id,
      cursoId: clase.cursoId,
      maestroId: req.user._id,
      titulo,
      bunnyVideoId: bunnyVideo.guid,
      bunnyLibraryId: process.env.BUNNY_LIBRARY_ID,
      estado: 'subiendo',
    });

    // Link video to clase
    clase.videoId = video._id;
    await clase.save();

    // Generate TUS auth signature
    const libraryId = process.env.BUNNY_LIBRARY_ID;
    const apiKey = process.env.BUNNY_API_KEY;
    const expireTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const signatureString = `${libraryId}${apiKey}${expireTime}${bunnyVideo.guid}`;
    const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

    res.status(201).json({
      video,
      tusEndpoint: bunnyService.getTusUploadUrl(),
      authHeaders: {
        AuthorizationSignature: signature,
        AuthorizationExpire: expireTime,
        VideoId: bunnyVideo.guid,
        LibraryId: libraryId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear subida', error: error.message });
  }
};

// GET /api/maestro/videos/:id/status
const obtenerEstado = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video no encontrado' });
    }

    if (video.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // If not finished yet, poll Bunny for status
    if (video.estado !== 'listo' && video.estado !== 'error') {
      const bunnyInfo = await bunnyService.getVideoInfo(video.bunnyVideoId);
      const nuevoEstado = bunnyService.mapBunnyStatus(bunnyInfo.status);

      video.estado = nuevoEstado;

      if (nuevoEstado === 'listo') {
        video.embedUrl = bunnyService.getEmbedUrl(video.bunnyVideoId);
        video.thumbnailUrl = bunnyService.getThumbnailUrl(video.bunnyVideoId);
        video.videoUrl = bunnyService.getVideoUrl(video.bunnyVideoId);
        video.duracion = bunnyInfo.length || 0;
        video.resolucion = bunnyInfo.height ? `${bunnyInfo.width}x${bunnyInfo.height}` : '';
        video.tamanio = bunnyInfo.storageSize || 0;
      }

      await video.save();
    }

    res.json(video);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estado', error: error.message });
  }
};

// DELETE /api/maestro/videos/:id
const eliminarVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video no encontrado' });
    }

    if (video.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Delete from Bunny
    try {
      await bunnyService.deleteVideo(video.bunnyVideoId);
    } catch (err) {
      // Continue even if Bunny delete fails (video may already be deleted)
    }

    // Remove reference from Clase
    await Clase.findByIdAndUpdate(video.claseId, { videoId: null });

    // Delete views and Video document
    await VideoView.deleteMany({ videoId: video._id });
    await Video.findByIdAndDelete(video._id);

    res.json({ message: 'Video eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar video', error: error.message });
  }
};

// GET /api/alumno/videos/:id/stream
const obtenerStream = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video no encontrado' });
    }

    // Verify student is enrolled in the course
    const inscripcion = await Enrollment.findOne({
      alumnoId: req.user._id,
      cursoId: video.cursoId,
    });

    if (!inscripcion) {
      return res.status(403).json({ message: 'No estás inscrito en este curso' });
    }

    // Increment views
    video.vistas += 1;
    await video.save();

    res.json({
      embedUrl: video.embedUrl,
      thumbnailUrl: video.thumbnailUrl,
      duracion: video.duracion,
      titulo: video.titulo,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener stream', error: error.message });
  }
};

// POST /api/alumno/videos/:id/track
const registrarProgreso = async (req, res) => {
  try {
    const { currentTime, duration, completed } = req.body;

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video no encontrado' });
    }

    // Verify enrollment
    const inscripcion = await Enrollment.findOne({
      alumnoId: req.user._id,
      cursoId: video.cursoId,
    });

    if (!inscripcion) {
      return res.status(403).json({ message: 'No estás inscrito en este curso' });
    }

    const duracionVista = Math.round(currentTime || 0);
    const porcentajeVisto = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const esCompletado = completed || porcentajeVisto >= 90;

    const view = await VideoView.findOneAndUpdate(
      { videoId: video._id, alumnoId: req.user._id },
      {
        $max: { duracionVista, porcentajeVisto },
        $set: {
          completado: esCompletado,
          fechaVista: new Date(),
        },
        $setOnInsert: {
          videoId: video._id,
          alumnoId: req.user._id,
        },
      },
      { upsert: true, new: true }
    );

    res.json(view);
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar progreso', error: error.message });
  }
};

// GET /api/maestro/videos/stats/:cursoId
const obtenerEstadisticasCurso = async (req, res) => {
  try {
    const curso = await Course.findById(req.params.cursoId);
    if (!curso || curso.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const videos = await Video.find({ cursoId: req.params.cursoId, estado: 'listo' })
      .populate('claseId', 'numeroClase titulo')
      .lean();

    if (videos.length === 0) {
      return res.json({
        videos: [],
        resumen: {
          totalVideos: 0,
          totalVistas: 0,
          promedioCompletitud: 0,
          tiempoTotalVisto: 0,
        },
      });
    }

    const videoIds = videos.map((v) => v._id);

    // Aggregate view stats per video
    const viewStats = await VideoView.aggregate([
      { $match: { videoId: { $in: videoIds } } },
      {
        $group: {
          _id: '$videoId',
          totalVistas: { $sum: 1 },
          promedioCompletitud: { $avg: '$porcentajeVisto' },
          completados: { $sum: { $cond: ['$completado', 1, 0] } },
          noCompletados: { $sum: { $cond: ['$completado', 0, 1] } },
          tiempoTotal: { $sum: '$duracionVista' },
        },
      },
    ]);

    const statsMap = {};
    viewStats.forEach((s) => {
      statsMap[s._id.toString()] = s;
    });

    const videosConStats = videos.map((v) => {
      const stats = statsMap[v._id.toString()] || {
        totalVistas: 0,
        promedioCompletitud: 0,
        completados: 0,
        noCompletados: 0,
        tiempoTotal: 0,
      };
      return {
        _id: v._id,
        titulo: v.titulo,
        claseNumero: v.claseId?.numeroClase,
        claseTitulo: v.claseId?.titulo,
        duracion: v.duracion,
        vistas: stats.totalVistas,
        promedioCompletitud: Math.round(stats.promedioCompletitud || 0),
        completados: stats.completados,
        noCompletados: stats.noCompletados,
        tiempoTotal: stats.tiempoTotal,
      };
    });

    // Sort by views descending
    videosConStats.sort((a, b) => b.vistas - a.vistas);

    // Global summary
    const totalVistas = videosConStats.reduce((sum, v) => sum + v.vistas, 0);
    const promedioCompletitud = videosConStats.length > 0
      ? Math.round(videosConStats.reduce((sum, v) => sum + v.promedioCompletitud, 0) / videosConStats.length)
      : 0;
    const tiempoTotalVisto = videosConStats.reduce((sum, v) => sum + v.tiempoTotal, 0);

    res.json({
      videos: videosConStats,
      resumen: {
        totalVideos: videos.length,
        totalVistas,
        promedioCompletitud,
        tiempoTotalVisto,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
};

// GET /api/maestro/videos/stats/:cursoId/alumnos
const obtenerEstadisticasAlumnos = async (req, res) => {
  try {
    const curso = await Course.findById(req.params.cursoId);
    if (!curso || curso.maestroId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const videos = await Video.find({ cursoId: req.params.cursoId, estado: 'listo' }).lean();
    const videoIds = videos.map((v) => v._id);
    const totalVideos = videos.length;

    if (totalVideos === 0) {
      return res.json([]);
    }

    // Get all enrolled students
    const inscripciones = await Enrollment.find({ cursoId: req.params.cursoId })
      .populate('alumnoId', 'nombre email')
      .lean();

    // Get all views for this course's videos
    const views = await VideoView.find({ videoId: { $in: videoIds } }).lean();

    // Group views by alumno
    const viewsByAlumno = {};
    views.forEach((v) => {
      const key = v.alumnoId.toString();
      if (!viewsByAlumno[key]) viewsByAlumno[key] = [];
      viewsByAlumno[key].push(v);
    });

    const resultado = inscripciones.map((insc) => {
      const alumnoViews = viewsByAlumno[insc.alumnoId._id.toString()] || [];
      const completados = alumnoViews.filter((v) => v.completado).length;
      const tiempoTotal = alumnoViews.reduce((sum, v) => sum + v.duracionVista, 0);
      const promedioCompletitud = alumnoViews.length > 0
        ? Math.round(alumnoViews.reduce((sum, v) => sum + v.porcentajeVisto, 0) / alumnoViews.length)
        : 0;

      return {
        alumno: insc.alumnoId,
        videosVistos: alumnoViews.length,
        videosCompletados: completados,
        totalVideos,
        tiempoTotal,
        promedioCompletitud,
      };
    });

    // Sort by completados descending
    resultado.sort((a, b) => b.videosCompletados - a.videosCompletados);

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas de alumnos', error: error.message });
  }
};

// GET /api/admin/video-stats
const obtenerEstadisticasGlobal = async (req, res) => {
  try {
    const [totalVideos, totalViews, viewsAgg] = await Promise.all([
      Video.countDocuments({ estado: 'listo' }),
      VideoView.countDocuments(),
      VideoView.aggregate([
        {
          $group: {
            _id: null,
            promedioCompletitud: { $avg: '$porcentajeVisto' },
            completados: { $sum: { $cond: ['$completado', 1, 0] } },
            tiempoTotal: { $sum: '$duracionVista' },
          },
        },
      ]),
    ]);

    const stats = viewsAgg[0] || { promedioCompletitud: 0, completados: 0, tiempoTotal: 0 };

    // Most viewed videos
    const masVistos = await VideoView.aggregate([
      {
        $group: {
          _id: '$videoId',
          totalVistas: { $sum: 1 },
          promedioCompletitud: { $avg: '$porcentajeVisto' },
          tiempoTotal: { $sum: '$duracionVista' },
        },
      },
      { $sort: { totalVistas: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: '_id',
          as: 'video',
        },
      },
      { $unwind: '$video' },
      {
        $lookup: {
          from: 'courses',
          localField: 'video.cursoId',
          foreignField: '_id',
          as: 'curso',
        },
      },
      { $unwind: { path: '$curso', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          totalVistas: 1,
          promedioCompletitud: { $round: ['$promedioCompletitud', 0] },
          tiempoTotal: 1,
          videoTitulo: '$video.titulo',
          cursoTitulo: '$curso.titulo',
        },
      },
    ]);

    res.json({
      totalVideos,
      totalVistas: totalViews,
      promedioCompletitud: Math.round(stats.promedioCompletitud || 0),
      totalCompletados: stats.completados,
      tiempoTotalVisto: stats.tiempoTotal,
      masVistos,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas globales', error: error.message });
  }
};

module.exports = {
  crearSubida,
  obtenerEstado,
  eliminarVideo,
  obtenerStream,
  registrarProgreso,
  obtenerEstadisticasCurso,
  obtenerEstadisticasAlumnos,
  obtenerEstadisticasGlobal,
};
