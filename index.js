const axios = require("axios");
const fs = require("fs");
const path = require("path");

const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");

const { updateGoogleSheet } = require("./updateGoogleSheet");

const Xray = require("x-ray");
const x = Xray();
const SOURCE =
  "https://sales.bcpea.org/properties?perpage=15000&order=end_date_low&order=end_date_high";

const LOG_PATH = path.join(__dirname, "logfile.txt");
const _log = console.log;
console.log = (str) => {
  _log(str);
  fs.appendFileSync(LOG_PATH, `${new Date()} : ${str}\n`);
};

const HTML_PATH = path.join(__dirname, "sales.bcpea.org.html");
const DB_PATH = path.join(__dirname, "parsedSales.db");
const CSV_PATH = path.join(__dirname, "parsedSales.csv");

// Main Code
(async () => {
  await storePage();
  const html = readPage();
  let data = await parse(html);
  data = formatData(data);
  storeCSV(data);
  // await storeSQLite(data);
  await storeGoogleSheet(data);
})();

async function storePage() {
  const res = await axios.get(SOURCE);
  fs.writeFileSync("./sales.bcpea.org.html", res.data);
  console.log("Downloaded HTML File!");
}

function readPage() {
  return fs.readFileSync(HTML_PATH);
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
    result.region = result.region;
    result.court = "гр. " + result.court;
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
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const db = await sqlite.open({
    filename: DB_PATH,
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
    CSV_PATH,
    keys.map((i) => `"${i}"`).join(",") +
      "\n" +
      arrayOfObj.map((l) => keys.map((k) => `"${l[k]}"`).join(",")).join("\n")
  );
  console.log("Saved CSV");
}

async function storeGoogleSheet(arrayOfObj) {
  const keys = Object.keys(arrayOfObj[0]);
  const emptyLine = keys.map((i) => undefined);

  const data = [
    keys,
    ...arrayOfObj.map((d) => [...keys.map((k) => d[k])]),
    ...Array(15000 - arrayOfObj.length - 1).fill(emptyLine),
  ];

  await updateGoogleSheet({
    data: data,
    sheetId: "1HfVZqwiHquRI5nP1BlEkURckxOKzqZMX7vfD7ou3Byk",
    sheetRange: "Sheet1!A1:Z15000",
  });

  console.log("Saved on Google Sheets");
}
