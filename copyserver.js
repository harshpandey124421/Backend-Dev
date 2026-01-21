const fs = require("fs");
const readStream = fs.createReadStream("./output.txt")
const writeStream = fs.createWriteStream("./copyinput.txt");

readStream.pipe(writeStream);
