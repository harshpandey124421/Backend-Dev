app.get('/books/paginated', (req, res) => {
    const responseData = [...booksDatabase];
    
    const paginationPage = parseInt(req.query.page, 10) || 1;
    const paginationLimit = parseInt(req.query.limit, 10) || responseData.length;
    const startIndex = (paginationPage - 1) * paginationLimit;
    const endIndex = startIndex + paginationLimit;

    const paginatedData = responseData.slice(startIndex, endIndex);

    res.status(200).json({
        metadata: {
            totalItems: responseData.length,
            currentPage: paginationPage,
            itemsPerPage: paginationLimit,
            totalPages: Math.ceil(responseData.length / paginationLimit) || 1
        },
        data: paginatedData
    });
});