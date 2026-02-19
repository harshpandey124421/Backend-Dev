app.get('/books/search', (req, res) => {
    const titleQuery = req.query.title;
    
    if (!titleQuery) {
        return res.status(400).json({ 
            error: 'Missing parameter', 
            message: 'Title query parameter is required for searching.' 
        });
    }

    const filteredBooks = booksDatabase.filter(book => 
        book.title.toLowerCase().includes(titleQuery.toLowerCase())
    );

    res.status(200).json(filteredBooks);
});