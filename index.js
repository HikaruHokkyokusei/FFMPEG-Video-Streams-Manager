"use strict";

/*   Regex to match files: -
 *   /.+(\.[A-Za-z0-9]+)(?=\r?\n?)$/gm
 */

import {createRequire} from "module";
import readLine from "readline-sync";
import * as fs from "fs";

const require = createRequire(import.meta.url);
const childProcess = require("child_process");
const config = require("./config.json");

const preventDirectCopyOfNonSeasonFolders = config["preventDirectCopyOfNonSeasonFolders"];
const requireConfirmationWhileAutoSelectingStreams = config["requireConfirmationWhileAutoSelectingStreams"];
const isStopWord = config["stopWords"];

const executeCmdScript = (scriptParams, shouldPrint = true, shouldReturn = false, command = "ffmpeg -hide_banner ") => {
    for (const param of scriptParams) {
        command += param + " ";
    }
    let result = childProcess.execSync(command).toString();

    if (shouldPrint) {
        console.log(result);
        console.log("");
    }

    if (shouldReturn) {
        return result;
    }
};

const baseIpFilePath = config["baseIpFilePath"] + ((config["baseIpFilePath"].charAt(config["baseIpFilePath"].length - 1) !== "/") ? "/" : "");
const baseOpFilePath = config["baseOpFilePath"] + ((config["baseOpFilePath"].charAt(config["baseOpFilePath"].length - 1) !== "/") ? "/" : "");

const menuOptions = [
    "Execute Pre-main function",
    "Run manual test command",
    "Display input file info.",
    "Keep specific subtitle streams only",
    "Keep specific audio streams only",
    "Keep specific subtitle and audio streams only",
    "Remove specific subtitle streams",
    "Remove specific audio streams",
    "Remove specific subtitle and audio streams",
    "Keep specific streams only",
    "Remove specific streams",
    "Auto: Keep only Japanese audio streams (Read README.md)"
];
const showMenu = () => {
    console.log("Menu: -");
    return readLine.keyInSelect(menuOptions, "Choice:", {cancel: "Exit"});
};

const getInput = (msg) => {
    return "" + readLine.question(msg);
};
const getFileNamesFromUser = () => {
    let inputFilePath = getInput("Enter Input File Name (* for all files in inp dir. <- default): ");
    if (!inputFilePath) {
        inputFilePath = "*";
    }
    let outputFilePath = (inputFilePath === "*") ? "*" : getInput("Enter Output File Name (* for same as input <- default): ");
    if (!outputFilePath) {
        outputFilePath = "*";
    }

    if (!inputFilePath || !outputFilePath) {
        throw "Invalid File Names";
    }

    return [inputFilePath, outputFilePath];
};

const getListOfStreams = (filePath) => {
    const returnList = executeCmdScript([
        '-i',
        `"${filePath}"`,
        '2>&1',
        '|',
        'find',
        '"Stream"'
    ], false, true).trim().split(/[\r\n]+/gi);

    for (let i = 0; i < returnList.length; i++) {
        let currentStream = returnList[i].trim();
        let matches = new RegExp(/Stream #0:([0-9]+)(\([A-Za-z0-9]+\))?: (Video|Audio|Subtitle): (.*)(?=\r?\n?)$/gmi).exec(currentStream);
        if (matches && matches[2]) {
            matches[2] = matches[2].toLowerCase();
        }
        returnList[i] = (!matches) ? currentStream : {
            "Full Details": currentStream,
            "Generic Stream Details": matches[0],
            "Stream Index": matches[1],
            "Is Japanese": (matches[2] === "(jpn)") ? true : ((matches[2] === "(eng)") ? false : null),
            "Is Language Undefined": (matches[2] === "(und)"),
            "Stream Type": matches[3].toLowerCase(),
            "Stream Title": matches[4]
        };
    }

    return returnList;
};
const generateAutoParamsFromFile = (sampleFile) => {
    let streamList = getListOfStreams(sampleFile);
    let ffmpegNonFileParams = [
        "-map 0",
        // "-map -0:v",
        "-map -0:a",
        // "-map -0:s"
    ];

    console.log("Detected Streams: ");
    for (const stream of streamList) {
        if (typeof stream === "string") {
            console.log(stream);
        } else {
            console.log(stream["Full Details"]);
        }
    }
    console.log("");

    let hasSelectedAudioStream = false;
    let selectedStreams = "", excludedStreams = "";
    let currentAudioStreamIndex = 0;

    for (const streamListElement of streamList) {
        if (typeof streamListElement === "object") {
            if (streamListElement["Stream Type"] === "video") {
                // Info: In case someone wants to handle it differently...
            } else if (streamListElement["Stream Type"] === "subtitle") {
                // Info: In case someone wants to handle it differently...
            } else if (streamListElement["Stream Type"] === "audio") {
                if (streamListElement["Is Japanese"]) {
                    selectedStreams += `a:${currentAudioStreamIndex} `;
                    hasSelectedAudioStream = true;
                } else {
                    excludedStreams += `a:${currentAudioStreamIndex} `;
                }
                currentAudioStreamIndex += 1;
            } else {
                // Will never enter this block based on current regex.
                // console.log(`Ambiguous Stream Detected: ${streamListElement["Full Details"]}.`);
                // if (readLine.keyInYN("Do you want to include it?")) {
                //     selectedStreams += `${streamListElement["Stream Index"]} `;
                // } else {
                //     excludedStreams += `${streamListElement["Stream Index"]} `;
                // }
            }
        }
    }
    if (!hasSelectedAudioStream) {
        selectedStreams += `a:0`;
        excludedStreams = excludedStreams.replace(`a:0 `, " ");
    }

    let shouldSatisfy = requireConfirmationWhileAutoSelectingStreams;
    console.log(`Currently Selected Streams: ${selectedStreams} (Streams that are not video or audio are auto included.)`);
    console.log(`Excluded Streams: ${excludedStreams}`);
    while (shouldSatisfy) {
        if (readLine.keyInYN("Are you satisfied with the currently selected streams?")) {
            shouldSatisfy = !shouldSatisfy;
        } else {
            selectedStreams = getInput("Manually enter the stream indexes to include (space seperated): ");
            excludedStreams = "-";
            console.log(`Currently Selected Streams: ${selectedStreams} (Streams that are not video or audio are auto included.)`);
            console.log(`Excluded Streams: ${excludedStreams}`);
        }
    }
    console.log("");

    for (let streamIndex of selectedStreams.trim().split(" ")) {
        ffmpegNonFileParams.push(`-map 0:${streamIndex}`);
    }

    return ffmpegNonFileParams;
};
const executeGenericFfmpegScript = (baseInputFilePath, inputFilePath, ffmpegNonFIleParams, baseOutputFilePath, outputFilePath) => {
    if (outputFilePath === "*") {
        outputFilePath = inputFilePath;
    }
    executeCmdScript([`-i "${baseInputFilePath + inputFilePath}"`, ...ffmpegNonFIleParams, `-c copy "${baseOutputFilePath + outputFilePath}"`]);
};

const getDirectoryContent = (baseInputFilePath) => {
    return fs.readdirSync(baseInputFilePath, {withFileTypes: true}).map((d) => {
        let lastIndex = d.name.lastIndexOf(".");
        let extension = (lastIndex > -1) ? d.name.substring(lastIndex) : null;
        return {
            "name": d.name,
            "extension": extension,
            "isDir": d.isDirectory(),
            "canProcess": extension != null && !isStopWord[extension]
        };
    });
};
const operateOnFilesRecursively = (baseInputFilePath, baseOutputFilePath, operationFunction, ffmpegNonFileParams, currentDepth) => {
    console.log("PWD: " + baseInputFilePath);
    console.log("");
    let directoryContent = getDirectoryContent(baseInputFilePath);

    let lowerCasePath = baseInputFilePath.toLowerCase();
    let isSeasonDirectory = preventDirectCopyOfNonSeasonFolders ||
        (
            lowerCasePath.lastIndexOf("/ova ") === -1 &&
            lowerCasePath.lastIndexOf("/ovas ") === -1 &&
            lowerCasePath.lastIndexOf("/extra ") === -1 &&
            lowerCasePath.lastIndexOf("/extras ") === -1 &&
            lowerCasePath.lastIndexOf("/special ") === -1 &&
            lowerCasePath.lastIndexOf("/specials ") === -1
        );

    for (const element of directoryContent) {
        if (currentDepth < 1) {
            console.log(`Current Element: ${element.name}`);
            switch (readLine.keyInSelect(["Yes", "Skip this item and it's sub-items"], `Do you want to continue?`, {cancel: "Exit"})) {
                case 0: {
                    break;
                }

                case 1: {
                    console.log("");
                    continue;
                }

                case -1:
                default: {
                    return;
                }
            }
            console.log("");
        }
        if (element.isDir) {
            fs.mkdirSync(baseOutputFilePath + element.name);
            operateOnFilesRecursively(
                `${baseInputFilePath + element.name}/`,
                `${baseOutputFilePath + element.name}/`,
                operationFunction,
                ffmpegNonFileParams,
                currentDepth + 1
            );
        } else {
            if (element.canProcess && isSeasonDirectory) {
                operationFunction(baseInputFilePath, element.name, generateAutoParamsFromFile(baseInputFilePath + element.name), baseOutputFilePath, element.name);
            } else {
                console.log(`Directly Copying ${element.name}`);
                fs.copyFileSync(baseInputFilePath + element.name, baseOutputFilePath + element.name, fs.constants.COPYFILE_EXCL);
            }
        }
    }
};

const printFilesRecursively = (inputFile, depth) => {
    let prepend = "  ".repeat(depth);
    let directoryContent = getDirectoryContent(inputFile);
    for (const element of directoryContent) {
        console.log(`${prepend}${element.name}`);
        if (element.isDir) {
            printFilesRecursively(inputFile + element.name + "/", depth + 1);
        }
    }
};

const preMain = async () => {
    try {
        // console.log(readLine.keyInYN("Do you want to include it?"));
        // console.log(getListOfStreams(`${baseIpFilePath + "inp.mkv"}`));
        printFilesRecursively(baseIpFilePath, 0);
    } catch (error) {
        console.error(error.message);
    }
};
const main = async () => {
    console.log("Script started");
    console.log("Ensure that FFMPEG is installed and is set in the env. path variables.\n");
    console.log(`Based on the config file, i/p files needs to be in "${baseIpFilePath}" and o/p. files will be stored in "${baseOpFilePath}"\n`);

    while (true) {
        let choice = showMenu();
        console.log("");
        let inputFilePath = null, outputFilePath = null;
        let ffmpegNonFileParams = null;

        switch (choice) {
            case 0: {
                await preMain();
                process.exit(0);
                return true;
            }

            case 1: {
                let userCommand = getInput("Enter command: ");
                userCommand = userCommand.replaceAll("$iB$/", baseIpFilePath);
                userCommand = userCommand.replaceAll("$oB$/", baseOpFilePath);
                executeCmdScript([userCommand], true, false, "");
                continue;
            }

            case 2: {
                inputFilePath = getInput("Enter file name: ");
                executeCmdScript(['-i', `"${baseIpFilePath}${inputFilePath}"`, '2>&1', '|', 'find', '"Stream"']);
                continue;
            }

            case 3: {
                let streamsToKeep = getInput("Enter subtitle stream numbers to keep (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0",
                    "-map -0:s"
                ];
                for (let param of streamsToKeep) {
                    ffmpegNonFileParams.push(`-map 0:s:${param}`);
                }
                break;
            }

            case 4: {
                let streamsToKeep = getInput("Enter audio stream numbers to keep (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0",
                    "-map -0:a"
                ];
                for (let param of streamsToKeep) {
                    ffmpegNonFileParams.push(`-map 0:a:${param}`);
                }
                break;
            }

            case 5: {
                let sStreamsToKeep = getInput("Enter audio stream numbers to keep (space seperated): ").split(" ");
                let aStreamsToKeep = getInput("Enter audio stream numbers to keep (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0",
                    "-map -0:s",
                    "-map -0:a"
                ];
                for (let param of aStreamsToKeep) {
                    ffmpegNonFileParams.push(`-map 0:a:${param}`);
                }
                for (let param of sStreamsToKeep) {
                    ffmpegNonFileParams.push(`-map 0:s:${param}`);
                }
                break;
            }

            case 6: {
                let streamsToKeep = getInput("Enter subtitle stream numbers to remove (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0"
                ];
                for (let param of streamsToKeep) {
                    ffmpegNonFileParams.push(`-map -0:s:${param}`);
                }
                break;
            }

            case 7: {
                let streamsToKeep = getInput("Enter audio stream numbers to remove (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0"
                ];
                for (let param of streamsToKeep) {
                    ffmpegNonFileParams.push(`-map -0:a:${param}`);
                }
                break;
            }

            case 8: {
                let sStreamsToKeep = getInput("Enter audio stream numbers to remove (space seperated): ").split(" ");
                let aStreamsToKeep = getInput("Enter audio stream numbers to remove (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0"
                ];
                for (let param of aStreamsToKeep) {
                    ffmpegNonFileParams.push(`-map -0:a:${param}`);
                }
                for (let param of sStreamsToKeep) {
                    ffmpegNonFileParams.push(`-map -0:s:${param}`);
                }
                break;
            }

            case 9: {
                let streamsToKeep = getInput("Enter stream numbers to keep (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [];
                for (let param of streamsToKeep) {
                    ffmpegNonFileParams.push(`-map 0:${param}`);
                }
                break;
            }

            case 10: {
                let streamsToKeep = getInput("Enter stream numbers to keep (space seperated): ").split(" ");
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                ffmpegNonFileParams = [
                    "-map 0"
                ];
                for (let param of streamsToKeep) {
                    ffmpegNonFileParams.push(`-map -0:${param}`);
                }
                break;
            }

            case 11: {
                let sampleFile = null;
                [inputFilePath, outputFilePath] = getFileNamesFromUser();
                if (inputFilePath !== "*") {
                    sampleFile = baseIpFilePath + inputFilePath;
                    ffmpegNonFileParams = generateAutoParamsFromFile(sampleFile);
                }
                break;
            }

            case -1:
            default: {
                return true;
            }
        }

        if (inputFilePath !== "*") {
            executeGenericFfmpegScript(baseIpFilePath, inputFilePath, ffmpegNonFileParams, baseOpFilePath, outputFilePath);
        } else {
            operateOnFilesRecursively(
                baseIpFilePath,
                baseOpFilePath,
                executeGenericFfmpegScript,
                ffmpegNonFileParams,
                0
            );
        }
    }
};

main().then((success) => {
    console.log(`Script Ended with${(success) ? "out errors" : " error"}`);
}).catch((err) => {
    if (err.stdout) {
        err.stdout = err.stdout.toString();
    }
    if (err.stderr) {
        err.stderr = err.stderr.toString();
    }
    console.log(err);
    console.log("Script Ended with Error");
});
