const os = require("os");
const fs = require("fs");

function logSystemInfo() {
    const cpu = os.cpus().length;
    const totalMemory = (os.totalmem() / (1024 * 1024)).toFixed(2); // MB
    const freeMemory = (os.freemem() / (1024 * 1024)).toFixed(2);   // MB
    const platform = os.platform();
    const time = new Date().toLocaleString();

    const logData = `
Time: ${time}
Platform: ${platform}
CPU Cores: ${cpu}
Total Memory: ${totalMemory} MB
Free Memory: ${freeMemory} MB
-------------------------
`;

    fs.appendFile("systemInfo.log", logData, (err) => {
        if (err) {
            console.log("Error writing to file");
        }
    });
}

setInterval(logSystemInfo, 5000);
