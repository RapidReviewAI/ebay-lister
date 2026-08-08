const axios = require('axios');
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
axios.get('https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=site:ebay.com+macbook+pro'), { headers, timeout: 15000 }).then(r => console.log('AllOrigins response length:', r.data.contents.length, r.data.contents.substring(0, 100))).catch(err => console.error(err.message));
