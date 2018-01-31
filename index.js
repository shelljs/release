#!/usr/bin/env node
require('shelljs/global');

var path = require('path');

var minimist = require('minimist');

// npm version (bump version, commit, make tag)
// echo npm publish
//  - if successful, push commit & tag
//  - if failed, undo commit & tag

function usage() {
  echo('');
  echo('  Usage: node ' + process.argv[1] + ' [--otp=<otpcode>] <major|minor|patch>');
}

config.silent = true;
function run(argv) {
  var version = argv._[0];
  config.silent = false;
  config.fatal = true;
  try {
    // TODO(nfischer): only allow releases from master branch (issue #4)
    echo('Publishing new ' + version + ' version');
    echo('');
    exec('npm version ' + version);
  } catch (e) {
    echo('');
    echo('Unable to bump version, is your repo clean?');
    exit(1);
  }

  try {
    var publishCmd = 'npm publish';
    if (argv.otp) {
      publishCmd += ' --otp=' + argv.otp;
    }
    exec(publishCmd);
  } catch (e) {
    config.fatal = false;
    echo('');
    echo('Unable to publish, restoring previous repo state');

    // Clean up
    var newVersion = require(path.resolve('.', 'package.json')).version;
    var tagName = 'v' + newVersion;

    // Delete the tag and undo the commit
    echo('Removing git tag...');
    exec('git tag -d ' + tagName);
    echo('Removing git commit...');
    exec('git reset --hard HEAD~1');
    var npm_user = exec('npm whoami', { silent: true }).trimRight();
    if (npm_user.toString() === '') {
      config.silent = false;
      echo('');
      echo('You must be logged in to NPM to publish, run "npm login" first.');
      exit(1);
    }
    config.silent = true;
    var is_collaborator = exec('npm access ls-collaborators')
                               .grep('.*' + npm_user + '.*:.*write.*')
                               .trimRight();
    var is_owner = exec('npm owner ls').grep('.*' + npm_user + ' <.*')
                        .trimRight();
    if (is_collaborator + is_owner === '') {
      // Neither collaborator nor owner
      config.silent = false;
      echo(npm_user + ' does not have NPM write access. Request access from one of these fine folk:');
      echo('');
      exec('npm owner ls');
      exit(1);
    }

    echo('Unknown error: ' + e);
  }

  config.silent = false;
  try {
    // TODO(nfischer): this currently requires upstream tracking (issue #2)
    exec('git push');
    exec('git push --tags');
  } catch (e) {
    echo('');
    echo('Version has been released, but commit/tag could not be pushed.');
    echo('Please push these manually.');
  }
}

var argv = minimist(process.argv.slice(2));
switch (argv._[0]) {
  case 'major':
  case 'minor':
  case 'patch':
    run(argv);
    break;

  default:
    usage();
    exit(1);
    break;
}
