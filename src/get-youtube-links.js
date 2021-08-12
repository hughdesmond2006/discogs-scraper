const axios = require("axios");
const fs = require("fs");

// filters - set to a filter to null/undefined if you want it to be ignored
const EXACT_YEAR = 2021;
const EXACT_MONTH = null; // shorthand string EG. 'Mar'
const MIN_YEAR = null;
const MIN_RATING = 4.2;
const MIN_RATE_COUNT = 10;

// set this to true to take tracks from other artists on compilation releases
const INCLUDE_OTHER_COMPILATION_TRACKS = false;

// set this to false to allow releases with undefined release month to pass the filter
const MONTH_FILTER_STRICT_MODE = true;

const authString =
  "&key=fohKBqcUfBoyVJIGqiAz&secret=rxyNgwUPNcEdhjhayugWYUQfaarjKSyh";

const missingReleaseVideos = [];
const youtubeLinks = [];
let failedRating = 0;
let noRating = 0;
let releaseCount = 0;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const apiBreak = async (e) => {
  // wait if requests too often..
  if (e.response && e.response.status === 429) {
    console.log("<<<<<<< waiting 60 seconds to give api a break >>>>>>>>>");
    await delay(60000);
    return true;
  }

  return false;
};

const getArtistReleases = async (artistID, i) => {
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
      return await getArtistReleases(artistID, i);
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
      console.log('skipping duplicate artist ID...');
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

    if (!all) {
      throw new Error("NO VIDEOS FOUND FOR THIS RELEASE");
    }

    if (
      !res.data.community ||
      !res.data.community.rating ||
      !res.data.community.rating.average ||
      !res.data.community.rating.count
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
      }
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

const start = async () => {
  let artistIDs;

  // read file with discogs artist ids
  try {
    const file = await fs.readFileSync("artist-ids.txt", {
      encoding: "utf8",
    });

    artistIDs = file.split("\r\n");
  } catch (e) {
    console.log(e);
  }

  await processArtistReleases(artistIDs);

  // write all YT links to file
  try {
    await fs.writeFileSync("youtube-links.txt", youtubeLinks.join("\r\n"), {
      encoding: "utf8",
    });
  } catch (e) {
    console.log(e);
  }

  console.log(
    `${missingReleaseVideos.length} releases are missing or have no videos:`
  );
  console.log(missingReleaseVideos.join("\r\n"));
  console.log(`\nThere were ${artistIDs.length} artists queried`);
  console.log(`\nThere were ${youtubeLinks.length} tracks found`);
  console.log(
    `Average track count per artist is: ${(
      youtubeLinks.length / artistIDs.length
    ).toFixed(2)}`
  );

  console.log(
    `\n${noRating + failedRating} / ${releaseCount} releases were ignored`
  );
  console.log(`${noRating} releases ignored for no ratings`);
  console.log(`${failedRating} releases ignored for bad ratings`);
};

start().then();
