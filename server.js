const Hapi = require('hapi');
const nconf = require('nconf');
const hn = require('./hackernews');
var Memcached = require('memcached');

nconf.argv()
  .env()
  .file('config.json')
  .defaults({
    port: 8000,
    cache: {
      expiry: 60*10, // 10 minutes
      interval: 1000*60*5, // 5 minutes
    }
  });

const memcached = new Memcached(nconf.get('cache:location'), nconf.get('cache:options'));

const server = new Hapi.Server();
server.connection({
  port: nconf.get('PORT') || nconf.get('port'),
});

server.route({
  method: 'GET',
  path: '/',
  handler(request, reply){
    return reply({
      name: 'node-hnapi-helper',
      process: {
        versions: process.versions,
        memoryUsage: process.memoryUsage()
      }
    });
  }
});

server.route({
  method: 'GET',
  path: '/news',
  handler(request, reply){
    return reply(hn.news());
  }
});

server.route({
  method: 'GET',
  path: '/news2',
  handler(request, reply){
    return reply(hn.news2());
  }
});

server.route({
  method: 'GET',
  path: '/item/{id}',
  handler(request, reply){
    const id = request.params.id;
    return reply(id ? hn.item(id) : {});
  }
});

server.route({
  method: 'GET',
  path: '/cache/{key}',
  handler(request, reply){
    const key = request.params.key;
    const response = reply().hold();
    memcached.get(key, function(err, data){
      if (err) throw err;
      response.source = data;
      response.send();
    });
  }
});

// Experimental
['newest', 'show', 'ask', 'jobs'].map(page => {
  server.route({
    method: 'GET',
    path: '/' + page,
    handler(request, reply){
      return reply(hn[page]());
    }
  });
});

// Don't try this at home
server.route({
  method: 'GET',
  path: '/everything',
  handler(request, reply){
    return reply(hn.items());
  }
});

server.start((err) => {
  if (err) throw err;
  console.log('Server running at:', server.info.uri);
});

// Caching time!
const interval = nconf.get('cache:interval');
const expiry = nconf.get('cache:expiry');
const now = () => new Date().toISOString();
function cacheTime(){
  console.log(now() + ': Start caching');

  newsLengths = ['news', 'news2', 'newest', 'show', 'ask', 'jobs'].map(page => {
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
