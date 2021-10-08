// const { verifySignUp } = require("../middleware");
const router = require('express').Router();
const scrapeController = require('../controllers/scrapeController');
const puppetController = require('../controllers/puppetController');
const { crawlAndWrite } = require('../controllers/crawlerController');
const fs = require('fs');

router.get('/scrape', (req, res, next) => {
    scrapeController.scrapeUrl(req, res, next).then((response) => {
        res.status(200).json(response);
    });
})

router.get('/cardekho/targeted', (req, res, next) => {
    scrapeController.scrapeCarDekho_Targeted(req, res, next).then((response) => {
        res.status(200).json(response);
    });
})

router.get('/olxCars/targeted', (req, res, next) => {
    scrapeController.scrapeOlxCars_Targeted(req, res, next).then((response) => {
        res.status(200).json(response);
    });
})

router.get('/crawl/write', (req, res, next) => {
    let obsolete = [];
    let timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, "-");
    let urlObj = new URL(req.body.url);
    let dir = __dirname + '/../scripts/crawler/' + urlObj.hostname
    let filename = dir + '/' + timestamp + '.json'
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    var file = fs.appendFile(filename, '{"urls": []}', function (err) {
        if (err) {
            res.status(500).send(err);
        }
        crawlAndWrite(req, res, next, filename, req.body.url, obsolete);
    });
})

router.get('/crawl/read', (req, res, next) => {
    // let urlObj = new URL(req.body.url);
    // let filename = __dirname + '/../scripts/' + urlObj.hostname + '.json'
    // var file = fs.appendFile(filename, '', function (err){
    //     console.log(err, file);
    // });
    crawlAndWrite(req.body.url, res, next, filename);
})

router.get('/droom/crawler', (req, res, next) => {
    let timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, "-");
    let dir = __dirname + '/../scripts/response/droom'
    let filename = dir + '/' + timestamp + '.json'
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    var file = fs.appendFile(filename, '{"results": []}', function (err) {
        if (err) {
            res.status(500).send(err);
        }
        scrapeController.scrapeDroomCars_Crawler(req, res, next, filename).then((response) => {
            res.status(200).json(response);
        });
    });
})

router.get('/cardekho/crawler', (req, res, next) => {
    let timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, "-");
    let dir = __dirname + '/../scripts/response/cardekho'
    let filename = dir + '/' + timestamp + '.json'
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    var file = fs.appendFile(filename, '{"results": []}', function (err) {
        if (err) {
            res.status(500).send(err);
        }
        scrapeController.scrapeCardekho_Crawler(req, res, next, filename).then((response) => {
            res.status(200).json(response);
        });
    });
})

router.get('/spinny/crawler', (req, res, next) => {
    let timestamp = new Date().toISOString().substring(0, 19).replace(/:/g, "-");
    let dir = __dirname + '/../scripts/response/spinny'
    let filename = dir + '/' + timestamp + '.json'
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    var file = fs.appendFile(filename, '{"results": []}', function (err) {
        if (err) {
            res.status(500).send(err);
        }
        scrapeController.scrapeSpinny_Crawler(req, res, next, filename).then((response) => {
            res.status(200).json(response);
        });
    });
})

module.exports = router