const axios = require('axios');
const fs = require('fs');
const Xray = require('x-ray')
const x = Xray()

const source = "https://sales.bcpea.org/properties?perpage=10000&p=1";

parse(readPage()).then((data) => storeCSV(formatData(data)))

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
            // address: ".label__group:nth-child(2) .info",
            court: "col:nth-child(3) .label__group:nth-child(1) .info",
            bailiff: "col:nth-child(3) .label__group:nth-child(2) .info",
            period: "col:nth-child(3) .label__group:nth-child(3) .info",
            ends: "col:nth-child(3) .label__group:nth-child(4) .info",
            href: ".col--image a@href",
        }])((err, data) => {
            if(err) reject(err);
            else resolve(data);
        })
    })
}

function formatData(arrayOfObj) {
    return arrayOfObj.map(obj => {
        return {
            ...obj,
            publishDate: takeAfter(obj.publishDate, "Публикувано на "),
            size: takeBefore( obj.size, " кв.м" ),
            price: takeBefore( obj.price, " лв" ),
        };
    })
}

function takeAfter(str, afterString, incl = false) {
    str = str.trim();
    const i = str.indexOf(afterString);
    return str.substr(i + (incl? 0 : afterString.length));
}

function takeBefore(str, beforeString, incl = false) {
    str = str.trim();
    const i = str.indexOf(beforeString);
    return str.substr(0, i + (incl? 0 : beforeString.length));
}

function storeCSV(arrayOfObj) {
    const keys = Object.keys(arrayOfObj[0]);
    fs.writeFileSync("parsedSales.csv",
        keys.map(i =>`"${i}"`).join(",") + "\n" +
        arrayOfObj.map(l => keys.map(k => `"${l[k].replace(/"/g, "'")}"`).join(",")).join("\n"));
}