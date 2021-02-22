const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const { rejects } = require("assert");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const TOKEN_PATH = "token.json";

async function csvToGoogleSheet(csvFilePath, gooleSheetOptions = {}) {
  const cred = fs.readFileSync("credentials.json"); // taken from https://developers.google.com/sheets/api/quickstart/nodejs
  const auth = await authorize(JSON.parse(cred));

  const sheets = google.sheets({ version: "v4", auth });

  saveData(
    [
      [1, 2],
      [3, 4],
    ],
    sheets,
    "1HfVZqwiHquRI5nP1BlEkURckxOKzqZMX7vfD7ou3Byk",
    "Sheet1!A1:Z15000"
  );
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  return new Promise((resolve, reject) => {
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client, resolve);
      oAuth2Client.setCredentials(JSON.parse(token));
      resolve(oAuth2Client);
    });
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err)
          return console.error(
            "Error while trying to retrieve access token",
            err
          );
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        resolve(oAuth2Client);
      });
    });
  });
}

/**
 * @param {[ [], [] ]} data // data is an array of arrays // each inner array is a row // each array element (of an inner array) is a column
 * @param {google.sheets()} googleSheetsObj // the googleapis object
 * @param {string} spreadsheetId the ID of the table
 * @param {string} range Like 'Sheet!A1:B2'
 */
function saveData(data, googleSheetsObj, spreadsheetId, range) {
  let resource = {
    values: data,
  };

  googleSheetsObj.spreadsheets.values.update(
    {
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: "RAW",
      resource,
    },
    (err, result) => {
      if (err) throw err;
      console.log(`${result.data.updates.updatedCells} cells appended.`);
    }
  );
}
