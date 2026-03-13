const fs = require("fs");

function parseTime(timeStr) {
    let [timeList, modifier] = timeStr.trim().toLowerCase().split(/\s+/);
    let [hours, minutes, seconds] = timeList.split(':').map(Number);
    if (modifier === 'pm' && hours !== 12) {
        hours += 12;
    }
    if (modifier === 'am' && hours === 12) {
        hours = 0;
    }
    return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(totalSeconds) {
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseDuration(durationStr) {
    let [h, m, s] = durationStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

function getShiftDuration(startTime, endTime) {
    let startSec = parseTime(startTime);
    let endSec = parseTime(endTime);
    let duration = endSec - startSec;
    if (duration < 0) {
        duration += 24 * 3600;
    }
    return formatDuration(duration);
}


function getIdleTime(startTime, endTime) {
    let s = parseTime(startTime);
    let e = parseTime(endTime);
    let duration = e - s;
    if (duration < 0) duration += 24 * 3600;

    let deliveryStart = 8 * 3600;
    let deliveryEnd = 22 * 3600;

    let intervals = [];
    if (e < s) {
        intervals.push([s, 24 * 3600]);
        intervals.push([0, e]);
    } else {
        intervals.push([s, e]);
    }

    let activeSeconds = 0;
    for (let [startInterval, endInterval] of intervals) {
        let maxStart = Math.max(startInterval, deliveryStart);
        let minEnd = Math.min(endInterval, deliveryEnd);
        if (maxStart < minEnd) {
            activeSeconds += (minEnd - maxStart);
        }
    }

    let idleSeconds = duration - activeSeconds;
    return formatDuration(idleSeconds);
}


function getActiveTime(shiftDuration, idleTime) {
    let shiftSec = parseDuration(shiftDuration);
    let idleSec = parseDuration(idleTime);
    return formatDuration(shiftSec - idleSec);
}


function metQuota(date, activeTime) {
    let activeSec = parseDuration(activeTime);

    let isEid = false;
    let cleanDate = date.trim();
    if (cleanDate.startsWith("2025-04-")) {
        let day = parseInt(cleanDate.split("-")[2], 10);
        if (day >= 10 && day <= 30) {
            isEid = true;
        }
    }

    let quotaSec = isEid ? 6 * 3600 : (8 * 3600 + 24 * 60);
    return activeSec >= quotaSec;
}


function addShiftRecord(textFile, shiftObj) {
    let content = "";
    try {
        content = fs.readFileSync(textFile, "utf8");
    } catch (err) {
        content = "DriverID,DriverName,Date,StartTime,EndTime,ShiftDuration,IdleTime,ActiveTime,MetQuota,HasBonus\n";
    }

    let lines = content.split(/\r?\n/).filter(line => line.trim() !== "");

    // Check if entry already exists
    for (let i = 1; i < lines.length; i++) {
        let cols = lines[i].split(",");
        if (cols[0] === shiftObj.driverID && cols[2] === shiftObj.date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let isQuotaMet = metQuota(shiftObj.date, activeTime);
    let hasBonus = false;

    let newRow = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        isQuotaMet,
        hasBonus
    ].join(",");

    let insertIndex = -1;
    for (let i = lines.length - 1; i >= 1; i--) {
        let cols = lines[i].split(",");
        if (cols[0] === shiftObj.driverID) {
            insertIndex = i;
            break;
        }
    }

    if (insertIndex !== -1) {
        lines.splice(insertIndex + 1, 0, newRow);
    } else {
        lines.push(newRow);
    }

    fs.writeFileSync(textFile, lines.join("\n") + "\n", "utf8");

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota: isQuotaMet,
        hasBonus
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    // TODO: Implement this function
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
