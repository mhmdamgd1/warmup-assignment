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

function formatTotalDuration(totalSeconds) {
    let sign = "";
    if (totalSeconds < 0) {
        sign = "-";
        totalSeconds = -totalSeconds;
    }
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    return `${sign}${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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


function setBonus(textFile, driverID, date, newValue) {
    let content = fs.readFileSync(textFile, "utf8");
    let lines = content.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") continue;
        let cols = lines[i].split(",");
        if (cols[0] === driverID && cols[2] === date) {
            cols[9] = newValue.toString(); // hasBonus is at index 9
            lines[i] = cols.join(",");
            break;
        }
    }
    fs.writeFileSync(textFile, lines.join("\n"), "utf8");
}


function countBonusPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, "utf8");
    let lines = content.split(/\r?\n/);
    let driverExists = false;
    let bonusCount = 0;

    let targetMonth = month.toString().padStart(2, '0');

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") continue;
        let cols = lines[i].split(",");
        let cDriverID = cols[0];
        let cDate = cols[2];
        let cHasBonus = cols[9];

        if (cDriverID === driverID) {
            driverExists = true;
            let cMonth = cDate.split("-")[1];
            if (cMonth === targetMonth && cHasBonus.trim().toLowerCase() === "true") {
                bonusCount++;
            }
        }
    }

    return driverExists ? bonusCount : -1;
}


function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, "utf8");
    let lines = content.split(/\r?\n/);
    let totalSeconds = 0;
    let targetMonth = month.toString().padStart(2, '0');

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") continue;
        let cols = lines[i].split(",");
        let cDriverID = cols[0];
        let cDate = cols[2];
        let cActiveTime = cols[7];

        if (cDriverID === driverID) {
            let cMonth = cDate.split("-")[1];
            if (cMonth === targetMonth) {
                totalSeconds += parseDuration(cActiveTime);
            }
        }
    }

    return formatTotalDuration(totalSeconds);
}


function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let rateContent = fs.readFileSync(rateFile, "utf8");
    let rateLines = rateContent.split(/\r?\n/);
    let dayOff = "";

    for (let i = 0; i < rateLines.length; i++) {
        if (rateLines[i].trim() === "") continue;
        let cols = rateLines[i].split(",");
        if (cols[0] === driverID) {
            dayOff = cols[1].trim().toLowerCase();
            break;
        }
    }

    let shiftContent = fs.readFileSync(textFile, "utf8");
    let shiftLines = shiftContent.split(/\r?\n/);
    let targetMonth = month.toString().padStart(2, '0');

    let daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let requiredSeconds = 0;

    for (let i = 1; i < shiftLines.length; i++) {
        if (shiftLines[i].trim() === "") continue;
        let cols = shiftLines[i].split(",");
        let cDriverID = cols[0];
        let cDate = cols[2];

        if (cDriverID === driverID) {
            let parts = cDate.split("-");
            let cYear = parseInt(parts[0], 10);
            let cMonth = parts[1];
            let cDay = parseInt(parts[2], 10);

            if (cMonth === targetMonth) {
                let dateObj = new Date(Date.UTC(cYear, parseInt(cMonth, 10) - 1, cDay));
                let shiftDayName = daysOfWeek[dateObj.getUTCDay()];

                if (shiftDayName !== dayOff) {
                    let isEid = false;
                    if (cYear === 2025 && cMonth === "04" && cDay >= 10 && cDay <= 30) {
                        isEid = true;
                    }
                    if (isEid) {
                        requiredSeconds += 6 * 3600;
                    } else {
                        requiredSeconds += 8 * 3600 + 24 * 60;
                    }
                }
            }
        }
    }

    requiredSeconds -= bonusCount * 2 * 3600;
    if (requiredSeconds < 0) requiredSeconds = 0;

    return formatTotalDuration(requiredSeconds);
}


function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let rateContent = fs.readFileSync(rateFile, "utf8");
    let rateLines = rateContent.split(/\r?\n/);

    let basePay = 0;
    let tier = 1;
    for (let i = 0; i < rateLines.length; i++) {
        if (rateLines[i].trim() === "") continue;
        let cols = rateLines[i].split(",");
        if (cols[0] === driverID) {
            basePay = parseInt(cols[2], 10);
            tier = parseInt(cols[3], 10);
            break;
        }
    }

    let actualSec = parseDuration(actualHours);
    let requiredSec = parseDuration(requiredHours);

    let missingSec = requiredSec - actualSec;
    if (missingSec <= 0) {
        return basePay;
    }

    let allowedHours = 0;
    if (tier === 1) allowedHours = 50;
    else if (tier === 2) allowedHours = 20;
    else if (tier === 3) allowedHours = 10;
    else if (tier === 4) allowedHours = 3;

    let allowedSec = allowedHours * 3600;
    missingSec -= allowedSec;

    if (missingSec <= 0) {
        return basePay;
    }

    let billableMissingHours = Math.floor(missingSec / 3600);
    let deductionRate = Math.floor(basePay / 185);
    let salaryDeduction = billableMissingHours * deductionRate;

    return basePay - salaryDeduction;
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
