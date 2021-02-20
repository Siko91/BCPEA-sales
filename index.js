const axios = require('axios');
const fs = require('fs');
const Xray = require('x-ray')
const x = Xray()

const source = "https://sales.bcpea.org/properties?perpage=10000&p=1";

parse(readPage()).then(storeCSV)

async function storePage() {
    const res = await axios.get(source);
    fs.writeFileSync("./sales.bcpea.org.html", res.data)
    console.log("Saved!")
}

function readPage() {
    return fs.readFileSync("./sales.bcpea.org.html");
}

async function parse(htmlContents) {
    return new Promise((resolve, reject) => {
        x(htmlContents, ".item__group", [{
            publishDate: ".header .date",
            category: ".header .title",
            size: ".header .category",
            price: ".content--price .price",
            region: ".label__group:nth-child(1) .info",
            address: ".label__group:nth-child(2) .info",
            court: ".label__group:nth-child(3) .info",
            bailiff: ".label__group:nth-child(4) .info",
            period: ".label__group:nth-child(5) .info",
            announcedOn: ".label__group:nth-child(6) .info",
            href: ".col--image a@href",
        }])((err, data) => {
            if(err) reject(err);
            else resolve(data);
        })
    })
}

function storeCSV(arrayOfObj) {
    const keys = Object.keys(arrayOfObj[0]);
    fs.writeFileSync("parsedSales.csv",
        keys.map(i =>`"${i}"`).join(",") + "\n" +
        arrayOfObj.map(l => keys.map(k => `"${l[k]}"`).join(",") + "\n"));
}