const express = require('express');
const router = express.Router();
const git = require('simple-git')(process.env.PWD);

function createTagList() {
  const tagList = [];
  return new Promise((r1, e1) => {
    git.tags(async (err, tags) => {
      const promiseArray = [];
      tags.all.forEach(tag => {
        promiseArray.push(new Promise((r2, e2) => {
          git.revparse(['--verify', `${tag}^{commit}`], (err, result) => {
            const sha = result.split('\n')[0];
            tagList.push({ tag, sha });
            r2();
          });
        }));
      });
      await Promise.all(promiseArray);
      r1(tagList);
    });
  });
}

git.fetch(() => {
  /* GET home page. */
  router.get('/', async function(req, res, next) {
    const tagList = await createTagList();
    // find the current sha
    git.revparse(["HEAD"], (err, headSha) => {
      let version = undefined;

      // determine which version is associated with the current sha
      tagList.forEach(version => {
        if (version.sha === headSha) {
          version = version.tag;
        }
      });

      if (!version) {
        version = headSha;
        tagList.push({
          tag: 'HEAD',
          sha: headSha.split('\n')[0],
        });
      }

      res.render('index', {
        title: 'Express',
        tags: tagList,
        version,
      });
    });
  });

  router.post('/update', async function(req, res, next) {
    const tagList = await createTagList();

    const match = tagList.find(tag => {
      return tag.sha === req.body.version;
    });

    // if it is, then check out the sha
    if (match) {
      git.checkout(match, (error, response) => {
        if (error) {
          return res.json({ error });
        }
      return res.json({ hello: 'new version'});
      });
    } else {
      return res.send('nope');
    }
  });
});

module.exports = router;
