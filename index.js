const express = require('express');
const router = express.Router();
const git = require('simple-git')(process.env.PWD);

function createTagList() {
  const tagList = [];
  return new Promise((r1, e1) => {
    git.tags(async (err, tags) => {
      const promiseArray = [];
      tags.all.forEach(tagName => {
        promiseArray.push(new Promise((r2, e2) => {
          git.revparse(['--verify', `${tagName}^{commit}`], (err, result) => {
            const sha = result.split('\n')[0];
            tagList.push({ tagName, sha });
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
      // Remove the newline character from headSha, if there is any commit
      headSha = headSha && headSha.split('\n')[0];

      // determine which version is associated with the current sha
      let version = undefined;
      tagList.forEach(tag => {
        if (tag.sha === headSha) {
          version = tag.sha;
        }
      });

      // If we're in between versions, then list the current commit location, as HEAD
      // Also if there are no commits yet, don't list any
      if (!version && headSha != undefined) {
        version = headSha;
        tagList.push({
          tag: 'HEAD',
          sha: headSha,
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
      return tag.sha === req.body['tag-sha'];
    });

    // if it is, then check out the sha
    if (match) {
      git.checkout(match.sha, (error, response) => {
        if (error) {
          return res.json({ error });
        }
      return res.redirect('/');
      });
    } else {
      return res.redirect('/');
    }
  });
});

module.exports = router;
