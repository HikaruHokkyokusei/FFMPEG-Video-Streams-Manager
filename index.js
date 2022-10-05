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

const baseInputFilePath = config["baseInputFilePath"] + ((config["baseInputFilePath"].charAt(config["baseInputFilePath"].length - 1) !== "/") ? "/" : "");
const baseOutputFilePath = config["baseOutputFilePath"] + ((config["baseOutputFilePath"].charAt(config["baseOutputFilePath"].length - 1) !== "/") ? "/" : "");

const menuOptions = [
    "Execute Pre-main function",
    "Display input file info.",
    "Run manual test command",
    "Keep specific subtitle streams only",
    "Keep specific audio streams only",
    "Keep specific subtitle and audio streams only",
    "Remove specific subtitle streams",
    "Remove specific audio streams",
    "Remove specific subtitle and audio streams",
    "Keep specific streams only",
    "Remove specific streams",
    "Auto: Keep only Japanese audio & English subtitle streams"
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
        "-map -0:v",
        "-map -0:a",
        "-map -0:s"
    ];

    console.log("Detected Streams: ");
    for (const stream of streamList) {
        if (typeof stream === "string") {
            console.log(stream);
        } else {
            console.log(stream["Full Details"]);
        }
    }

    let selectedStreams = "";
    for (const streamListElement of streamList) {
        if (typeof streamListElement === "object") {
            if (streamListElement["Stream Type"] === "video" && streamListElement["Stream Index"] === "0") {
                selectedStreams += `${streamListElement["Stream Index"]} `;
            } else if (streamListElement["Is Japanese"] != null) {
                if (streamListElement["Stream Type"] === "audio" && streamListElement["Is Japanese"]) {
                    selectedStreams += `${streamListElement["Stream Index"]} `;
                } else if (streamListElement["Stream Type"] === "subtitle" && !streamListElement["Is Japanese"]) {
                    selectedStreams += `${streamListElement["Stream Index"]} `;
                }
            } else {
                console.log(`Ambiguous Stream Detected: ${streamListElement["Full Details"]}.`);
                if (readLine.keyInYN("Do you want to include it?")) {
                    selectedStreams += `${streamListElement["Stream Index"]} `;
                }
            }
        }
    }

    let shouldSatisfy = true;
    while (shouldSatisfy) {
        console.log(`Currently Selected Streams: ${selectedStreams} (Streams that are not video, audio or subtitles are auto included.)`);
        if (readLine.keyInYN("Are you satisfied with the currently selected streams?")) {
            shouldSatisfy = !shouldSatisfy;
        } else {
            selectedStreams = getInput("Manually enter the stream indexes to include (space seperated): ");
        }
    }

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
    let directoryContent = getDirectoryContent(baseInputFilePath);
    let currentFfmpegNonFileParams = ffmpegNonFileParams;
    for (const element of directoryContent) {
        if (currentDepth < 1 && element.isDir) {
            console.log(`Folder --> ${element.name}`);
            if (!readLine.keyInYN("Do you want to continue?")) {
                break;
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
            if (element.canProcess) {
                if (!currentFfmpegNonFileParams) {
                    currentFfmpegNonFileParams = generateAutoParamsFromFile(baseInputFilePath + element.name);
                }
                operationFunction(baseInputFilePath, element.name, currentFfmpegNonFileParams, baseOutputFilePath, element.name);
            } else {
                fs.copyFileSync(baseInputFilePath + element.name, baseOutputFilePath + element.name, fs.constants.COPYFILE_EXCL);
            }
        }
    }
};

const preMain = async () => {
    try {
        // console.log(readLine.keyInYN("Do you want to include it?"));
        // console.log(getListOfStreams(`${baseInputFilePath + "inp.mkv"}`));
    } catch (error) {
        console.error(error.message);
    }
};
const main = async () => {
    console.log("Script started");
    console.log("Ensure that FFMPEG is installed and is set in the env. path variables.\n");
    console.log(`Based on the config file, i/p files needs to be in "${baseInputFilePath}" and o/p. files will be stored in "${baseOutputFilePath}"\n`);

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
                inputFilePath = getInput("Enter file name: ");
                executeCmdScript(['-i', `"${baseInputFilePath}${inputFilePath}"`, '2>&1', '|', 'find', '"Stream"']);
                continue;
            }

            case 2: {
                let userCommand = getInput("Enter command: ");
                userCommand = userCommand.replaceAll("$iB$/", baseInputFilePath);
                userCommand = userCommand.replaceAll("$oB$/", baseOutputFilePath);
                executeCmdScript([userCommand]);
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
                    sampleFile = baseInputFilePath + inputFilePath;
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
            executeGenericFfmpegScript(baseInputFilePath, inputFilePath, ffmpegNonFileParams, baseOutputFilePath, outputFilePath);
        } else {
            operateOnFilesRecursively(
                baseInputFilePath,
                baseOutputFilePath,
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
    console.log(err);
    console.log("Script Ended with Error");
});
