const axios = require('axios');
const cheerio = require('cheerio');
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};
const query = encodeURIComponent(`(site:ebay.com OR site:mercari.com OR site:poshmark.com) macbook pro`);
axios.get(`https://html.duckduckgo.com/html/?q=${query}`, { headers }).then(res => {
  const $ = cheerio.load(res.data);
  const items = [];
  $('.result').each((i, el) => {
    items.push($(el).find('.result__title a').text().trim());
  });
  console.log(items);
}).catch(console.error);
