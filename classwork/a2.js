
const http = require("http");
const fs = require("fs");
const path = require("path");

const myServer = http.createServer((req, res) => {

    const log = `${Date.now()} : ${req.url} New request received\n`;

    const logPath = path.join(__dirname, "week2", "log.txt");

    fs.appendFile(logPath, log, (err) => {
        if (err) {
            console.error("Logging error:", err);
        }

        switch (req.url) {
            case "/":
                res.end("home page");
                break;

            case "/about":
                res.end("about page");
                break;

            case "/contact":
                res.end("contact page");
                break;

            default:
                res.end("page not found");
        }
    });
});

myServer.listen(3000, () => {
    console.log("Server is on port 3000");
});
