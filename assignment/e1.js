const fs = require("fs");

// Read the input file
fs.readFile("input.txt", "utf8", function (err, data) {
    if (err) {
        console.log("Error reading file");
        return;
    }

    // Split text into words
    let words = data.split(" ");

    // Count number of words
    let wordCount = words.length;

    // Write the result to a new file
    fs.writeFile("output.txt", "Number of words: " + wordCount, function (err) {
        if (err) {
            console.log("Error writing file");
            return;
        }

        console.log("Word count written to output.txt");
    });
});
