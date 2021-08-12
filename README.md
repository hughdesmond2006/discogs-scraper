# Script find new music from known artists & generate a YT playlist

This project will take a playlist of tracks, lookup the artists on discogs and return a
list of YT urls for their releases given a set of filters (Release Date/Rating/Label etc). You can 
generate youtube playlists useful for listening to new music with maximum taste compatibility 

## Available Scripts

In the project directory, you can run:

### get-artist-ids.js

Provide a simple playlist file of favourite artists named top-artists.txt with the following format:

artist name - track title
artist name - track title
artist name - track title

It will search discogs for the track and from that infer the correct artist profile (to circumvent duplicate artist names). Ids for each 
discogs artist profile are then stored in a file artist-ids.txt

The artist is found by looking up the track name on discogs, sometimes messy ID3 tags or filenames (EG. "michel_jack-son-THRILLER_234522") 
can cause it fail. You can provide several tracks for each artist (order top-artists.txt by artist name) and if the first fails it will try 
the next, then the next and so on until it finds a match for the artist. 

If none of the provided tracks for a particular artist return a matching discogs profile you can:
A. Add more/different tracks from that artist to the top-artists.txt which are more likely to be found on discogs
B. Cleanup any messy tags that may be causing the search to fail ie. remove unnecessary special characters, label tags, extra artists or any 
other junk that messes up the format outlined at the start of this section.

### get-youtube-links.js

This will take artist-ids.txt and find all youtube video links for their tracks based on a set of filters (see top of script)

It will return all youtube links for the playlist in a file youtube-links.txt

### fill-youtube-playlist.js

This will let you login to your youtube account and add the links from youtube-links.txt in a specified YT playlist. 

Please provide a playlist ID from your account (see top of script)

Currently the test licence only allows 10k api hits per day (one hit per track added)



