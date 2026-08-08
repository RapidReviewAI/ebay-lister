const google = require('googlethis');
const options = {
  page: 0, 
  safe: false, // Safe Search
  parse_ads: false, // If set to true sponsored results will be parsed
  additional_params: { 
    // add additional parameters here, see https://moz.com/blog/the-ultimate-guide-to-the-google-search-parameters and https://www.seobythesea.com/2012/01/google-search-url-parameters-query-string-anatomy/ for more information.
    hl: 'en' 
  }
}
google.search('site:ebay.com macbook pro', options).then(console.log).catch(console.error);
