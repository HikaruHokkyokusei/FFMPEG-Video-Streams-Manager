<p align="center">
  <img src="./FVSM-Info-Img.jpg" alt="Information about this script">
</p>

<h1 align="center" style="text-align: center;">FFMPEG Video Streams Manager</h1>

<hr>

## A simple application that allows you to:

<ul>
    <li>Display input file info.</li>
    <li>Keep specific subtitle streams only (Non-subtitle streams are included as it is)</li>
    <li>Keep specific audio streams only (Non-audio streams are included as it is)</li>
    <li>Keep specific subtitle and audio streams only (Other streams are included as it is)</li>
    <li>Remove specific subtitle streams</li>
    <li>Remove specific audio streams</li>
    <li>Remove specific subtitle and audio streams</li>
    <li>Keep specific streams only</li>
    <li>Remove specific streams</li>
    <li>Auto: Keep only Japanese audio streams (Read README.md)</li>
</ul>

I made this script for anime episodes and that's why there is that last option in the above list. It is actually a very
versatile & advanced feature and one might want to change it based on their requirements. This option only includes
japanese audio streams. All other non-audio streams are included as it is. There is one more thing here though. If the
video contains more than one video tracks, then only
the first one is included and others are discarded.

Also, this function will directly copy any files whose extensions are either present in the stop word list or if any of
the following string is present in the full path of the input file (case-insensitive): -
<ul>
    <li><code>/ova </code>></li>
    <li><code>/ovas </code>></li>
    <li><code>/movie </code>></li>
    <li><code>/movies </code>></li>
    <li><code>/extra </code>></li>
    <li><code>/extras </code>></li>
    <li><code>/special </code>></li>
    <li><code>/specials </code>></li>
</ul>

Files in such paths are called non season files. This direct copy feature for `Non Season Files` can be turned off using
the `config.json` file.

## Input/Output File Paths

All file paths are relative to the file paths set in the `config.json` file.

If output file path is set as `*` (default), then output path is set to be same as input file path (But in output
directory).

If input file path is set as `*` (default), then the script recursively on files and directories in the base input file
path.

## Requirements

This application is based on `FFMPEG`, so make sure that it is installed on the system and also is set as environment
variable on the system.

This script is designed for `Windows`, but most probably should run fine on other OSs as well. Not sure about `MacOS`.
