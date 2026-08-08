const axios = require('axios');
const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=site:ebay.com+macbook+pro');
axios.get(url).then(r => console.log('AllOrigins response length:', r.data.contents.length, r.data.contents.substring(0, 100))).catch(err => console.error(err.message));
