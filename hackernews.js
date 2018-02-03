// Mainly inspired by https://github.com/jsdf/hacker-news-mobile-api

const firebase = require('@firebase/app').default;
require('@firebase/database');
const difference = require('lodash.difference');

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com',
});
const hn = firebase.database().ref('/v0');
const format = require('./format');

var items = {};
var itemRefs = {};

var handleCollection = function(itemIds, prevItemIds){
  var added = difference(itemIds, prevItemIds);
  var removed = difference(prevItemIds, itemIds);
  added.forEach(addItem);
  removed.forEach(removeItem);
};

var handleItem = function(snapshot){
  var item = snapshot.val();
  if (!item || !item.id) return;
  var id = item.id;
  var prevItem = items[id];
  items[id] = item;
  if (item.parts){
    var prevParts = prevItem && prevItem.parts || [];
    handleCollection(item.parts, prevParts);
  }
  if (item.kids){
    var prevKids = prevItem && prevItem.kids || [];
    handleCollection(item.kids, prevKids);
  }
};

var addItem = function(id){
  if (itemRefs[id]) return;
  var itemRef = hn.child('/item/' + id);
  itemRef.on('value', handleItem);
  itemRefs[id] = itemRef;
};

var removeItem = function(id){
  var itemRef = itemRefs[id];
  if (!itemRef) return;
  itemRef.off('value', handleItem);
  delete itemRefs[id];
  delete items[id];
};

var expandItem = function(id){
  var item = items[id];
  if (!item || item.dead) return;
  if (item.parts){
    item._parts = item.parts.map(expandItem).filter(Boolean);
  }
  if (!item.kids){
    return item.deleted ? null : item;
  }
  item._kids = item.kids.map(expandItem).filter(Boolean);
  return item;
};

var topStories = [];
var topStoriesRef = hn.child('/topstories').limitToFirst(60);
topStoriesRef.on('value', function(snapshot){
  var stories = snapshot.val();
  handleCollection(stories, topStories);
  topStories = stories;
});

// new, show, ask, jobs
var newStories = [];
var newStoriesRef = hn.child('/newstories').limitToFirst(30);
newStoriesRef.on('value', function(snapshot){
  var stories = snapshot.val();
  handleCollection(stories, newStories);
  newStories = stories;
});

var showStories = [];
var showStoriesRef = hn.child('/showstories').limitToFirst(30);
showStoriesRef.on('value', function(snapshot){
  var stories = snapshot.val();
  handleCollection(stories, showStories);
  showStories = stories;
});

var askStories = [];
var askStoriesRef = hn.child('/askstories').limitToFirst(30);
askStoriesRef.on('value', function(snapshot){
  var stories = snapshot.val();
  handleCollection(stories, askStories);
  askStories = stories;
});

var jobStories = [];
var jobStoriesRef = hn.child('/jobstories').limitToFirst(30);
jobStoriesRef.on('value', function(snapshot){
  var stories = snapshot.val();
  handleCollection(stories, jobStories);
  jobStories = stories;
});

module.exports = {
  news(){
    var noItem = false;
    var data = topStories.slice(0, 30).map((id) => {
      var item = items[id];
      if (!item){
        noItem = true;
        console.error('No ID', item);
      }
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  news2(){
    var noItem = false;
    var data = topStories.slice(30).map((id) => {
      var item = items[id];
      if (!item){
        noItem = true;
        console.error('No ID', item);
      }
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  newest(){
    var noItem = false;
    var data = newStories.slice(0, 30).map((id) => {
      var item = items[id];
      if (!item){
        noItem = true;
        console.error('No ID', item);
      }
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  show(){
    var noItem = false;
    var data = showStories.slice(0, 30).map((id) => {
      var item = items[id];
      if (!item){
        noItem = true;
        console.error('No ID', item);
      }
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  ask(){
    var noItem = false;
    var data = askStories.slice(0, 30).map((id) => {
      var item = items[id];
      if (!item){
        noItem = true;
        console.error('No ID', item);
      }
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  jobs(){
    var noItem = false;
    var data = jobStories.slice(0, 30).map((id) => {
      var item = items[id];
      if (!item){
        noItem = true;
        console.error('No ID', item);
      }
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  item(id){
    return format.storyComments(expandItem(id));
  },
  items(){
    const allStories = [
      topStories,
      newStories,
      showStories,
      askStories,
      jobStories,
    ].reduce((a, b) => a.concat(b), []); // flatten
    const reducedStories = [...new Set(allStories)]; // remove duplicates
    return reducedStories.filter(id => !!items[id]).map(expandItem).map(format.storyComments);
  }
};
