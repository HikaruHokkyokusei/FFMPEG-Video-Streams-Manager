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
    <li>Auto: Keep only Japanese audio & English subtitle streams</li>
</ul>

I made this for anime, that's why there is that last option in the above list. It is a versatile feature and one might
want to change it based on their requirements.

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
