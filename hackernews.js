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

const handleItem = (snapshot, itemID) => {
  const item = snapshot.val();
  if (!item || !item.id){
    console.log('Null item', itemID);
    return;
  }
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
  itemRef.on('value', (snapshot) => {
    handleItem(snapshot, id);
  });
  itemRefs[id] = itemRef;
};

const removeItem = (id) => {
  const itemRef = itemRefs[id];
  if (!itemRef) return;
  const allStories = [
    ...topStories,
    ...newStories,
    ...showStories,
    ...askStories,
    ...jobStories,
    ...bestStories,
  ];
  if (allStories.includes(id)) return;
  itemRef.off('value');
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
const newStoriesRef = hn.child('/newstories').limitToFirst(60);
newStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, newStories);
  newStories = stories;
});

let showStories = [];
const showStoriesRef = hn.child('/showstories').limitToFirst(60);
showStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, showStories);
  showStories = stories;
});

let askStories = [];
const askStoriesRef = hn.child('/askstories').limitToFirst(60);
askStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, askStories);
  askStories = stories;
});

let jobStories = [];
const jobStoriesRef = hn.child('/jobstories').limitToFirst(60);
jobStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, jobStories);
  jobStories = stories;
});

let bestStories = [];
const bestStoriesRef = hn.child('/beststories').limitToFirst(60);
bestStoriesRef.on('value', (snapshot) => {
  const stories = snapshot.val();
  handleCollection(stories, bestStories);
  bestStories = stories;
});

const keyMap = {
  news: () => topStories,
  newest: () => newStories,
  show: () => showStories,
  ask: () => askStories,
  jobs: () => jobStories,
  best: () => bestStories,
};
const perPage = 30;

const stories = (key, page = 1) => {
  let noItem = false;
  const begin = (page-1) * perPage;
  const end = begin + perPage;
  const stories = keyMap[key]();
  const data = stories.slice(begin, end).map((id) => {
    const item = items[id];
    if (!item){
      noItem = true;
      console.error('No item', id);
    }
    return item;
  });
  if (noItem) return [];
  return data.map(format.story);
};

module.exports = {
  stories,
  news(){
    return stories('news');
  },
  news2(){
    return stories('news', 2);
  },
  newest(){
    return stories('newest');
  },
  show(){
    return stories('show');
  },
  ask(){
    return stories('ask');
  },
  jobs(){
    return stories('jobs');
  },
  best(){
    return stories('best');
  },
  item(id){
    return format.storyComments(expandItem(id));
  },
  items(){
    const allStories = [
      ...topStories,
      ...newStories,
      ...showStories,
      ...askStories,
      ...jobStories,
      ...bestStories,
    ];
    const reducedStories = [...new Set(allStories)]; // remove duplicates
    return reducedStories.filter(id => !!items[id]).map(expandItem).filter(Boolean).map(format.storyComments);
  }
};
