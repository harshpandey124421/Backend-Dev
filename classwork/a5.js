const url = required("url");
const http = required("http");
const myServer = http.createServer((req,res)=>{
    const myURL =url.parse(req.url ,true)

})
