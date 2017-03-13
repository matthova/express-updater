const express = require('express');
const router = express.Router();
const git = require('simple-git')(process.env.PWD);
const equal = require('deep-equal');
const exec = require('child_process').exec;

// Return an array of objects
// Each object contains the tag name and its associated SHA
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

async function differentNpmDependencies(currentSha, newSha) {
  const currentDependencies = await new Promise((resolve, reject) => {
    git.show([`${currentSha}:package.json`], (err, result) => {
      const packageJson = JSON.parse(result);
      const packages = {
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
      }
      resolve(packages);
    });
  });

  const newDependencies = await new Promise((resolve, reject) => {
    git.show([`${newSha}:package.json`], (err, result) => {
      const packageJson = JSON.parse(result);
      const packages = {
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
      }
      resolve(packages);
    });
  });
  return !equal(currentDependencies, newDependencies);
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

    const currentSha = await new Promise((resolve, reject) => {
      git.revparse(['HEAD'], (err, response) => {
        resolve(response.split('\n')[0]);
      });
    });

    const tagList = await createTagList();

    const match = tagList.find(tag => {
      return tag.sha === req.body['tag-sha'];
    });

    // if it is, then check out the sha
    if (match && match.sha !== currentSha) {
      git.checkout(match.sha, async (error, response) => {
        if (error) {
          return res.json({ error });
        }

        // if the dependencies change, reinstall them
        if (await differentNpmDependencies(currentSha, match.sha)) {
          try {
            console.log('starting', new Date());
            exec(`npm install --prefix ${process.env.PWD}/tmp_modules -g`, (error, stdout, stderr) => {
              if (error) {
                console.error(`exec error: ${error}`);
                return;
              }

              // figure out the name of the app from package.json
              const packageName = require(`${process.env.PWD}/package.json`).name;
              const initialPath = `${process.env.PWD}/tmp_modules/lib/node_modules/${packageName}/node_modules`;
              const finalPath = `${process.env.PWD}/node_modules`;
              // replace node_modules with the existing node_modules
              exec(`mv ${initialPath} ${finalPath}`, async (error, stdout, stderr) => {
                // delete the extranneous modules
                exec(`rm -rf ${process.env.PWD}/tmp_modules`);
              });
            });
          } catch (ex) {
            console.log('eh?', ex);
          }
        }
        return res.redirect('/');
      });
    } else {
      return res.redirect('/');
    }
  });
});

module.exports = router;
