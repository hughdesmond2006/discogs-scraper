const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { authenticate } = require("@google-cloud/local-auth");

// playlist ID (grab from landing page of the playlist you want to add to)
const PLAYLIST_ID = "PLkwrrMu_X--vc4HAYm_54EYnS29cSab0D";

const API_KEY = "AIzaSyCNtAVWujb1CVGYg9hv40aYPR0qKweJkt8";
const PATH_TO_SERVICE_ACCOUNT_JSON_FILE =
  "../src/client_secret_168306323191-h3n1fq248vlb2u94gclvmfdse8job6iu.apps.googleusercontent.com.json";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const apiBreak = async (e) => {
  // wait if requests too often..
  if (e && e.response && e.response.status === 429) {
    console.log("<<<<<<< waiting 1 seconds to give api a break >>>>>>>>>");
    await delay(1000);
    return true;
  }

  return false;
};

const start = async () => {
  let youtubeLinks;

  // read file with yt links
  try {
    const file = await fs.readFileSync("data\\youtube-links.txt", {
      encoding: "utf8",
    });

    youtubeLinks = file.split("\r\n");
  } catch (e) {
    console.log(e);
  }

  // const auth = new youtube.auth.GoogleAuth({
  //   keyFilename: PATH_TO_SERVICE_ACCOUNT_JSON_FILE,
  //   scopes: [
  //     "https://www.googleapis.com/auth/youtube",
  //     "https://www.googleapis.com/auth/youtube.force-ssl",
  //   ],
  // });

  const youtube = google.youtube("v3");

  const auth = await authenticate({
    keyfilePath: path.join(__dirname, PATH_TO_SERVICE_ACCOUNT_JSON_FILE),
    scopes: [
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
  });
  google.options({ auth });

  console.log("-- using playlist ID " + PLAYLIST_ID + " --\n");

  for (let i = 0; i < youtubeLinks.length; i++) {
    try {
      const res = await youtube.playlistItems.insert({
        part: ["snippet"],
        resource: {
          snippet: {
            playlistId: PLAYLIST_ID,
            resourceId: {
              kind: "youtube#video",
              videoId: youtubeLinks[i].split('watch?v=')[1],
            },
          },
        },
      });

      console.log("added " + youtubeLinks[i]);

      console.log("<<<<<<< waiting 5 seconds to give api a break >>>>>>>>>");
      await delay(5000);
    } catch (e) {
      console.log(e);
    }
  }
};

start().then();
