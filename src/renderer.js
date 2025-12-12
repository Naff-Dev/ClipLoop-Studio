// ================================
// Renderer Process - UI Logic (Fixed)
// ================================

// State
let state = {
    bahanFolder: null,
    outputFolder: null,
    videos: [],
    audios: [],
    selectedVideo: null,
    isProcessing: false,
    startTime: null,
    processStats: {},
    abortRequested: false
};

// DOM Elements
const elements = {
    bahanFolder: document.getElementById('bahanFolder'),
    outputFolder: document.getElementById('outputFolder'),
    btnSelectBahan: document.getElementById('btnSelectBahan'),
    btnSelectOutput: document.getElementById('btnSelectOutput'),
    videoSelect: document.getElementById('videoSelect'),
    videoHint: document.getElementById('videoHint'),
    audioCount: document.getElementById('audioCount'),
    audioHint: document.getElementById('audioHint'),
    randomAudio: document.getElementById('randomAudio'),
    transitionSelect: document.getElementById('transitionSelect'),
    btnProcess: document.getElementById('btnProcess'),
    btnText: document.querySelector('.btn-text'),
    btnLoader: document.querySelector('.btn-loader'),
    logContainer: document.getElementById('logContainer'),
    btnClearLogs: document.getElementById('btnClearLogs'),
    btnDonation: document.getElementById('btnDonation'),
    donationModal: document.getElementById('donationModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    qrisImage: document.getElementById('qrisImage'),
    qrisFallback: document.getElementById('qrisFallback'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressRuler: document.getElementById('progressRuler'),
    progressStages: document.getElementById('progressStages'),
    btnStop: document.getElementById('btnStop')
};

// ================================
// Event Listeners
// ================================

// Select Bahan Folder
elements.btnSelectBahan.addEventListener('click', async () => {
    const folderPath = await window.electronAPI.selectFolder('Pilih Folder Bahan');

    if (folderPath) {
        state.bahanFolder = folderPath;
        elements.bahanFolder.value = folderPath;
        addLog('INFO', `Folder bahan dipilih: ${folderPath}`);

        // Scan the folder
        await scanBahanFolder(folderPath);
        checkFormValidity();
    }
});

// Select Output Folder
elements.btnSelectOutput.addEventListener('click', async () => {
    const folderPath = await window.electronAPI.selectFolder('Pilih Folder Output');

    if (folderPath) {
        state.outputFolder = folderPath;
        elements.outputFolder.value = folderPath;
        addLog('INFO', `Folder output dipilih: ${folderPath}`);
        checkFormValidity();
    }
});

// Video Selection Change
elements.videoSelect.addEventListener('change', (e) => {
    const selectedIndex = parseInt(e.target.value);

    if (!isNaN(selectedIndex) && state.videos[selectedIndex]) {
        state.selectedVideo = state.videos[selectedIndex];
        addLog('INFO', `Video dipilih: ${state.selectedVideo.name}`);
    } else {
        state.selectedVideo = null;
    }

    checkFormValidity();
});

// Audio Count Change
elements.audioCount.addEventListener('change', () => {
    checkFormValidity();
});

// Process Button
elements.btnProcess.addEventListener('click', async () => {
    if (state.isProcessing) return;

    // Validate
    if (!validateForm()) {
        addLog('ERROR', 'Mohon lengkapi semua field yang diperlukan!');
        return;
    }

    // Start processing
    await startProcessing();
});

// Stop Button
elements.btnStop.addEventListener('click', async () => {
    if (state.isProcessing) {
        state.abortRequested = true;
        addLog('WARNING', 'Menghentikan proses...');
        elements.btnStop.disabled = true;
        elements.btnStop.textContent = '⏳ Stopping...';

        // Call abort API
        try {
            await window.electronAPI.abortProcessing();
            addLog('WARNING', 'Proses dihentikan oleh user');
        } catch (err) {
            addLog('ERROR', 'Gagal menghentikan proses');
        }
    }
});

// Clear Logs
elements.btnClearLogs.addEventListener('click', () => {
    elements.logContainer.innerHTML = '';
    addLog('INFO', 'Log dibersihkan');
});

// Donation Modal
elements.btnDonation.addEventListener('click', () => {
    elements.donationModal.classList.add('active');
});

elements.btnCloseModal.addEventListener('click', () => {
    elements.donationModal.classList.remove('active');
});

// Close modal on overlay click
elements.donationModal.addEventListener('click', (e) => {
    if (e.target === elements.donationModal) {
        elements.donationModal.classList.remove('active');
    }
});

// Check if QRIS image exists
elements.qrisImage.addEventListener('error', () => {
    elements.qrisImage.style.display = 'none';
    elements.qrisFallback.style.display = 'block';
});

// ================================
// Functions
// ================================

// Scan Bahan Folder
async function scanBahanFolder(folderPath) {
    try {
        addLog('INFO', '🔍 Memindai folder...');

        const result = await window.electronAPI.scanFolder(folderPath);

        state.videos = result.videos;
        state.audios = result.audios;

        addLog('SUCCESS', `✓ Ditemukan ${result.videos.length} video dan ${result.audios.length} file audio`);

        // Populate video dropdown
        elements.videoSelect.innerHTML = '<option value="">-- Pilih video --</option>';
        result.videos.forEach((video, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = video.name;
            elements.videoSelect.appendChild(option);
        });

        // Update hints
        if (result.videos.length > 0) {
            elements.videoHint.textContent = `${result.videos.length} video(s) tersedia`;
            elements.videoSelect.disabled = false;
        } else {
            elements.videoHint.textContent = 'Tidak ada video ditemukan';
            elements.videoSelect.disabled = true;
        }

        if (result.audios.length > 0) {
            elements.audioHint.textContent = `${result.audios.length} audio tersedia`;
            elements.audioCount.disabled = false;
            elements.audioCount.max = result.audios.length;
            elements.randomAudio.disabled = false;
            elements.transitionSelect.disabled = false;
        } else {
            elements.audioHint.textContent = 'Tidak ada audio ditemukan';
            elements.audioCount.disabled = true;
            elements.randomAudio.disabled = true;
            elements.transitionSelect.disabled = true;
        }

    } catch (error) {
        addLog('ERROR', `❌ Gagal memindai folder: ${error.message}`);
        console.error('Scan error:', error);
    }
}

// Validate Form
function validateForm() {
    if (!state.bahanFolder) return false;
    if (!state.outputFolder) return false;
    if (!state.selectedVideo) return false;
    if (state.audios.length === 0) return false;

    const audioCount = parseInt(elements.audioCount.value);
    if (isNaN(audioCount) || audioCount < 1) {
        return false;
    }

    // Ensure audio count doesn't exceed available audios
    if (audioCount > state.audios.length) {
        elements.audioCount.value = state.audios.length;
        return false;
    }

    return true;
}

// Check Form Validity
function checkFormValidity() {
    const isValid = validateForm();
    elements.btnProcess.disabled = !isValid || state.isProcessing;
}

// Start Processing
async function startProcessing() {
    state.isProcessing = true;
    state.startTime = Date.now();
    state.abortRequested = false;

    // Update button UI
    elements.btnProcess.classList.add('processing');
    elements.btnText.style.display = 'none';
    elements.btnLoader.style.display = 'inline';
    elements.btnProcess.disabled = true;

    // Show stop button
    elements.btnStop.style.display = 'block';
    elements.btnStop.disabled = false;
    elements.btnStop.textContent = '⛔ Stop';

    // Show progress bar
    elements.progressContainer.style.display = 'block';
    updateProgress(0, 'Memulai...');

    // Disable all inputs
    setInputsDisabled(true);

    try {
        const options = {
            bahanFolder: state.bahanFolder,
            outputFolder: state.outputFolder,
            selectedVideo: state.selectedVideo,
            audioCount: parseInt(elements.audioCount.value),
            randomAudio: elements.randomAudio.checked,
            transition: elements.transitionSelect.value,
            audioFiles: state.audios
        };

        addLog('INFO', '');
        addLog('SUCCESS', '╔═══════════════════════════════════════════════════════╗');
        addLog('SUCCESS', '      [APLIKASI BY NAFF DEV 100% FREE]');
        addLog('SUCCESS', '╚═══════════════════════════════════════════════════════╝');
        addLog('INFO', '');
        addLog('INFO', '🚀 Memulai Proses Video...');
        addLog('INFO', '');

        const result = await window.electronAPI.processVideo(options);

        if (result.success) {
            // Calculate processing time
            const endTime = Date.now();
            const processingTime = ((endTime - state.startTime) / 1000).toFixed(2);

            updateProgress(100, 'Selesai!');
            updateStage('done', 'completed');

            // Show detailed summary
            addLog('SUCCESS', '');
            addLog('SUCCESS', '✓ BERHASIL!');
            addLog('SUCCESS', '╔═══════════════════════════════════════════════════════╗');
            addLog('INFO', `🎵 Data: ${result.stats.audioCount} audio digabung = ${formatDuration(result.stats.totalAudioDuration)}`);
            addLog('INFO', `🎬 Video awal: ${formatDuration(result.stats.originalVideoDuration)}`);
            addLog('INFO', `🔁 Setelah looping: ${formatDuration(result.stats.finalVideoDuration)} (${result.stats.loopCount}x)`);
            addLog('INFO', `⏱️  Waktu proses: ${formatDuration(processingTime)}`);
            addLog('INFO', `📁 Output: ${result.outputPath}`);
            addLog('SUCCESS', '╚═══════════════════════════════════════════════════════╝');
            addLog('SUCCESS', '        PROSES SELESAI! TERIMA KASIH!');
            addLog('SUCCESS', '╚═══════════════════════════════════════════════════════╝');
        }

    } catch (error) {
        addLog('ERROR', `❌ Proses gagal: ${error.message}`);
        addLog('ERROR', 'Silakan coba lagi atau hubungi developer');
        console.error('Processing error:', error);
        updateProgress(0, 'Error!');

        // Show error summary
        setTimeout(() => {
            addLog('WARNING', '═══════════════════════════════════════');
            addLog('WARNING', 'Tips troubleshooting:');
            addLog('WARNING', '1. Pastikan video dan audio tidak corrupt');
            addLog('WARNING', '2. Pastikan folder output bisa di-write');
            addLog('WARNING', '3. Restart aplikasi jika perlu');
            addLog('WARNING', '═══════════════════════════════════════');
        }, 500);
    } finally {
        // Reset button UI
        state.isProcessing = false;
        state.abortRequested = false;
        elements.btnProcess.classList.remove('processing');
        elements.btnText.style.display = 'inline';
        elements.btnLoader.style.display = 'none';

        // Hide stop button
        elements.btnStop.style.display = 'none';
        elements.btnStop.disabled = true;

        // Hide progress bar after 5 seconds
        setTimeout(() => {
            elements.progressContainer.style.display = 'none';
            resetProgress();
        }, 5000);

        // Re-enable inputs
        setInputsDisabled(false);
        checkFormValidity();
    }
}

// Update Progress Bar with Ruler
function updateProgress(percent, text) {
    percent = Math.min(100, Math.max(0, percent)); // Clamp between 0-100

    // Update progress bar
    elements.progressFill.style.width = percent + '%';
    elements.progressPercent.textContent = Math.round(percent) + '%';
    elements.progressText.textContent = text;

    // Update ruler marks
    if (elements.progressRuler) {
        const marks = elements.progressRuler.querySelectorAll('.ruler-mark');
        marks.forEach(mark => {
            const value = parseInt(mark.dataset.value);
            if (value <= percent) {
                mark.classList.add('active');
            } else {
                mark.classList.remove('active');
            }
        });
    }

    // Update stages based on progress
    updateStagesByProgress(percent);
}

// Update stages based on progress percentage
function updateStagesByProgress(percent) {
    const stages = ['scan', 'audio', 'video', 'merge', 'done'];
    const thresholds = [0, 5, 25, 70, 100];

    stages.forEach((stage, index) => {
        const stageElement = elements.progressStages?.querySelector(`[data-stage="${stage}"]`);
        if (!stageElement) return;

        if (percent >= thresholds[index]) {
            stageElement.classList.remove('active');
            stageElement.classList.add('completed');
        } else if (percent >= (thresholds[index - 1] || 0)) {
            stageElement.classList.add('active');
            stageElement.classList.remove('completed');
        } else {
            stageElement.classList.remove('active', 'completed');
        }
    });
}

// Update specific stage
function updateStage(stage, status) {
    const stageElement = elements.progressStages?.querySelector(`[data-stage="${stage}"]`);
    if (!stageElement) return;

    stageElement.classList.remove('active', 'completed');
    if (status === 'active') {
        stageElement.classList.add('active');
    } else if (status === 'completed') {
        stageElement.classList.add('completed');
    }
}

// Reset progress
function resetProgress() {
    if (elements.progressRuler) {
        const marks = elements.progressRuler.querySelectorAll('.ruler-mark');
        marks.forEach(mark => mark.classList.remove('active'));
    }

    if (elements.progressStages) {
        const stages = elements.progressStages.querySelectorAll('.stage');
        stages.forEach(stage => stage.classList.remove('active', 'completed'));
    }
}

// Set Inputs Disabled State
function setInputsDisabled(disabled) {
    elements.btnSelectBahan.disabled = disabled;
    elements.btnSelectOutput.disabled = disabled;
    elements.videoSelect.disabled = disabled || state.videos.length === 0;
    elements.audioCount.disabled = disabled || state.audios.length === 0;
    elements.randomAudio.disabled = disabled || state.audios.length === 0;
    elements.transitionSelect.disabled = disabled || state.audios.length === 0;
}

// Add Log Entry (Enhanced with better error handling)
function addLog(level, message) {
    try {
        // Ensure log container exists
        if (!elements.logContainer) {
            console.error('Log container not found!');
            return;
        }

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level.toLowerCase()}`;

        // Get current time
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

        // Create log elements
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = timeStr;

        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-level';
        levelSpan.textContent = `[${level}]`;

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;

        // Append elements
        logEntry.appendChild(timeSpan);
        logEntry.appendChild(levelSpan);
        logEntry.appendChild(messageSpan);

        // Add to container
        elements.logContainer.appendChild(logEntry);

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
        });

    } catch (error) {
        // Silent fail to prevent error loops
    }
}

// Format duration helper for renderer process
function formatDuration(seconds) {
    // Validate input
    if (seconds === null || seconds === undefined || seconds === '') {
        return '0s';
    }

    const sec = typeof seconds === 'string' ? parseFloat(seconds) : seconds;

    // Handle invalid numbers
    if (isNaN(sec) || sec < 0) {
        return '0s';
    }

    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// ================================
// Listen for IPC Events
// ================================

// Listen for logs from main process
if (window.electronAPI && window.electronAPI.onLog) {
    window.electronAPI.onLog((data) => {
        if (data && data.level && data.message) {
            addLog(data.level, data.message);
        }
    });
}

// Listen for progress updates
if (window.electronAPI && window.electronAPI.onProgress) {
    window.electronAPI.onProgress((data) => {
        if (data && typeof data.percent === 'number' && data.text) {
            updateProgress(data.percent, data.text);
        }
    });
}

// ================================
// Initial State
// ================================

// Cleanup on window unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
    if (window.electronAPI && window.electronAPI.removeLogListener) {
        window.electronAPI.removeLogListener();
    }
});

addLog('INFO', '✓ Aplikasi siap digunakan!');
addLog('INFO', '📂 Pilih folder untuk memulai...');