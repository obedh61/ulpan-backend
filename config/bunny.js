const axios = require('axios');

const bunnyApi = axios.create({
  baseURL: 'https://video.bunnycdn.com',
  headers: {
    AccessKey: process.env.BUNNY_API_KEY,
    'Content-Type': 'application/json',
  },
});

module.exports = { bunnyApi };
