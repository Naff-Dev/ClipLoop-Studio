/**
 * Format duration from seconds to human-readable format
 * @param {number|string} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
    // Validate input
    if (seconds === null || seconds === undefined || seconds === '') {
        return '0 detik';
    }

    const sec = parseFloat(seconds);

    // Handle invalid numbers
    if (isNaN(sec) || sec < 0) {
        return '0 detik';
    }

    // Less than 1 minute
    if (sec < 60) {
        return `${sec.toFixed(2)} detik`;
    }

    // Less than 1 hour
    if (sec < 3600) {
        const minutes = Math.floor(sec / 60);
        const remainingSeconds = Math.floor(sec % 60);

        if (remainingSeconds === 0) {
            return `${minutes} menit`;
        }
        return `${minutes} menit ${remainingSeconds} detik`;
    }

    // 1 hour or more
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const remainingSeconds = Math.floor(sec % 60);

    let result = `${hours} jam`;
    if (minutes > 0) {
        result += ` ${minutes} menit`;
    }
    if (remainingSeconds > 0) {
        result += ` ${remainingSeconds} detik`;
    }

    return result;
}

/**
 * Validate if path exists and is accessible
 * @param {string} filePath - Path to validate
 * @returns {boolean} True if valid
 */
function isValidPath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }

    try {
        const fs = require('fs');
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

module.exports = {
    formatDuration,
    isValidPath
};
