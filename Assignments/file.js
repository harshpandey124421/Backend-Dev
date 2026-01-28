const fs=require('fs');
const path=require('path');

// const filePath=path.join(__dirname,'sample.txt');

// fs.readFile(filePath,'utf8',(err,data)=>{
//     if(err) throw err;
//     console.log('File content:',data);
// });

// const readStream=fs.createReadStream(filePath,{
//     highWaterMark:64
// });

// readStream.on("data",(chunk)=>{         //nodejs event based programming
//     console.log("New chunk received:");
//     console.log(chunk.toString());
// })

// readStream.on("end",()=>{
//     console.log("data finish")
// }) 

const writeStream=fs.createWriteStream("./output.txt",{
    flags:'a'  
})
writeStream.write("Hello World\n");
writeStream.write("This is a write stream example.\n");
writeStream.end("Stream ended.\n");

writeStream.end();

writeStream.on("finish",()=>{
    console.log("written done.")
})