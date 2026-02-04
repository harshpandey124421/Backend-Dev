server.js

import express from 'express';
const app = express();
import {userData} from "./data.js"
app.use(express.json());   //This is middleware
import {mid1, validationPost} from "./middleware.js"
app.use(mid1);


app.get("/", (req, res) => {
    return res.send("Home route");
});

app.get("/user", (req, res) => {
    let user= {
        name: "John Doe",
        age: 30,
        course: "Btech",
    }
    
    return res.json(userData);
});

app.get("/user/1",(req,res)=>{
    return res.json(userData[1])
})

app.get("/user/:id",(req,res)=>{
    const id= parseInt(req.params.id);
    const user= userData.find((usr)=> usr.id == id);
    if(!user){
        res.json({
            message: "User not found",
        })

    }
    return res.json(user);


})


//http://localhost:3000/search?name=John&password=qwert
app.get("/search", (req, res) => {
    const name= req.query.name;
    const password= req.query.password;
    console.log(req.query);
    res.send({
        name,password
    });

});

app.get("/admin", (req, res) => {
    return res.send("Admin route");
});
app.get("/profile", (req, res) => {
    return res.send("Profile route");
});

//POST


// app.post("/user", (req, res) => {
//     let userData = req.body;
//     console.log(userData);
//     res.send({
//         message: "Data received successfully",
//         data: userData,
//     });
// });



app.post("/user",validationPost ,(req, res) => {
    let{name, city}= req.body;
    let newUser= {
        id: userData.length + 1,
        name:name,
        city:city,
    }
    userData.push(newUser);
    res.status(200).send("User added successfully");
});






app.listen(3000, () => console.log("Server is running on port 3000"));