const cheerio = require('cheerio'); 
const fs = require('fs'); 
const html = fs.readFileSync('yahoo.html'); 
const $ = cheerio.load(html); 
$('.compTitle, .title, .lh-24, h3').each((i, el) => { 
  const text = $(el).text(); 
  if (text.toLowerCase().includes('macbook')) console.log(text); 
});
$('.compDesc, .desc, p').each((i, el) => {
  const text = $(el).text();
  if (text.includes('$')) console.log("Price found:", text.substring(0, 50));
});
