// metrics.js
const prometheus = require('prom-client');

const httpRequestCounter = new prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
});

module.exports = {
    httpRequestCounter,
};
