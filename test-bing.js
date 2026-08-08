const axios = require('axios'); 
const cheerio = require('cheerio'); 

axios.get('https://www.bing.com/search?q=site%3Aebay.com+macbook+pro', { 
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' } 
}).then(r => { 
  const $ = cheerio.load(r.data); 
  const items = []; 
  $('.b_algo').each((i, el) => { 
    const title = $(el).find('h2 a').text(); 
    const url = $(el).find('h2 a').attr('href'); 
    const snippet = $(el).find('.b_caption p').text(); 
    items.push({ title, url, snippet }); 
  }); 
  console.log(items); 
}).catch(console.error)
