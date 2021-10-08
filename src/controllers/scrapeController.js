const cheerio = require('cheerio');
const fetch = require('node-fetch');
const puppetController = require('./puppetController');
const cardekho = require('../scripts/targeted/car-listings/carDhekho.json')
const olxCars = require('../scripts/targeted/car-listings/olxCars.json')
const droomUrls = require('../scripts/crawler/www.droom.com.json');
const cardhekhoUrls = require('../scripts/crawler/cardhekho-buy-used-car-details.json');
const spinnyUrls = require('../scripts/crawler/spinny-buy-used-car.json');
const { sleep, chunks } = require('../utils/promiseUtils');
const { response } = require('../server');
const { crawlAndRetrieve } = require('./crawlerController');

async function handlePuppet(url, request) {
    let puppet = await puppetController.initiatePuppet();
    let page = puppet.page;
    await page.goto(url, {
        waitUntil: 'load',
        // Remove the timeout
    });
    // await page.waitForSelector(request.data[0].query, {
    //     visible: true,
    // });
    if (typeof request.puppet.scroll !== 'undefined') {
        await puppetController.autoScroll(page, request.puppet.scroll.timeout);
        await page.waitFor(5000);
    }
    if (typeof request.puppet.scrollClick !== 'undefined') {
        await puppetController.autoClick(page, request.puppet.scrollClick.timeout, request.puppet.scrollClick.element);
        await puppetController.scroll(page);
        await page.waitFor(5000);
    }
    return { content: await page.content(), page: page, broswer: puppet.broswer }
}

let processSourceCode = async (r, i, arr) => {
    //retrieve urls from request objecct
    try {
        //if url is relative, add the base url to the beggining of the url
        if (r.url[0] === '/' && typeof arr !== "undefined") {
            r.url = arr.baseUrl + r.url;
        }
        if (typeof r.puppet !== 'undefined') {
            let resp = await handlePuppet(r.url, r)
            await resp.broswer.close();
            return resp.content;
        }
        else {
            //fetch data and retrieve raw html content on initial load 
            const res = await fetch(r.url);
            const html = await res.text();
            return html;
        }
    }
    catch (err) {
        console.log(err);
    }
}

async function getSourceCodes(requests, variation) {
    let htmlLists;
    if (variation !== 'onebyone') htmlLists = await chunks(requests, processSourceCode, 5);
    else {
        htmlLists = requests.map(async (r, i, arr) => {
            return await processSourceCode(r, i, arr);
        });
    }
    return Promise.all(htmlLists);
}

function handleTypeVal(d, e, $) {
    //based on type of retrieval in the json body, handle various cheerio contexts
    let val;
    if (d.type.includes('html')) {
        val = $(e).html();
    }
    if (d.type.includes('text')) {
        val = $(e).text();
    }
    if (d.type.includes('attr')) {
        val = $(e).attr(d.typeVal);
    }
    if (d.type.includes('data')) {
        val = $(e).data(d.typeVal);
    }
    if (d.type.includes('find')) {
        val = $(e).find(d.typeVal);
    }
    if (d.type.includes('parents')) {
        if (d.typeVal !== null) {
            val = $(e).parents(d.typeVal);
        }
        else {
            val = $(e).parents(d.typeVal);
        }
    }
    if (d.type.includes('children')) {
        if (d.typeVal !== null) {
            val = $(e).children(d.typeVal);
        }
        else {
            val = $(e).children(d.typeVal);
        }
    }
    return val
}

function modifyDataInquiry($, requests, index) {
    //Modify Data Inquiry Object and Convert it to Html Results
    const request = requests[index];
    let modJson = [];
    request.data.map(data => {
        //loop through request data
        let htmlColl;
        //if query and name are defined in the body run this case
        if (typeof data.query !== 'undefined') {
            //get html object based on query
            htmlColl = $(data.query);
            htmlColl.each((i, html) => {
                //loop through html collection list
                let outputJson = new Object();
                //get query value
                outputJson[data.name] = handleTypeVal(data, html, $);
                if (typeof data.scrapeResult !== 'undefined') {
                    //if scrapeResult is defined, it means the returned value is a url, so you can further scrape that result
                    let scrapeResult = [
                        {
                            url: outputJson[data.name],
                            data: data.scrapeResult
                        }
                    ]
                    if (typeof requests[index].baseUrl !== 'undefined') scrapeResult['baseUrl'] = requests[index].baseUrl;
                    modJson[i] = { ...modJson[i], scrapeResult: scrapeResult };
                }
                else {
                    modJson[i] = { ...modJson[i], ...outputJson };
                }
            });
        }
        //if queryval and queryname are defined in the body run this case
        if (typeof data.query_name !== 'undefined' && typeof data.query_val !== 'undefined') {
            htmlCollName = $(data.query_name);
            htmlCollVal = $(data.query_val);
            htmlCollVal.each((i, html) => {
                let outputJson = new Object();
                let collName = $(htmlCollName[i]).text();
                outputJson[collName] = handleTypeVal(data, html, $);
                if (typeof data.scrapeResult !== 'undefined') {
                    let scrapeResult = [
                        {
                            url: outputJson[collName],
                            data: data.scrapeResult
                        }
                    ]
                    if (typeof requests[index].baseUrl !== 'undefined') scrapeResult['baseUrl'] = requests[index].baseUrl;
                    modJson[i] = { ...modJson[i], scrapeResult: scrapeResult };
                }
                else {
                    modJson[i] = { ...modJson[i], ...outputJson };
                }
            });
        }
    })
    return modJson
}

async function retrieveData(requests, variation) {
    let htmlList = await getSourceCodes(requests, variation);
    return Promise.all(htmlList.map(async (html, i, arr) => {
        let url = requests[i].url;
        if (typeof html !== 'string') {
            return {
                url,
                title: null,
                favicon: null,
                // description: $('meta[name=description]').attr('content'),
                description: null,
                image: null,
                author: null,
                // html: html,
                data: null
            }
        }
        const $ = cheerio.load(html);
        let dataset = modifyDataInquiry($, requests, i)
        const getMetatag = (name) =>
            $(`meta[name=${name}]`).attr('content') ||
            $(`meta[name="og:${name}"]`).attr('content') ||
            $(`meta[property="og:${name}"]`).attr('content') ||
            $(`meta[property="fb:${name}"]`).attr('content') ||
            $(`meta[property="ai:${name}"]`).attr('content') ||
            $(`meta[name="twitter:${name}"]`).attr('content');

        return {
            url,
            title: $('title').first().text(),
            favicon: $('link[rel="shortcut icon"]').attr('href'),
            // description: $('meta[name=description]').attr('content'),
            description: getMetatag('description'),
            image: getMetatag('image'),
            author: getMetatag('author'),
            // html: html,
            data: dataset
        };
    }));
}

async function scrapeUrl(req, res, next, variation, filename) {
    let response;
    if (variation === 'crawl') response = await crawlAndRetrieve(req.body.requests, filename);
    else {
        response = await retrieveData(req.body.requests, variation)
    }
    return Promise.all(response.map(async (e, i) => {
        try {
            if (e.data.length !== 0 || e.data.length !== null && typeof e.data[0] !== 'undefined' && Array.isArray(e.data)) {
                if (typeof e.data[0].scrapeResult !== 'undefined') {
                    let modResponseData = await Promise.all(e.data.map(async (eachChild, i) => {
                        let dataEach
                        if (typeof eachChild.scrapeResult !== 'undefined') {
                            dataEach = await retrieveData(eachChild.scrapeResult);
                        }
                        let cleanedUpDataSet = {}
                        dataEach.forEach((e, index) => {
                            for (i = 0; i < e.data.length; i++) {
                                cleanedUpDataSet = { ...cleanedUpDataSet, ...e.data[i] }
                            }
                        });
                        dataEach[0].data = [cleanedUpDataSet];
                        let modE = { ...eachChild, scrapeResult: dataEach };
                        return modE
                    }))
                    e.data = modResponseData;
                    return e;
                }
                else return e
            }
            else return e
        }
        catch (err) {
            console.log(err);
            return e
        }

    }))
}

async function scrapeCarDekho_Targeted(req, res, next) {
    return new Promise((resolve, reject) => {
        req.body = cardekho;
        scrapeUrl(req, res, next).then(resp => {
            resolve(resp);
        });
    })
}

async function scrapeOlxCars_Targeted(req, res, next) {
    return new Promise((resolve, reject) => {
        req.body = olxCars;
        scrapeUrl(req, res, next).then(resp => {
            resolve(resp);
        });
    })
}

async function scrapeDroomCars_Crawler(req, res, next, filename) {
    return new Promise((resolve, reject) => {
        let newRequestBody = { requests: [] };
        let urls = droomUrls.urls;
        urls.map((e, i, arr) => {
            if (e.startsWith('https://droom.in/product')) {
                let obj = {
                    baseUrl: "https://www.droom.in",
                    url: e,
                    data: [
                        {
                            "name": "carName",
                            "query": ".product_sidebar .detailBlock .page-header h1",
                            "type": "html",
                            "typeVal": null
                        },
                        {
                            "name": "carSecondaryDetails",
                            "query": ".product_sidebar .detailBlock .summary span",
                            "type": "text",
                            "typeVal": null
                        },
                        {
                            "name": "carPrice",
                            "query": ".product_sidebar .actions .price .offer>.text-decoration",
                            "type": "html",
                            "typeVal": null
                        },
                        {
                            "name": "financingDetails",
                            "query_name": ".product_content .toolBar .score .title label",
                            "query_val": ".product_content .toolBar .score .title span",
                            "type": "text",
                            "val": true,
                            "typeVal": null
                        }
                    ],
                    puppet: null,
                }
                newRequestBody.requests.push(obj);
            }
        })
        req.body = newRequestBody;
        scrapeUrl(req, res, next, 'crawl', filename).then(resp => {
            resolve(resp);
        });
    })
}

async function scrapeCardekho_Crawler(req, res, next, filename) {
    return new Promise((resolve, reject) => {
        let newRequestBody = { requests: [] };
        let urls = cardhekhoUrls.urls;
        urls.map((e, i, arr) => {
            let obj = {
                baseUrl: "https://www.cardekho.com",
                url: e,
                data: [
                    {
                        "name": "carName",
                        "query": ".BuyUCDetailComp .VDPtopCard .paddingBorder h1",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carModelCategory",
                        "query": ".BuyUCDetailComp .VDPtopCard .paddingBorder .variant-name",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carPrice",
                        "query": ".BuyUCDetailComp .VDPtopCard .priceSection span:nth-child(2)",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carEMI",
                        "query": ".BuyUCDetailComp .VDPtopCard .paddingBorder .emitextF span",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carOverview",
                        "query_name": ".overviewCArd .listIcons .head",
                        "query_val": ".overviewCArd .listIcons .value",
                        "type": "text",
                        "val": true,
                        "typeVal": null
                    }
                ],
                puppet: null,
            }
            newRequestBody.requests.push(obj);
        })
        req.body = newRequestBody;
        scrapeUrl(req, res, next, 'crawl', filename).then(resp => {
            resolve(resp);
        });
    })
}

async function scrapeSpinny_Crawler(req, res, next, filename) {
    return new Promise((resolve, reject) => {
        let newRequestBody = { requests: [] };
        let urls = spinnyUrls.urls;
        urls.map((e, i, arr) => {
            let obj = {
                baseUrl: "https://www.spinny.com",
                data: [
                    {
                        "name": "carName",
                        "query": ".DesktopRightSection__carDetailSection .DesktopRightSection__carName",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carModelCategory",
                        "query": ".DesktopRightSection__carDetailSection .DesktopRightSection__otherDetailSection",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carPrice",
                        "query": ".DesktopRightSection__carDetailSection .DesktopRightSection__priceSection .DesktopRightSection__price",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carEMI",
                        "query": ".DesktopRightSection__carDetailSection .DesktopRightSection__emiBuyback .DesktopRightSection__finance",
                        "type": "text",
                        "typeVal": null
                    },
                    {
                        "name": "carOverview",
                        "query_name": ".DesktopOverview__overviewItemList .DesktopOverview__itemLabel",
                        "query_val": ".DesktopOverview__overviewItemList .DesktopOverview__itemDisplay",
                        "type": "text",
                        "val": true,
                        "typeVal": null
                    },
                    {
                        "name": "carSpecs",
                        "query_name": ".ProductDesktop__featureSpecification .styles__carSpecificationWrapper .styles__listItemDesktop .styles__listKey",
                        "query_val": ".ProductDesktop__featureSpecification .styles__carSpecificationWrapper .styles__listItemDesktop .styles__listValue",
                        "type": "text",
                        "val": true,
                        "typeVal": null
                    }
                ],
                url: e,
                puppet: spinnyUrls.puppet,
            }
            newRequestBody.requests.push(obj);
        })
        req.body = newRequestBody;
        scrapeUrl(req, res, next, 'crawl', filename).then(resp => {
            resolve(resp);
        });
    })
}

module.exports = {
    scrapeUrl,
    retrieveData,
    modifyDataInquiry,
    getSourceCodes,
    scrapeCarDekho_Targeted,
    scrapeOlxCars_Targeted,
    scrapeDroomCars_Crawler,
    scrapeCardekho_Crawler,
    scrapeSpinny_Crawler
}


