const usedCarRouter = require('./usedCars.router');

module.exports.setRoutes = (server) => {
    server.use('/cars/used', usedCarRouter);
}