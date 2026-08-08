const axios = require('axios');
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};
axios.get('https://html.duckduckgo.com/html/?q=' + encodeURIComponent('(site:ebay.com OR site:mercari.com OR site:poshmark.com) macbook pro'), { headers }).then(r => console.log('Status:', r.status)).catch(err => console.error(err.response ? err.response.status : err.message));
