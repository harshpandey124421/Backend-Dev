const validateYearMiddleware = (req, res, next) => {
    const inputYear = req.body.year || req.query.year;
    
    if (inputYear !== undefined) {
        const numericYear = Number(inputYear);
        const currentYear = new Date().getFullYear();
        
        if (Number.isNaN(numericYear) || numericYear < 1000 || numericYear > currentYear) {
            return res.status(400).json({ 
                error: 'Validation Error', 
                message: 'Year must be a valid number between 1000 and the current year.' 
            });
        }
    }
    next();
};