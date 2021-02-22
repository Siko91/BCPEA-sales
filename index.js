const axios = require("axios");
const fs = require("fs");

const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");

const Xray = require("x-ray");
const x = Xray();
const SOURCE = "https://sales.bcpea.org/properties?perpage=14000&p=1";

// Main Code
(async () => {
  await storePage();
  const html = readPage();
  let data = await parse(html);
  data = formatData(data);
  storeCSV(data);
  // await storeSQLite(data);
})();

async function storePage() {
  const res = await axios.get(SOURCE, {
    headers: {
      Host: "sales.bcpea.org",
      "User-Agent":
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:85.0) Gecko/20100101 Firefox/85.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      //   "Accept-Encoding": "gzip, deflate, br",
      DNT: 1,
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": 1,
      "Sec-GPC": 1,
      // "Cookie": "__cfduid=d2023d8a1719b642f192944b7acbb15881613851439",
    },
  });
  fs.writeFileSync("./sales.bcpea.org.html", res.data);
  console.log("Downloaded HTML File!");
}

function readPage() {
  return fs.readFileSync("./sales.bcpea.org.html");
}

async function parse(htmlContents) {
  return new Promise((resolve, reject) => {
    x(htmlContents, ".item__group", [
      {
        publishDate: ".header .date",
        category: ".header .title",
        size: ".header .category",
        price: ".content--price .price",
        region: ".label__group:nth-child(1) .info",
        court: ".col:nth-child(3) .label__group:nth-child(1) .info",
        bailiff: ".col:nth-child(3) .label__group:nth-child(2) .info",
        period: ".col:nth-child(3) .label__group:nth-child(3) .info",
        ends: ".col:nth-child(3) .label__group:nth-child(4) .info",
        href: ".col--image a@href",
        address: ".label__group:nth-child(2) .info",
      },
    ])((err, data) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Parsed ${data.length} records`);
        resolve(data);
      }
    });
  });
}

function formatData(arrayOfObj) {
  return arrayOfObj.map((obj) => {
    const result = {
      id: takeAfter(obj.href, "properties/"),
      ...obj,
      publishDate: takeAfter(obj.publishDate, "Публикувано на "),
      size: noSpace(takeBefore(obj.size, " кв.м")),
      price: noSpace(takeBefore(obj.price, " лв")),
      href: "https://sales.bcpea.org" + obj.href,
    };
    result.pricePerMeter =
      parseFloat(result.price) / parseFloat(result.size) + "";
    result.region = "България " + result.region;
    result.court = "България гр. " + result.court;
    result.address = result.address.replace(/"/g, "'").replace(/,/g, "");
    return result;
  });
}

function takeAfter(str, afterString) {
  str = str.trim();
  const i = str.indexOf(afterString);
  return str.substr(i + afterString.length);
}

function takeBefore(str, beforeString) {
  str = str.trim();
  const i = str.indexOf(beforeString);
  return str.substr(0, i);
}

function noSpace(str) {
  return str.replace(/ /g, "");
}

async function storeSQLite(arrayOfObj) {
  if (fs.existsSync("./parsedSales.db")) fs.unlinkSync("./parsedSales.db");

  const db = await sqlite.open({
    filename: "./parsedSales.db",
    driver: sqlite3.Database,
  });

  const keys = Object.keys(arrayOfObj[0]);
  const createCommand = `CREATE TABLE sales(${keys
    .map((i) => `"${i}" TEXT`)
    .join(", ")});`;
  await db.exec(createCommand);

  for (let i = 0; i < arrayOfObj.length; i++) {
    const command = `INSERT INTO sales (${keys.join(",")}) VALUES (${keys
      .map((k) => `"${arrayOfObj[i][k]}"`)
      .join(",")})`;
    await db.run(command);
    if (i % 500 === 0) console.log(`Saved ${i} records in DB`);
  }
  console.log("Stored in DB");
}

function storeCSV(arrayOfObj) {
  const keys = Object.keys(arrayOfObj[0]);
  fs.writeFileSync(
    "parsedSales.csv",
    keys.map((i) => `"${i}"`).join(",") +
      "\n" +
      arrayOfObj.map((l) => keys.map((k) => `"${l[k]}"`).join(",")).join("\n")
  );
  console.log("Saved CSV");
}
