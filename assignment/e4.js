const express = require("express");
const app = express();

app.use(express.json());

let todos = [];
let id = 1;

// CREATE todo
app.post("/todos", (req, res) => {
    const todo = {
        id: id++,
        task: req.body.task
    };
    todos.push(todo);
    res.json(todo);
});

// READ all todos
app.get("/todos", (req, res) => {
    res.json(todos);
});

// UPDATE todo
app.put("/todos/:id", (req, res) => {
    const todo = todos.find(t => t.id == req.params.id);
    if (!todo) {
        return res.status(404).json({ message: "Todo not found" });
    }
    todo.task = req.body.task;
    res.json(todo);
});

// DELETE todo
app.delete("/todos/:id", (req, res) => {
    todos = todos.filter(t => t.id != req.params.id);
    res.json({ message: "Todo deleted" });
});

// Server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
