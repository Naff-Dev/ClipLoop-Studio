const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { formatDuration } = require('./helpers');

// Track active FFmpeg processes for abort
let activeProcesses = [];
let abortRequested = false;

// Timeout for FFmpeg operations (30 minutes)
const FFMPEG_TIMEOUT = 30 * 60 * 1000;

// Parse timemark (HH:MM:SS.ms) to seconds
function parseTimemark(timemark) {
    if (!timemark) return 0;
    const parts = timemark.split(':');
    if (parts.length !== 3) return 0;

    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
}

// Set FFmpeg path (bundled in production, system in development)
function getFFmpegPath() {
    if (app.isPackaged) {
        // Production: use bundled FFmpeg
        const ffmpegPath = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
        const ffprobePath = path.join(process.resourcesPath, 'ffmpeg', 'ffprobe.exe');

        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);

        return { ffmpegPath, ffprobePath };
    } else {
        // Development: use system FFmpeg (must be in PATH or specify manually)
        const resourcesPath = path.join(__dirname, '..', '..', 'resources', 'ffmpeg');

        if (fs.existsSync(path.join(resourcesPath, 'ffmpeg.exe'))) {
            const ffmpegPath = path.join(resourcesPath, 'ffmpeg.exe');
            const ffprobePath = path.join(resourcesPath, 'ffprobe.exe');

            ffmpeg.setFfmpegPath(ffmpegPath);
            ffmpeg.setFfprobePath(ffprobePath);

            return { ffmpegPath, ffprobePath };
        }
    }

    return {};
}

// Initialize FFmpeg paths
getFFmpegPath();

// Get media duration using ffprobe with error handling
function getMediaDuration(filePath) {
    return new Promise((resolve, reject) => {
        if (!filePath || !fs.existsSync(filePath)) {
            return reject(new Error(`File tidak ditemukan: ${filePath}`));
        }

        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(new Error(`Gagal membaca metadata: ${err.message}`));
            } else if (!metadata || !metadata.format || !metadata.format.duration) {
                reject(new Error(`File tidak valid atau corrupt: ${filePath}`));
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
}

// Select audio files based on options
function selectAudioFiles(audioFiles, count, randomize) {
    let selected = [...audioFiles];

    if (randomize) {
        // Shuffle array
        for (let i = selected.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selected[i], selected[j]] = [selected[j], selected[i]];
        }
    } else {
        // Sort by filename ascending
        selected.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Take only the requested count
    return selected.slice(0, count);
}

// Merge audio - OPTIMIZED
async function mergeAudioFiles(audioFiles, outputPath, sendLog, sendProgress) {
    return new Promise(async (resolve, reject) => {
        if (abortRequested) {
            return reject(new Error('Operation aborted by user'));
        }

        sendLog('INFO', `Menggabungkan ${audioFiles.length} file audio...`);

        let totalDuration = 0;
        try {
            for (const audio of audioFiles) {
                const duration = await getMediaDuration(audio.path);
                totalDuration += duration;
            }
            sendLog('INFO', `Total durasi audio: ${formatDuration(totalDuration)}`);
        } catch (err) {
            sendLog('WARNING', 'Tidak dapat menghitung durasi');
        }

        const command = ffmpeg();
        let timeoutId;

        audioFiles.forEach(audio => {
            command.input(audio.path);
        });

        const filterComplex = audioFiles.map((_, i) => `[${i}:a]`).join('') + `concat=n=${audioFiles.length}:v=0:a=1[outa]`;

        command
            .complexFilter(filterComplex)
            .outputOptions('-map', '[outa]')
            .audioCodec('aac')
            .audioBitrate('192k')
            .format('mp4')  // Use MP4/M4A container format for AAC audio
            .output(outputPath)
            .on('start', () => {
                sendLog('INFO', '⚡ Menggabungkan file audio...');

                timeoutId = setTimeout(() => {
                    command.kill('SIGKILL');
                    reject(new Error('Audio merging timeout'));
                }, FFMPEG_TIMEOUT);
            })
            .on('progress', (progress) => {
                if (abortRequested) {
                    command.kill('SIGKILL');
                    return;
                }

                let percent = 0;
                if (totalDuration > 0 && progress.timemark) {
                    const currentTime = parseTimemark(progress.timemark);
                    percent = Math.min(99, Math.max(0, Math.round((currentTime / totalDuration) * 100)));
                    if (percent % 20 === 0) {
                        sendLog('INFO', `⚡ Merge audio: ${percent}%`);
                    }
                }

                if (sendProgress) sendProgress(5 + (percent * 0.15), 'Merge audio...');
            })
            .on('end', () => {
                if (timeoutId) clearTimeout(timeoutId);
                sendLog('SUCCESS', '✅ Audio berhasil digabungkan!');
                if (sendProgress) sendProgress(20, 'Audio selesai');
                const index = activeProcesses.indexOf(command);
                if (index > -1) activeProcesses.splice(index, 1);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                if (timeoutId) clearTimeout(timeoutId);
                sendLog('ERROR', `Gagal merge audio: ${err.message}`);
                if (stderr) {
                    sendLog('ERROR', `FFmpeg stderr: ${stderr}`);
                }
                const index = activeProcesses.indexOf(command);
                if (index > -1) activeProcesses.splice(index, 1);
                reject(err);
            });

        activeProcesses.push(command);
        command.run();
    });
}

// Mute video
function muteVideo(videoPath, outputPath, sendLog, sendProgress) {
    return new Promise((resolve, reject) => {
        sendLog('INFO', 'Menghapus audio dari video...');
        if (sendProgress) sendProgress(21, 'Mute video...');

        const command = ffmpeg(videoPath)
            .noAudio()
            .videoCodec('copy')
            .output(outputPath)
            .on('end', () => {
                sendLog('SUCCESS', 'Audio dihapus!');
                if (sendProgress) sendProgress(25, 'Selesai');
                const index = activeProcesses.indexOf(command);
                if (index > -1) activeProcesses.splice(index, 1);
                resolve(outputPath);
            })
            .on('error', (err) => {
                const index = activeProcesses.indexOf(command);
                if (index > -1) activeProcesses.splice(index, 1);
                reject(err);
            });

        activeProcesses.push(command);
        command.run();
    });
}

// Loop video - DUAL MODE
async function loopVideoWithTransition(videoPath, targetDuration, transition, outputPath, sendLog, sendProgress) {
    const videoDuration = await getMediaDuration(videoPath);
    const loopCount = Math.ceil(targetDuration / videoDuration);

    sendLog('INFO', `Durasi video: ${formatDuration(videoDuration)}`);
    sendLog('INFO', `Durasi target: ${formatDuration(targetDuration)}`);
    sendLog('INFO', `Jumlah loop: ${loopCount}x`);

    if (transition === 'none') {
        sendLog('INFO', '⚡ Mode: CEPAT (tanpa transisi)');
    } else {
        sendLog('INFO', `🌟 Mode: SMOOTH (${transition})`);
    }

    return new Promise((resolve, reject) => {
        if (loopCount === 1) {
            sendLog('INFO', 'Tidak perlu looping');
            if (sendProgress) sendProgress(26, 'Memproses...');

            const command = ffmpeg(videoPath)
                .outputOptions('-t', targetDuration.toString())
                .videoCodec('copy')
                .output(outputPath)
                .on('end', () => {
                    sendLog('SUCCESS', 'Selesai!');
                    if (sendProgress) sendProgress(70, 'Selesai');
                    const index = activeProcesses.indexOf(command);
                    if (index > -1) activeProcesses.splice(index, 1);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    const index = activeProcesses.indexOf(command);
                    if (index > -1) activeProcesses.splice(index, 1);
                    reject(err);
                });

            activeProcesses.push(command);
            command.run();
            return;
        }

        // Check mode
        if (transition === 'none') {
            // FAST MODE
            sendLog('INFO', `⚡ Looping ${loopCount}x CEPAT...`);
            if (sendProgress) sendProgress(26, 'Looping...');

            const tempDir = path.dirname(outputPath);
            const concatListPath = path.join(tempDir, 'concat_list.txt');

            try {
                let concatContent = '';
                for (let i = 0; i < loopCount; i++) {
                    // For Windows, use forward slashes and properly escape the path
                    const normalizedPath = videoPath.replace(/\\/g, '/');
                    concatContent += `file '${normalizedPath}'\n`;
                }
                fs.writeFileSync(concatListPath, concatContent, 'utf8');

                const command = ffmpeg()
                    .input(concatListPath)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions('-t', targetDuration.toString())
                    .videoCodec('copy')
                    .output(outputPath)
                    .on('start', () => {
                        sendLog('INFO', '⚡ Memproses video looping (mode cepat)...');
                    })
                    .on('progress', (progress) => {
                        if (progress.timemark) {
                            const currentTime = parseTimemark(progress.timemark);
                            const percent = Math.min(99, Math.max(0, Math.round((currentTime / targetDuration) * 100)));
                            if (percent % 20 === 0) {
                                sendLog('INFO', `⚡ Looping: ${percent}%`);
                            }
                            if (sendProgress) sendProgress(26 + (percent * 0.44), 'Looping...');
                        }
                    })
                    .on('end', () => {
                        try { fs.unlinkSync(concatListPath); } catch (e) { }
                        sendLog('SUCCESS', `✅ Video berhasil di-loop ${loopCount}x!`);
                        if (sendProgress) sendProgress(70, 'Selesai');
                        const index = activeProcesses.indexOf(command);
                        if (index > -1) activeProcesses.splice(index, 1);
                        resolve(outputPath);
                    })
                    .on('error', (err, stdout, stderr) => {
                        try { fs.unlinkSync(concatListPath); } catch (e) { }
                        sendLog('ERROR', `Gagal looping: ${err.message}`);
                        if (stderr) {
                            sendLog('ERROR', `FFmpeg stderr: ${stderr}`);
                        }
                        const index = activeProcesses.indexOf(command);
                        if (index > -1) activeProcesses.splice(index, 1);
                        reject(err);
                    });

                activeProcesses.push(command);
                command.run();
            } catch (error) {
                reject(error);
            }
        } else {
            // SMOOTH MODE with xfade
            sendLog('INFO', `🌟 Looping ${loopCount}x SMOOTH...`);
            sendLog('INFO', 'Durasi transisi: 1 detik');
            if (sendProgress) sendProgress(26, 'Rendering...');

            const transitionDuration = 1;
            const command = ffmpeg();

            for (let i = 0; i < loopCount; i++) {
                command.input(videoPath);
            }

            const xfadeMap = {
                'fade': 'fade',
                'fadeblack': 'fadeblack',
                'slideleft': 'slideleft',
                'slideright': 'slideright',
                'blurfade': 'circleopen',
                'zoom': 'fade'
            };

            const xfadeTransition = xfadeMap[transition] || 'fade';
            sendLog('INFO', `Efek: ${xfadeTransition}`);

            let filterComplex = '';
            for (let i = 0; i < loopCount - 1; i++) {
                if (i === 0) {
                    const offset = videoDuration - transitionDuration;
                    filterComplex += `[0:v][1:v]xfade=transition=${xfadeTransition}:duration=${transitionDuration}:offset=${offset}[v1];`;
                } else {
                    const offset = (videoDuration * (i + 1)) - (transitionDuration * (i + 1));
                    filterComplex += `[v${i}][${i + 1}:v]xfade=transition=${xfadeTransition}:duration=${transitionDuration}:offset=${offset}[v${i + 1}];`;
                }
            }

            filterComplex = filterComplex.slice(0, -1);
            const outputLabel = `[v${loopCount - 1}]`;

            command
                .complexFilter(filterComplex)
                .outputOptions('-map', outputLabel)
                .outputOptions('-t', targetDuration.toString())
                .videoCodec('libx264')
                .outputOptions(['-preset', 'fast', '-crf', '23'])
                .output(outputPath)
                .on('start', () => {
                    sendLog('INFO', '🌟 Merender transisi smooth...');
                })
                .on('progress', (progress) => {
                    if (progress.timemark) {
                        const currentTime = parseTimemark(progress.timemark);
                        const percent = Math.min(99, Math.max(0, Math.round((currentTime / targetDuration) * 100)));
                        if (percent % 10 === 0) {
                            sendLog('INFO', `🌟 Rendering: ${percent}%`);
                        }
                        if (sendProgress) sendProgress(26 + (percent * 0.44), 'Rendering...');
                    }
                })
                .on('end', () => {
                    sendLog('SUCCESS', `✅ Video berhasil di-loop ${loopCount}x dengan transisi smooth!`);
                    if (sendProgress) sendProgress(70, 'Selesai');
                    const index = activeProcesses.indexOf(command);
                    if (index > -1) activeProcesses.splice(index, 1);
                    resolve(outputPath);
                })
                .on('error', (err, stdout, stderr) => {
                    sendLog('ERROR', `Gagal smooth transition: ${err.message}`);
                    if (stderr) {
                        sendLog('ERROR', `FFmpeg stderr: ${stderr}`);
                    }
                    const index = activeProcesses.indexOf(command);
                    if (index > -1) activeProcesses.splice(index, 1);
                    reject(err);
                });

            activeProcesses.push(command);
            command.run();
        }
    });
}

// Merge video + audio
async function mergeVideoAudio(videoPath, audioPath, outputPath, sendLog, sendProgress) {
    return new Promise(async (resolve, reject) => {
        sendLog('INFO', 'Menggabungkan video + audio...');

        let videoDuration = 0;
        let audioDuration = 0;
        try {
            videoDuration = await getMediaDuration(videoPath);
            audioDuration = await getMediaDuration(audioPath);
            const finalDuration = Math.min(videoDuration, audioDuration);
            sendLog('INFO', `Durasi final: ${formatDuration(finalDuration)}`);
        } catch (err) {
            sendLog('WARNING', 'Tidak dapat hitung durasi');
        }

        const targetDuration = Math.min(videoDuration, audioDuration);

        const command = ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(['-map', '0:v:0', '-map', '1:a:0'])
            .videoCodec('copy')
            .audioCodec('aac')
            .audioBitrate('192k')
            .outputOptions(['-shortest'])
            .output(outputPath)
            .on('start', () => {
                sendLog('INFO', '🎬 Menggabungkan video & audio final...');
                if (sendProgress) sendProgress(71, 'Merge final...');
            })
            .on('progress', (progress) => {
                let percent = 0;
                if (targetDuration > 0 && progress.timemark) {
                    const currentTime = parseTimemark(progress.timemark);
                    percent = Math.min(99, Math.max(0, Math.round((currentTime / targetDuration) * 100)));
                    if (percent % 10 === 0) {
                        sendLog('INFO', `🎬 Merge final: ${percent}%`);
                    }
                }
                if (sendProgress) sendProgress(71 + (percent * 0.29), 'Merge...');
            })
            .on('end', () => {
                sendLog('SUCCESS', '✅ SELESAI!');
                if (sendProgress) sendProgress(100, 'Selesai!');
                const index = activeProcesses.indexOf(command);
                if (index > -1) activeProcesses.splice(index, 1);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                sendLog('ERROR', `Gagal merge video+audio: ${err.message}`);
                if (stderr) {
                    sendLog('ERROR', `FFmpeg stderr: ${stderr}`);
                }
                const index = activeProcesses.indexOf(command);
                if (index > -1) activeProcesses.splice(index, 1);
                reject(err);
            });

        activeProcesses.push(command);
        command.run();
    });
}

// Main process
async function processVideo(options, sendLog, sendProgress) {
    const {
        bahanFolder,
        outputFolder,
        selectedVideo,
        audioCount,
        randomAudio,
        transition,
        audioFiles
    } = options;

    try {
        sendLog('INFO', '═══════════════════════════════════════');
        sendLog('INFO', 'START PROCESSING');
        sendLog('INFO', `Video: ${selectedVideo.name}`);
        sendLog('INFO', '═══════════════════════════════════════');

        const tempDir = path.join(outputFolder, 'temp_' + Date.now());
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        if (sendProgress) sendProgress(1, 'Analisis...');
        const originalVideoDuration = await getMediaDuration(selectedVideo.path);
        sendLog('INFO', `Durasi video: ${formatDuration(originalVideoDuration)}`);

        if (sendProgress) sendProgress(3, 'Pilih audio...');
        const selectedAudios = selectAudioFiles(audioFiles, audioCount, randomAudio);
        sendLog('INFO', `Dipilih ${selectedAudios.length} audio`);

        if (sendProgress) sendProgress(5, 'Merge audio...');
        // Use .m4a instead of .mp3 because MP3 format doesn't support concat filter output
        const mergedAudioPath = path.join(tempDir, 'merged_audio.m4a');
        await mergeAudioFiles(selectedAudios, mergedAudioPath, sendLog, sendProgress);

        const audioDuration = await getMediaDuration(mergedAudioPath);
        sendLog('INFO', `Total audio: ${formatDuration(audioDuration)}`);

        const loopCount = Math.ceil(audioDuration / originalVideoDuration);

        const mutedVideoPath = path.join(tempDir, 'muted_video.mp4');
        await muteVideo(selectedVideo.path, mutedVideoPath, sendLog, sendProgress);

        const loopedVideoPath = path.join(tempDir, 'looped_video.mp4');
        await loopVideoWithTransition(mutedVideoPath, audioDuration, transition, loopedVideoPath, sendLog, sendProgress);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const finalOutputPath = path.join(outputFolder, `output_NAFFDEV_LOOPING_${timestamp}.mp4`);
        await mergeVideoAudio(loopedVideoPath, mergedAudioPath, finalOutputPath, sendLog, sendProgress);

        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (err) { }

        return {
            success: true,
            outputPath: finalOutputPath,
            stats: {
                audioCount: selectedAudios.length,
                totalAudioDuration: audioDuration.toFixed(2),
                originalVideoDuration: originalVideoDuration.toFixed(2),
                finalVideoDuration: audioDuration.toFixed(2),
                loopCount: loopCount
            }
        };

    } catch (error) {
        sendLog('ERROR', `GAGAL: ${error.message}`);

        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) { }

        throw error;
    }
}

// Abort
function abortAllProcesses() {
    abortRequested = true;

    activeProcesses.forEach(command => {
        try {
            command.kill('SIGKILL');
        } catch (err) { }
    });

    activeProcesses = [];

    setTimeout(() => {
        abortRequested = false;
    }, 1000);
}

module.exports = {
    processVideo,
    getMediaDuration,
    selectAudioFiles,
    mergeAudioFiles,
    muteVideo,
    loopVideoWithTransition,
    mergeVideoAudio,
    abortAllProcesses
};