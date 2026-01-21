const http = require("http");
const fs = require("fs");

const myServer = http.createServer((req, res) => {

  const log = `${Date.now()}: ${req.url} New Req received\n`;

  fs.appendFile("NodeJs/log.txt", log, (err) => {
    if (err) {
      console.log("Error writing log:", err);
    }

    switch (req.url) {
      case "/":
        res.end("Home page");
        break;
      case "/about":
        res.end("About page");
        break;
      case "/contact":
        res.end("Contact page");
        break;
      default:
        res.end("404 page Not Found");
        break;
    }
  });
});

myServer.listen(8000, () => console.log("Server Started")); 