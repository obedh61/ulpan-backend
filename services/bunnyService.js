const { bunnyApi } = require('../config/bunny');

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME;

const createVideo = async (titulo) => {
  const res = await bunnyApi.post(`/library/${LIBRARY_ID}/videos`, {
    title: titulo,
  });
  return res.data;
};

const getVideoInfo = async (videoId) => {
  const res = await bunnyApi.get(`/library/${LIBRARY_ID}/videos/${videoId}`);
  return res.data;
};

const deleteVideo = async (videoId) => {
  await bunnyApi.delete(`/library/${LIBRARY_ID}/videos/${videoId}`);
};

const getTusUploadUrl = (videoId) => {
  return `https://video.bunnycdn.com/tusupload`;
};

const getTusAuthHeaders = (videoId) => {
  return {
    AuthorizationSignature: '', // Generated per-upload by controller
    AuthorizationExpire: '',
    VideoId: videoId,
    LibraryId: LIBRARY_ID,
  };
};

const getEmbedUrl = (videoId) => {
  return `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${videoId}`;
};

const getThumbnailUrl = (videoId) => {
  return `https://${CDN_HOSTNAME}/${videoId}/thumbnail.jpg`;
};

const getVideoUrl = (videoId) => {
  return `https://${CDN_HOSTNAME}/${videoId}/playlist.m3u8`;
};

// Map Bunny status codes to our estado enum
// Bunny: 0=Queued, 1=Processing, 2=Encoding, 3=Finished, 4=Resolution Finished, 5=Failed
const mapBunnyStatus = (status) => {
  switch (status) {
    case 0:
    case 1:
    case 2:
      return 'procesando';
    case 3:
    case 4:
      return 'listo';
    case 5:
      return 'error';
    default:
      return 'procesando';
  }
};

module.exports = {
  createVideo,
  getVideoInfo,
  deleteVideo,
  getTusUploadUrl,
  getTusAuthHeaders,
  getEmbedUrl,
  getThumbnailUrl,
  getVideoUrl,
  mapBunnyStatus,
};
