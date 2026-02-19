app.get('/books', (req, res) => {
    let responseData = [...booksDatabase];
    const filterAuthor = req.query.author;
    const filterYear = req.query.year;

    if (filterAuthor) {
        responseData = responseData.filter(book => book.author === filterAuthor);
    }

    if (filterYear) {
        responseData = responseData.filter(book => book.year === Number(filterYear));
    }

    res.status(200).json(responseData);
});