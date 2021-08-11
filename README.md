# Script find new music from known artists & generate a YT playlist

This project will take a playlist of tracks, lookup the artists on discogs and return a
list of YT urls for their releases given a set of filters (Release Date/Rating/Label etc). You can 
generate youtube playlists useful for listening to new music with maximum taste compatibility 

## Available Scripts

In the project directory, you can run:

### get-artist-ids

Provide a simple playlist file of favourite artists named top-artists.txt with the following format:

artist name - track title
artist name - track title
artist name - track title

It will return a set of discogs ids for each artist in a file artist-ids.txt

### get-youtube-links

This will take artist-ids.txt and find all youtube video links for their tracks based on a set of filters (see top of script)

It will return all youtube links for the playlist in a file youtube-links.txt
