const fs = require("fs");
const { Transform } = require("stream");

const upperCase =new Transform({
    transform(chunk, encoding, callback){
        let upperCase= chunk.toString().toUpperCase();
        callback(null, upperCase);
    }
})
const vowelReplace =new Transform({
    transform(chunk, encoding, callback){
        let vowel= chunk.toString().replace(/[AEIOU]/g,'*');
        callback(null, vowel);
    }
})


const readStream = fs.createReadStream("./output.txt")
const writeStream = fs.createWriteStream("./copyUpperCaseinput.txt");

readStream.pipe(upperCase).pipe(vowelReplace).pipe(writeStream);
