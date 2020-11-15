const moment = require('moment');
const url = require('url');
const he = require('he');

const typeMapping = {
  story: 'link'
};

function cleanText(html){
  if (!html) return;
  // yea yea regex to clean HTML is lame yada yada
  html = html.replace(/<\/p>/ig, ''); // remove trailing </p>s
  if (!html.match(/^<p>/i)) html = '<p>' + html; // prepend <p>
  return html;
}

function formatStory(item){
  var commentsCount = item.descendants || 0;

  var output = {
    id: item.id,
    title: he.decode(item.title),
    points: item.score,
    user: item.by,
    time: item.time, // Unix timestamp
    time_ago: moment(item.time*1000).fromNow(),
    comments_count: commentsCount,
    type: typeMapping[item.type] || item.type
  };

  if (item.url){
    output.url = item.url;
    output.domain = url.parse(item.url).hostname.replace(/^www\./i, '');
  } else {
    output.url = 'item?id=' + item.id; // Simulate "local" links
  }

  // If it's a job, username and points are useless
  if (item.type == 'job'){
    output.user = output.points = null;
  }

  // Identify type=ask
  if (item.type == 'story' && output.url.match(/^item/i) && item.title && item.title.match(/^ask/i)){
    output.type = 'ask';
  }

  return output;
}

function formatStoryComments(item){
  var output = {
    id: item.id,
    title: he.decode(item.title),
    points: item.score,
    user: item.by,
    time: item.time, // Unix timestamp
    time_ago: moment(item.time*1000).fromNow(),
    type: typeMapping[item.type] || item.type,
    content: item.deleted ? '[deleted]' : cleanText(item.text),
    deleted: item.deleted
  };

  if (item.url){
    output.url = item.url;
    output.domain = url.parse(item.url).hostname.replace(/^www\./i, '')
  } else {
    output.url = 'item?id=' + item.id; // Simulate "local" links
  }

  // If it's a job, username and points are useless
  if (item.type == 'job'){
    output.user = output.points = null;
  }

  // Poll
  if (item._parts && item._parts.length){
    output.poll = item._parts.map(function(part){
      return {
        item: part.text,
        points: part.score
      };
    });
  }

  // Comments
  var commentsCount = 0;
  var formatComments = function(obj, kids, level){
    if (kids && kids.length){
      kids = kids.filter(function(kid){
        return !!kid;
      });
      if (!kids.length){
        obj.comments = [];
        return;
      }
      commentsCount += kids.length;
      obj.comments = kids.map(function(kid){
        var res = {
          id: kid.id,
          level: level,
          user: kid.by,
          time: kid.time,
          time_ago: moment(kid.time*1000).fromNow(),
          content: kid.deleted ? '[deleted]' : cleanText(kid.text),
          deleted: kid.deleted,
          dead: kid.dead
        };
        formatComments(res, kid._kids, level+1);
        return res;
      });
    } else {
      obj.comments = [];
    }
  };
  formatComments(output, item._kids, 0);
  output.comments_count = commentsCount;
  return output;
}

module.exports = {
  story: formatStory,
  storyComments: formatStoryComments,
};
