app.post('/authors', (req, res) => {
    const newAuthor = {
        id: authorsDatabase.length > 0 ? authorsDatabase[authorsDatabase.length - 1].id + 1 : 1,
        name: req.body.name,
        nationality: req.body.nationality
    };
    authorsDatabase.push(newAuthor);
    res.status(201).json(newAuthor);
});

app.get('/authors', (req, res) => {
    res.status(200).json(authorsDatabase);
});

app.get('/authors/:id', (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const foundAuthor = authorsDatabase.find(author => author.id === targetId);
    
    if (!foundAuthor) {
        return res.status(404).json({ error: 'Author Not Found' });
    }
    
    res.status(200).json(foundAuthor);
});

app.put('/authors/:id', (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const authorIndex = authorsDatabase.findIndex(author => author.id === targetId);
    
    if (authorIndex === -1) {
        return res.status(404).json({ error: 'Author Not Found' });
    }
    
    authorsDatabase[authorIndex] = {
        ...authorsDatabase[authorIndex],
        ...req.body,
        id: targetId 
    };
    
    res.status(200).json(authorsDatabase[authorIndex]);
});

app.delete('/authors/:id', (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const authorIndex = authorsDatabase.findIndex(author => author.id === targetId);
    
    if (authorIndex === -1) {
        return res.status(404).json({ error: 'Author Not Found' });
    }
    
    const removedAuthor = authorsDatabase.splice(authorIndex, 1);
    res.status(200).json(removedAuthor[0]);
});