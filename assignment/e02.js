// Function to capitalize a string
function capitalize(str) {
    return str.toUpperCase();
}

// Function to reverse a string
function reverseString(str) {
    return str.split("").reverse().join("");
}

// Function to count vowels in a string
function countVowels(str) {
    let count = 0;
    let vowels = "aeiouAEIOU";

    for (let i = 0; i < str.length; i++) {
        if (vowels.includes(str[i])) {
            count++;
        }
    }
    return count;
}

// Exporting functions
module.exports = {
    capitalize,
    reverseString,
    countVowels
};
