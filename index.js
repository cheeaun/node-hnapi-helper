require('dotenv').config();
const { send } = require('micro');
const { router, get } = require('microrouter');
const hn = require('./hackernews');
const Memcached = require('memcached');

const CACHE_INTERVAL = process.env.CACHE_INTERVAL = 1000*60*5; // 5 minutes
const CACHE_EXPIRY = process.env.CACHE_EXPIRY = 60*10; // 10 minutes

const memcached = new Memcached(process.env.CACHE_URL, {
  debug: process.env.CACHE_DEBUG || false,
});

memcached.on('issue', (details) => console.log('ISSUE', details));
memcached.on('failure', (details) => console.log('FAILURE', details));
memcached.on('reconnecting', (details) => console.log('RECONNECTING', details));
memcached.on('reconnect', (details) => console.log('RECONNECT', details));
memcached.on('remove', (details) => console.log('REMOVE', details));

module.exports = router(
  get('/', () => {
    const memoryUsage = process.memoryUsage();
    const used = memoryUsage.heapUsed / 1024 / 1024;
    return {
      name: 'node-hnapi-helper',
      process: {
        versions: process.versions,
        memoryUsageReadable: `${Math.round(used * 100) / 100} MB`,
        memoryUsage,
      },
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
const now = () => new Date().toISOString();
function cacheTime(){
  console.log(now() + ': Start caching');

  newsLengths = ['news', 'news2', 'newest', 'show', 'ask'/*, 'jobs'*/].map(page => {
    const news = hn[page]();
    if (news.length) memcached.set(page, news, CACHE_EXPIRY, function(){
      console.log(now() + ': Cache ' + page);
    });
    return news.length;
  });

  const items = hn.items();
  if (items.length) items.forEach(function(item){
    const id = item.id;
    if (id) memcached.set('post' + id, item, CACHE_EXPIRY, function(){
      console.log(now() + ': Cache item ' + id);
    });
  });

  if (newsLengths.some(length => length <= 0) || !items.length){
    setTimeout(cacheTime, 5000); // If something is wrong, update faster
  } else {
    setTimeout(cacheTime, CACHE_INTERVAL);
  }
}
setTimeout(cacheTime, 5000);
