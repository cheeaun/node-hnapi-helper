require('dotenv').config();
const { send } = require('micro');
const { router, get } = require('microrouter');
const hn = require('./hackernews');
const Redis = require('ioredis');

const {
  CACHE_INTERVAL = 1000*60*5, // 5 minutes
  CACHE_EXPIRY = 60*10, // 10 minutes
  CACHE_URL,
  CACHE_DEBUG = false,
} = process.env;

if (CACHE_URL){
  const redis = new Redis(`redis://${CACHE_URL}`);
  redis.on('connect', () => console.log('CONNECT'));
  redis.on('reconnecting', () => console.log('RECONNECTING'));
  redis.on('error', (e) => console.error('ERROR', e));
}

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
      newsLengths,
      items: items.map(({id = null}) => id),
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
  get('/cache', async () => await redis.keys('*')),
  get('/cache/:key', async (req) => await redis.get(req.params.key)),
  get('/everything', hn.items),
);

// Caching time!
const now = () => new Date().toISOString();
let newsLengths = [];
let items = [];

function cacheTime(){
  console.log(now() + ': Start caching');

  const pipeline = CACHE_URL ? redis.pipeline() : { exec: _=>_ };

  newsLengths = [
    'news',
    'news2',
    'newest',
    'show',
    'ask',
    'jobs',
  ].map(page => {
    const news = hn[page]();
    if (news.length && CACHE_URL){
      pipeline.set(page, JSON.stringify(news), 'ex', CACHE_EXPIRY);
    }
    return {
      page,
      length: news.length,
    };
  });

  items = hn.items();
  if (items.length && CACHE_URL){
    items.forEach(function(item){
      const id = item.id;
      if (id) pipeline.set(`post${id}`, JSON.stringify(item), 'ex', CACHE_EXPIRY);
    });
  }

  pipeline.exec((e) => {
    if (e) console.error(e);
  });

  const zeroLengthNews = newsLengths.filter(({length}) => length <= 0);
  if (zeroLengthNews.length || !items.length){
    setTimeout(cacheTime, 5000); // If something is wrong, update faster
  } else {
    setTimeout(cacheTime, CACHE_INTERVAL);
  }
}
setTimeout(cacheTime, 5000);
