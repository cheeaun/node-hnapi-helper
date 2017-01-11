// Mainly inspired by https://github.com/jsdf/hacker-news-mobile-api

const firebase = require('firebase');
const _ = require('lodash');

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com',
});
const hn = firebase.database().ref('/v0');
const format = require('./format');

var items = {};
var itemRefs = {};

var handleCollection = function(itemIds, prevItemIds){
  var added = _.difference(itemIds, prevItemIds);
  var removed = _.difference(prevItemIds, itemIds);
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

module.exports = {
  news(){
    var noItem = false;
    var data = topStories.slice(0, 30).map((id) => {
      var item = items[id];
      if (!item) noItem = true;
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  news2(){
    var noItem = false;
    var data = topStories.slice(30).map((id) => {
      var item = items[id];
      if (!item) noItem = true;
      return item;
    });
    if (noItem) return [];
    return data.map(format.story);
  },
  item(id){
    return format.storyComments(expandItem(id));
  },
  items(){
    var noItem = false;
    topStories.forEach((id) => {
      var item = items[id];
      if (!item) noItem = true;
    });
    if (noItem) return [];
    return topStories.map(expandItem).map(format.storyComments);
  }
};
