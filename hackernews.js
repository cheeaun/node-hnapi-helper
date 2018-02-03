// Mainly inspired by https://github.com/jsdf/hacker-news-mobile-api

const firebase = require('@firebase/app').default;
require('@firebase/database');
const difference = require('lodash.difference');

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com',
});
const hn = firebase.database().ref('/v0');
const format = require('./format');

const items = {};
const itemRefs = {};

const handleCollection = (itemIds, prevItemIds) => {
  const added = difference(itemIds, prevItemIds);
  const removed = difference(prevItemIds, itemIds);
  added.forEach(addItem);
  removed.forEach(removeItem);
};

const handleItem = (snapshot) => {
  const item = snapshot.val();
  if (!item || !item.id) return;
  const { id } = item;
  const prevItem = items[id];
  items[id] = item;
  if (item.parts){
    const prevParts = prevItem && prevItem.parts || [];
    handleCollection(item.parts, prevParts);
  }
  if (item.kids){
    const prevKids = prevItem && prevItem.kids || [];
    handleCollection(item.kids, prevKids);
  }
};

const addItem = (id) => {
  if (itemRefs[id]) return;
  const itemRef = hn.child('/item/' + id);
  itemRef.on('value', handleItem);
  itemRefs[id] = itemRef;
};

const removeItem = (id) => {
  const itemRef = itemRefs[id];
  if (!itemRef) return;
  itemRef.off('value', handleItem);
  delete itemRefs[id];
  delete items[id];
};

const expandItem = (id) => {
  const item = items[id];
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

let topStories = [];
const topStoriesRef = hn.child('/topstories').limitToFirst(60);
topStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, topStories);
  topStories = stories;
});

// new, show, ask, jobs
let newStories = [];
const newStoriesRef = hn.child('/newstories').limitToFirst(30);
newStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, newStories);
  newStories = stories;
});

let showStories = [];
const showStoriesRef = hn.child('/showstories').limitToFirst(30);
showStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, showStories);
  showStories = stories;
});

let askStories = [];
const askStoriesRef = hn.child('/askstories').limitToFirst(30);
askStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, askStories);
  askStories = stories;
});

let jobStories = [];
const jobStoriesRef = hn.child('/jobstories').limitToFirst(30);
jobStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, jobStories);
  jobStories = stories;
});

module.exports = {
  news(){
    let noItem = false;
    const data = topStories.slice(0, 30).map((id) => {
      const item = items[id];
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
    let noItem = false;
    const data = topStories.slice(30).map((id) => {
      const item = items[id];
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
    let noItem = false;
    const data = newStories.slice(0, 30).map((id) => {
      const item = items[id];
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
    let noItem = false;
    const data = showStories.slice(0, 30).map((id) => {
      const item = items[id];
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
    let noItem = false;
    const data = askStories.slice(0, 30).map((id) => {
      const item = items[id];
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
    let noItem = false;
    const data = jobStories.slice(0, 30).map((id) => {
      const item = items[id];
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
