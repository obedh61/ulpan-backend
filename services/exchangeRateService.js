const axios = require('axios');

const FRANKFURTER_API = 'https://api.frankfurter.dev/v1/latest';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const CURRENCIES = ['USD', 'ILS', 'EUR'];

let cache = { rates: null, lastFetched: null };

const fetchRates = async () => {
  const requests = CURRENCIES.map((base) => {
    const symbols = CURRENCIES.filter((c) => c !== base).join(',');
    return axios.get(`${FRANKFURTER_API}?base=${base}&symbols=${symbols}`).then((res) => ({
      base,
      rates: res.data.rates,
    }));
  });

  const results = await Promise.all(requests);

  const rates = {};
  for (const { base, rates: r } of results) {
    rates[base] = r;
  }

  return rates;
};

const getRates = async () => {
  const now = Date.now();

  if (cache.rates && cache.lastFetched && now - cache.lastFetched < CACHE_TTL) {
    return { rates: cache.rates, lastUpdated: new Date(cache.lastFetched).toISOString() };
  }

  try {
    const rates = await fetchRates();
    cache = { rates, lastFetched: now };
    return { rates, lastUpdated: new Date(now).toISOString() };
  } catch (err) {
    console.error('Error fetching exchange rates:', err.message);
    if (cache.rates) {
      return { rates: cache.rates, lastUpdated: new Date(cache.lastFetched).toISOString() };
    }
    return null;
  }
};

module.exports = { getRates };
