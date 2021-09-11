const cheerio = require('cheerio');
const fetch = require('node-fetch');
const puppetController = require('./puppetController');
const cardekho = require('../scripts/carDhekho.json')

async function handlePuppet(url, request) {
    let puppet = await puppetController.initiatePuppet();
    let page = puppet.page;
    await page.goto(url);
    await page.waitForSelector(request.data[0].query, {
        visible: true,
    });
    if (typeof request.puppet.scroll !== 'undefined') {
        await puppetController.autoScroll(page, request.puppet.scroll.timeout);
        await page.waitFor(5000);
        return { content: await page.content(), page: page, broswer: puppet.broswer }
    }
    else {
        return null
    }

}

async function getSourceCodes(requests) {
    //loop through requests
    const htmlLists = requests.map(async r => {
        //retrieve urls from request objecct
        try {
            //if url is relative, add the base url to the beggining of the url
            if (r.url[0] === '/') {
                r.url = requests.baseUrl + r.url;
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
    });
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

async function modifyDataInquiry($, requests, index) {
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

async function retrieveData(requests) {
    let htmlList = await getSourceCodes(requests);
    return Promise.all(htmlList.map(async (html, i, arr) => {
        let url = requests[i].url;
        const $ = cheerio.load(html);
        let dataset = await modifyDataInquiry($, requests, i)
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

async function scrapeUrl(req, res, next) {
    let response = await retrieveData(req.body.requests)
    return Promise.all(response.map(async (e, i) => {
        if (typeof e.data[0].scrapeResult !== 'undefined') {
            let modResponseData = await Promise.all(e.data.map(async (eachChild, i) => {
                let dataEach = await retrieveData(eachChild.scrapeResult);
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
    }))
}

async function scrapeCarDekho(req, res, next) {
    return new Promise((resolve, reject) => {
        req.body = cardekho;
        scrapeUrl(req, res, next).then(resp => {
            resolve(resp);
        });
    })
}

module.exports = {
    scrapeUrl, retrieveData, modifyDataInquiry, getSourceCodes, scrapeCarDekho
}


