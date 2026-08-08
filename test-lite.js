const axios = require('axios');
const headers = { 
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
  'Content-Type': 'application/x-www-form-urlencoded' 
}; 
axios.post('https://lite.duckduckgo.com/lite/', 'q=macbook+pro', { headers }).then(r => console.log('Lite length:', r.data.length, r.data.substring(0, 100))).catch(err => console.error(err.message));
