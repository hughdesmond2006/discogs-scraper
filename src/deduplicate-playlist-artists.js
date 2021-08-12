const fs = require("fs");

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

  let deduplicated = [];

  // loop through each track and process
  for (let i = 0; i < trackNames.length; i++) {
    if(i !== trackNames.length -1 && trackNames[i] && trackNames[i].trim() !== ''){
      const thisArtist = trackNames[i].split(' - ')[0].toLowerCase();
      const nextArtist = trackNames[i + 1].split(' - ')[0].toLowerCase();

      if(thisArtist !== nextArtist){
        deduplicated.push(trackNames[i]);
      }
    }
  }

  // write tracks back to file
  try {
    await fs.writeFileSync("top-artists.txt", deduplicated.join('\r\n'),{
      encoding: "utf8",
    });
  } catch (e) {
    console.log(e);
  }

  console.log(`File was ${trackNames.length} lines. Now its ${deduplicated.length} lines!!`);
};

start().then();
