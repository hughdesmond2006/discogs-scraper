const axios = require("axios");
const fs = require("fs");

const authString =
  "&key=fohKBqcUfBoyVJIGqiAz&secret=rxyNgwUPNcEdhjhayugWYUQfaarjKSyh";

let missingArtists = [];

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

const search = async (trackName, isRelease = true) => {
  // get the discogs release for it
  try {
    const res = await axios(
      `https://api.discogs.com/database/search?type=${
        isRelease ? "release" : "master"
      }&query=${trackName}` + authString
    );
    const item = res.data.results[0];

    console.log('"' + item.title + '"');

    console.log(item.year, item.genre.join(), item.id);

    console.log("https://www.discogs.com" + item.uri);

    return item;
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await search(trackName, isRelease);
    } else {
      console.log(e);
      console.log(
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      );

      // if master lookup fails then neither release or master was found so add to missing
      if(!isRelease){
        missingArtists.push(trackName);
      }
    }

    return null;
  }
};

const getArtistForTrack = async (
  id,
  artistLookup,
  trackLookup,
  isRelease = true
) => {
  try {
    const res = await axios(
      `https://api.discogs.com/${
        isRelease ? "releases" : "masters"
      }/${id}?per_page=50` + authString
    );
    let artist;

    if (res.data.artists[0].name.includes("Various")) {
      artist = res.data.tracklist
        .find((x) => x.title.includes(trackLookup))
        .artists.find((x) => x.name.includes(artistLookup));
    } else {
      artist = res.data.artists[0];
    }

    console.log(`artist "${artist.name}" ${artist.id}`);

    return artist;
  } catch (e) {
    if (await apiBreak(e)) {
      // try again after wait
      return await getArtistForTrack(id, artistLookup, trackLookup, isRelease);
    } else {
      console.log(e);
      console.log(
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      );
    }
  }
};

const start = async () => {
  let trackNames;

  // read file containing an example track from each fav artist
  try {
    trackNames = await fs.readFileSync("top-artists.txt", {
      encoding: "utf8",
    });

    trackNames = trackNames.split("\r\n");
  } catch (e) {
    console.log(e);
  }

  const artistIDs = [];
  let prevArtist = null;

  // loop through each track and process
  for (let i = 0; i < trackNames.length; i++) {
    if (trackNames[i] && trackNames[i].trim() !== "") {
      const thisArtist = trackNames[i].split(" - ")[0].toLowerCase();

      // if the last artist lookup failed for this artist, look them up again using the new trackname
      const exception =
        missingArtists.length > 0 &&
        missingArtists[missingArtists.length - 1]
          .split(" - ")[0]
          .toLowerCase() === thisArtist;

      if (exception) {
        missingArtists.pop();
      }

      if (exception || thisArtist !== prevArtist) {
        console.log(`------------"${trackNames[i]}"-------------`);

        const exampleRelease = await search(trackNames[i]);
        let artist;
        let nameSplit = trackNames[i].split(" - ");

        // get discogs artist from example release
        if (exampleRelease) {
          artist = await getArtistForTrack(
            exampleRelease.id,
            nameSplit[0],
            nameSplit[1]
          );
        } else {
          const exampleMaster = await search(trackNames[i], false);

          if (exampleMaster) {
            artist = await getArtistForTrack(
              exampleMaster.id,
              nameSplit[0],
              nameSplit[1],
              false
            );
          }
        }

        if (artist) {
          console.log("https://www.discogs.com/artist/" + artist.id);
          artistIDs.push(artist.id);
        }
      }
    }

    prevArtist = trackNames[i].split(" - ")[0].toLowerCase();
  }

  // write all discogs artist ids file
  try {
    await fs.writeFileSync("artist-ids.txt", artistIDs.join("\r\n"), {
      encoding: "utf8",
    });
  } catch (e) {
    console.log(e);
  }

  console.log(`There were ${missingArtists.length} missing artists:`);
  console.log(missingArtists.join("\r\n"));
};

start().then();
