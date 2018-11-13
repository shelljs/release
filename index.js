#!/usr/bin/env node
require('shelljs/global');

var path = require('path');

var chalk = require('chalk');
var minimist = require('minimist');

var RELEASE_BRANCH = 'master';

// npm version (bump version, commit, make tag)
// echo npm publish
//  - if successful, push commit & tag
//  - if failed, undo commit & tag

function usage() {
  echo('');
  echo('  Usage: node ' + process.argv[1] + ' [--otp=<otpcode>] <major|minor|patch>');
}

function gitBranch() {
  var output = exec('git rev-parse --abbrev-ref HEAD', { silent: true });
  if (output.code) {
    throw new Error('Unable to fetch git branch');
  }
  return output.stdout.trimRight();
}

config.silent = true;
function run(argv) {
  var version = argv._[0];
  config.silent = false;
  config.fatal = true;
  try {
    var currentBranch = gitBranch();
    if (currentBranch !== RELEASE_BRANCH) {
      echo('Please switch to the release branch: ' + RELEASE_BRANCH);
      echo('Currently on: ' + currentBranch);
      exit(1);
    }
  } catch (e) {
    echo('Are you in a git repo?');
    exit(1);
  }

  try {
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
    echo(chalk.red.bold('Unable to publish, restoring previous repo state'));

    // Clean up
    var newVersion = require(path.resolve('.', 'package.json')).version;
    var tagName = 'v' + newVersion;

    // Delete the tag and undo the commit
    echo('Removing git tag...');
    var cleanTag = exec('git tag -d ' + tagName);
    echo('Removing git commit...');
    var cleanCommit = exec('git reset --hard HEAD~1');
    if (cleanTag.code === 0 && cleanCommit.code === 0) {
      echo(chalk.white.bold('Successfully cleaned up commit and tag'));
    }
    var npm_user = exec('npm whoami', { silent: true }).trimRight();
    if (npm_user.toString() === '') {
      config.silent = false;
      echo('');
      echo(chalk.yellow.bold(
          'You must be logged in to NPM to publish, run "npm login" first.'));
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
      echo(chalk.yellow.bold(
          npm_user + ' does not have NPM write access. Request access from one of these fine folk:'));
      echo('');
      exec('npm owner ls');
      exit(1);
    }

    echo(chalk.red.bold('Unknown error: ' + e));
    exit(2);
  }

  config.silent = false;
  try {
    exec('git push origin ' + RELEASE_BRANCH);
    exec('git push --tags origin ' + RELEASE_BRANCH);
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
