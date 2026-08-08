const axios = require('axios');
const fs = require('fs');
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
axios.get('https://search.yahoo.com/search?p=' + encodeURIComponent('site:ebay.com macbook pro m2'), { headers }).then(r => fs.writeFileSync('yahoo.html', r.data)).catch(err => console.error(err.message));
