const axios = require("axios");
const fs = require("fs");
const md5 = require("md5");
const open = require("open");
const DOMParser = require("xmldom").DOMParser;

const ARTIST_IDS_FILE = "artist-ids.txt";

// in this mode we take the top rated x amount of track per artist and produce track titles instead of URLs (for import to soundid)
const SPECIAL_MODE = true;
const SPECIAL_MAX_TRACKS_PER_RELEASE = 3;
const SPECIAL_MAX_TRACKS_PER_ARTIST = 15;
const SPECIAL_NEWEST_RELEASE_FIRST = true;

// set this to true to take tracks from other artists on compilation releases
const INCLUDE_OTHER_COMPILATION_TRACKS = true;

// filters - set to a filter to null/undefined if you want it to be ignored
const EXACT_YEAR = null;
const EXACT_MONTH = null; // shorthand string EG. 'Mar'
const MIN_YEAR = null;
const MIN_RATING = null;
const MIN_RATE_COUNT = null;

// set this to false to allow releases with undefined release month to pass the filter
const MONTH_FILTER_STRICT_MODE = false;

const authString =
  "&key=fohKBqcUfBoyVJIGqiAz&secret=rxyNgwUPNcEdhjhayugWYUQfaarjKSyh";

const LFM_API_KEY = "838e3ea38d7a832078f9d97d60579147";

const missingReleaseVideos = [];
const youtubeLinks = [];
const trackNames = [];
let failedRating = 0;
let noRating = 0;
let releaseCount = 0;
let addedArtistCount = 0;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const apiBreak = async (e) => {
  // wait if requests too often..
  if (e.response && e.response.status === 429) {
    console.log("<<<<<<< waiting 60 seconds to give api a break >>>>>>>>>");
    await delay(30000);
    console.log(`${SPECIAL_MODE ? trackNames.length : youtubeLinks.length} tracks added so far...`);
    await delay(30000);
    return true;
  }

  return false;
};

const getArtistReleases = async (artistID, i) => {
  if (SPECIAL_MODE) {
    await getArtistReleases_Special(artistID, i);
  } else {
    await getArtistReleases_Normal(artistID, i);
  }
};

const getArtistReleases_Normal = async (artistID, i) => {
  try {
    const res = await axios(
      `https://api.discogs.com/artists/${artistID}/releases?sort=year&sort_order=desc&per_page=1000` +
        authString
    );

    console.log(`\n~~~~~~~~~~~ ${i + 1}. artist ${artistID} ~~~~~~~~~~~~~\n`);

    const all = res.data.releases;

    // loop through each release and get all videos for them
    for (let j = 0; j < all.length; j++) {
      // ignore releases for irrelevant year
      if (
        (EXACT_YEAR && all[j].year !== EXACT_YEAR) ||
        (MIN_YEAR && all[j].year < MIN_YEAR)
      ) {
        break;
      }

      // ignore releases for irrelevant month
      if (EXACT_MONTH) {
        const releaseDate = await getReleaseDate(
          all[j].id,
          all[j].type === "release"
        );

        if (MONTH_FILTER_STRICT_MODE) {
          // if no release date is found it will skip the release in strict mode
          if (
            !releaseDate ||
            !releaseDate.toLowerCase().includes(EXACT_MONTH.toLowerCase())
          ) {
            break;
          }
        } else {
          // if no release date is found in non-strict mode it will add the release anyway
          if (
            releaseDate &&
            !releaseDate.toLowerCase().includes(EXACT_MONTH.toLowerCase())
          ) {
            break;
          }
        }
      }

      console.log(`release "${all[j].title}" ${all[j].year} ${all[j].id}`);

      if (all[j].type === "master") {
        await getVideos(all[j].id, artistID, false);
      } else {
        await getVideos(all[j].id, artistID);
      }
    }
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await getArtistReleases_Normal(artistID, i);
    } else {
      console.log(e);
    }
  }
};

let tracksPerCurrentArtistReached;
let currentArtistTrackCount;

const getArtistReleases_Special = async (artistID, i) => {
  try {
    const res = await axios(
      `https://api.discogs.com/artists/${artistID}/releases?sort=year&sort_order=desc&per_page=1000` +
        authString
    );

    console.log(`\n~~~~~~~~~~~ ${i + 1}. artist ${artistID} ~~~~~~~~~~~~~\n`);

    let all = res.data.releases;

    // if we dont sort by newest release first then we do most wanted first..
    if (!SPECIAL_NEWEST_RELEASE_FIRST) {
      all = all.sort((a, b) => {
        return b.stats.community.in_wantlist - a.stats.community.in_wantlist;
      });
    }

    tracksPerCurrentArtistReached = false;
    currentArtistTrackCount = 0;

    // loop through each release (most wanted first) and get the top track names till the quota of tracks per artist is reached
    for (let j = 0; j < all.length; j++) {
      console.log(`release "${all[j].title}" ${all[j].year} ${all[j].id}`);

      if (all[j].type === "master") {
        await getTopTrackNames(all[j].id, artistID, false);
      } else {
        await getTopTrackNames(all[j].id, artistID);
      }

      if (tracksPerCurrentArtistReached) {
        console.log("moving to next artist...");
        break;
      }
    }
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await getArtistReleases_Special(artistID, i);
    } else {
      console.log(e);
    }
  }
};

const processArtistReleases = async (artistIDs) => {
  // loop through each artist and get all releases for them
  for (let i = 0; i < artistIDs.length; i++) {
    // if its an empty or repeat id dont process it
    if (artistIDs[i] && artistIDs[i].trim() !== "") {
      if (i === 0 || artistIDs[i] !== artistIDs[i - 1]) {
        await getArtistReleases(artistIDs[i], i);
      }
    } else {
      console.log("skipping duplicate artist ID...");
    }
  }
};

const getReleaseDate = async (id, isRelease = true) => {
  try {
    const res = await axios(
      `https://api.discogs.com/${
        isRelease ? "releases" : "masters"
      }/${id}?per_page=1000` + authString
    );

    return res.data.released_formatted;
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await getReleaseDate(id, isRelease);
    } else {
      console.log(e);

      return null;
    }
  }
};

const getVideos = async (id, artistID, isRelease = true) => {
  try {
    const res = await axios(
      `https://api.discogs.com/${
        isRelease ? "releases" : "masters"
      }/${id}?per_page=1000` + authString
    );
    const all = res.data.videos;

    releaseCount++;

    console.log(
      `............... ${
        isRelease ? "release" : "master"
      } ${id} ...............[${res.data.uri}]`
    );

    let addedTrackCount = 0;

    // if (!all) {
    //   // try last fm for videos..
    //   if (await searchTrackLFM(res.data.title)) {
    //     addedTrackCount++;
    //   } else {
    //     throw new Error("NO VIDEOS FOUND FOR THIS RELEASE");
    //   }
    // }

    if (
      (MIN_RATING || MIN_RATE_COUNT) &&
      (!res.data.community ||
        !res.data.community.rating ||
        !res.data.community.rating.average ||
        !res.data.community.rating.count)
    ) {
      noRating++;
      throw new Error("THIS RELEASE IS MISSING RATING DATA");
    }

    if (
      (MIN_RATING && res.data.community.rating.average < MIN_RATING) ||
      (MIN_RATE_COUNT && res.data.community.rating.count < MIN_RATE_COUNT)
    ) {
      failedRating++;
      console.log(
        `RATING: ${res.data.community.rating.average} / 5 | RATE COUNT: ${res.data.community.rating.count}`
      );
      throw new Error("THIS RELEASE IS BELOW THE RATING FILTER");
    }

    let artistName;
    let artistAnv;
    let multiArtist = false;

    if (res.data.artists.length > 1) {
      multiArtist = true;
    }

    const artistObj = res.data.artists.find((x) =>
      x.resource_url.includes(artistID)
    );

    artistName = artistObj.name && artistObj.name.toLowerCase();
    artistName = artistName.trim() === "" ? undefined : artistName;

    artistAnv = artistObj.anv && artistObj.anv.toLowerCase();
    artistAnv = artistAnv.trim() === "" ? undefined : artistAnv;

    // trim duplicate indicators like (2)
    artistName = artistName && artistName.replace(/\s\(\d*\)/, "");
    artistAnv = artistAnv && artistAnv.replace(/\s\(\d*\)/, "");

    for (let j = 0; j < all.length; j++) {
      // if this release belongs to the requested artist then take all the tracks
      // if this release is a compilation of artists, only take the tracks from the requested artist
      // if INCLUDE_OTHER_COMPILATION_TRACKS = true, then also take the tracks from those other artists
      if (
        INCLUDE_OTHER_COMPILATION_TRACKS ||
        !multiArtist ||
        (artistName && all[j].title.toLowerCase().includes(artistName)) ||
        (artistAnv && all[j].title.toLowerCase().includes(artistAnv))
      ) {
        console.log(`video added "${all[j].title}" ${all[j].uri}`);
        youtubeLinks.push(all[j].uri);
        addedTrackCount++;
      }
    }

    if (addedTrackCount > 0) {
      addedArtistCount++;
    }

    console.log("................................");
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await getVideos(id, isRelease);
    } else {
      console.log(e);
      missingReleaseVideos.push(`${isRelease ? "release" : "master"} ${id}`);
    }
  }
};

const getTopTrackNames = async (id, artistID, isRelease = true) => {
  try {
    const res = await axios(
      `https://api.discogs.com/${
        isRelease ? "releases" : "masters"
      }/${id}?per_page=1000` + authString
    );
    const all = res.data.tracklist;

    releaseCount++;

    console.log(
      `............... ${
        isRelease ? "release" : "master"
      } ${id} ...............[${res.data.uri}]`
    );

    let addedTrackCount = 0;
    let multiArtist = false;

    if (res.data.artists.length > 1) {
      multiArtist = true;
    }

    const artistObj = res.data.artists.find((x) =>
      x.resource_url.includes(artistID)
    );

    let artist = artistObj ? artistObj : res.data.artists[0];
    let artistName =
      artist.name.trim() !== ""
        ? artist.name
        : artist.anv.trim() !== ""
        ? artist.anv
        : undefined;

    if (!artistName) {
      throw new Error(
        "Could not find artist name for this release, skipping..."
      );
    }

    // trim duplicate indicators like (2)
    artistName = artistName && artistName.replace(/\s\(\d*\)/, "");

    for (let j = 0; j < all.length; j++) {
      // if this release belongs to the requested artist then take all the tracks
      // if this release is a compilation of artists, only take the tracks from the requested artist
      // if INCLUDE_OTHER_COMPILATION_TRACKS = true, then also take the tracks from those other artists
      if (
        INCLUDE_OTHER_COMPILATION_TRACKS ||
        !multiArtist ||
        (artistName && all[j].title.toLowerCase().includes(artistName))
      ) {
        console.log(`track name added "${artistName} - ${all[j].title}"`);
        trackNames.push(`${artistName} - ${all[j].title}`);
        addedTrackCount++;
        currentArtistTrackCount++;
      }

      if (currentArtistTrackCount >= SPECIAL_MAX_TRACKS_PER_ARTIST) {
        console.log(
          `max tracks per artist reached (${SPECIAL_MAX_TRACKS_PER_ARTIST})...`
        );
        tracksPerCurrentArtistReached = true;
        break;
      }

      if (addedTrackCount >= SPECIAL_MAX_TRACKS_PER_RELEASE) {
        console.log(
          `max tracks per release reached (${SPECIAL_MAX_TRACKS_PER_RELEASE})...`
        );
        break;
      }
    }

    if (addedTrackCount > 0) {
      addedArtistCount++;
    }

    console.log("................................");
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await getTopTrackNames(id, isRelease);
    } else {
      console.log(e);
    }
  }
};

// returns true if found
const searchTrackLFM = async (artist, trackName) => {
  try {
    const res = await axios(
      `http://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=${LFM_API_KEY}&format=json&artist=${artist}&track=${trackName}&autocorrect=1`
    );

    const trackPage = await axios(res.url);

    const url = trackPage.data.match(/data-youtube-url="(.*)"/);

    console.log(`video added "${artist} - ${trackName}" ${url}`);
    youtubeLinks.push();
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};

const start = async () => {
  let artistIDs;

  // read file with discogs artist ids
  try {
    const file = await fs.readFileSync(ARTIST_IDS_FILE, {
      encoding: "utf8",
    });

    artistIDs = file.split("\r\n");
  } catch (e) {
    console.log(e);
  }

  await processArtistReleases(artistIDs);

  // write all suggested tracks to file
  try {
    if (SPECIAL_MODE) {
      await fs.writeFileSync(
        "youtube-track-names.txt",
        trackNames.join("\r\n"),
        {
          encoding: "utf8",
        }
      );

      console.log('\nresults output to "youtube-track-names.txt"');
    } else {
      await fs.writeFileSync("data\\youtube-links.txt", youtubeLinks.join("\r\n"), {
        encoding: "utf8",
      });

      console.log('\nresults output to "youtube-links.txt"');
    }
  } catch (e) {
    console.log(e);
  }

  let trackCount;

  if (!SPECIAL_MODE) {
    trackCount = youtubeLinks.length;

    console.log(
      `${missingReleaseVideos.length} releases are missing or have no videos`
    );
  } else {
    trackCount = trackNames.length;
  }

  console.log(`\nThere were ${artistIDs.length} artists queried`);
  console.log(`\nThere were ${trackCount} tracks found`);

  console.log(`\n${addedArtistCount.length} artists had relevant tracks`);
  console.log(
    `Average track count per artist is: ${(
      trackCount / addedArtistCount.length
    ).toFixed(2)}`
  );

  console.log(
    `\n${noRating + failedRating} / ${releaseCount} releases were ignored`
  );
  console.log(`${noRating} releases ignored for no ratings`);
  console.log(`${failedRating} releases ignored for bad ratings`);
};

const LFM_SECRET = "35bcbf77ab91581df5f580e6bf35afc0";
const LFM_TOKEN = "4HRtIFB_NKC4x_cxsH2YexaZLH19Uign";

const testLastFM = async () => {
  try {
    const signature = md5(
      `api_key${LFM_API_KEY}methodauth.getSessiontoken${LFM_TOKEN}${LFM_SECRET}`
    );

    const res = await axios(
      `http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${LFM_API_KEY}&token=${LFM_TOKEN}&api_sig=${signature}`
    );

    const sessionKey = res.data.split("<key>")[1].split("</key>")[0];

    const res3 = await axios(
      `http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&api_key=${LFM_API_KEY}&token=${LFM_TOKEN}&api_sig=${signature}`
    );
  } catch (e) {
    console.log(e);
  }
};

start().then();
