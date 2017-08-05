const nconf = require('nconf');
const { send } = require('micro');
const { router, get } = require('microrouter');
const hn = require('./hackernews');
const Memcached = require('memcached');

nconf.argv()
  .env()
  .file('config.json')
  .defaults({
    cache: {
      expiry: 60*10, // 10 minutes
      interval: 1000*60*5, // 5 minutes
    }
  });

const memcached = new Memcached(nconf.get('cache:location'), nconf.get('cache:options'));

module.exports = router(
  get('/', () => {
    return {
      name: 'node-hnapi-helper',
      process: {
        versions: process.versions,
        memoryUsage: process.memoryUsage()
      }
    };
  }),
  get('/news', hn.news),
  get('/news2', hn.news2),
  get('/item/:id', (req, res) => {
    const { id } = req.params;
    return id ? hn.item(id) : {};
  }),
  get('/newest', hn.newest),
  get('/show', hn.show),
  get('/ask', hn.ask),
  get('/jobs', hn.jobs),
  get('/cache/:key', async (req, res) => {
    const { key } = req.params;
    return await new Promise((resolve, reject) => {
      memcached.get(key, function(err, data){
        if (err) reject(err);
        resolve(data);
      });
    });
  }),
  get('/everything', hn.items),
);

// Caching time!
const interval = nconf.get('cache:interval');
const expiry = nconf.get('cache:expiry');
const now = () => new Date().toISOString();
function cacheTime(){
  console.log(now() + ': Start caching');

  newsLengths = ['news', 'news2', 'newest', 'show', 'ask'/*, 'jobs'*/].map(page => {
    const news = hn[page]();
    if (news.length) memcached.set(page, news, expiry, function(){
      console.log(now() + ': Cache ' + page);
    });
    return news.length;
  });

  const items = hn.items();
  if (items.length) items.forEach(function(item){
    const id = item.id;
    if (id) memcached.set('post' + id, item, expiry, function(){
      console.log(now() + ': Cache item ' + id);
    });
  });

  if (newsLengths.some(length => length <= 0) || !items.length){
    setTimeout(cacheTime, 5000); // If something is wrong, update faster
  } else {
    setTimeout(cacheTime, interval);
  }
}
setTimeout(cacheTime, 5000);
