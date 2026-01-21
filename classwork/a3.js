const http = require("http");
const fs = require("fs");

const myServer = http.createServer((req, res) => {
  const log = `${Date.now()}: ${req.url} New Req received\n`;

  fs.appendFile("log.txt", log, (err) => {
    if (err) {
      console.log("Error writing log");
    }

    // normalize URL
    const url = req.url.toLowerCase();

    switch (url) {
      case "/":
        res.end("Home page");
        break;

      case "/about":
        res.end("this is about page");
        break;
        //case "/This is about page":
            //res.end("this is about page");
           // break;

      case "/contact":
        res.end("Contact page");
        break;

      default:
        res.end("404 page Not Found");
    }
  });
});

myServer.listen(5000, () => {
  console.log("Server started on port 5000");
});
