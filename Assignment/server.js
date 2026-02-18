const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const users = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    { id: 3, name: 'Alice Johnson' }
];

let posts = [
    { id: 1, title: 'First Post', content: 'This is my first blog post.' },
    { id: 2, title: 'Hello World', content: 'Node.js is fun to learn.' }
];

// --- QUESTION 2: Middleware to log response time ---
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const timeTaken = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} - ${timeTaken}ms`);
    });
    next();
});

// --- QUESTION 1: Route to filter users by name ---
app.get('/users', (req, res) => {
    const { name } = req.query;
    if (name) {
        const filtered = users.filter(user => 
            user.name.toLowerCase().includes(name.toLowerCase())
        );
        return res.json(filtered);
    }
    res.json(users);
});

// --- QUESTION 3: Contact Form (GET and POST) ---
app.get('/contact', (req, res) => {
    res.render('contact');
});

app.post('/contact', (req, res) => {
    console.log('Form received:', req.body);
    res.send('<h1>Thank you! Your message has been sent.</h1>');
});

// --- QUESTION 5: Photo Gallery (using static files) ---
app.get('/gallery', (req, res) => {
    const dirPath = path.join(__dirname, 'public/images');
    
    fs.readdir(dirPath, (err, files) => {
        if (err) {
            console.error(err);
            return res.send('Error reading images directory');
        }
        // Filter to only include image files
        const images = files.filter(file => /\.(jpg|jpeg|webp)$/i.test(file));
        res.render('gallery', { images });
    });
});

// --- QUESTION 6: Simple Blog System ---
// List all posts
app.get('/blog', (req, res) => {
    res.render('blog', { posts });
});

app.get('/blog/new', (req, res) => {
    res.render('new-post');
});

app.post('/blog', (req, res) => {
    const { title, content } = req.body;
    posts.push({
        id: posts.length + 1,
        title,
        content
    });
    res.redirect('/blog');
});

app.get('/blog/:id', (req, res) => {
    const post = posts.find(p => p.id === parseInt(req.params.id));
    if (!post) return res.status(404).render('404');
    res.render('post', { post });
});

// --- QUESTION 4: Custom 404 Error Page ---
app.use((req, res) => {
    res.status(404).render('404');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
