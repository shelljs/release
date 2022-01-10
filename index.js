#!/usr/bin/env node
require('shelljs/global');

var path = require('path');

var chalk = require('chalk');
var minimist = require('minimist');

var GIT_MAIN_BRANCHES = [ 'main', 'master' ];
function findMainBranch() {
  for (branch of GIT_MAIN_BRANCHES) {
    var branchExists = exec('git branch --list ' + branch, { silent: true }).trim() != '';
    if (branchExists) {
      return branch;
    }
  }
  throw new Error('Cannot determine main branch of repo');
}

// npm version (bump version, commit, make tag)
// echo npm publish
//  - if successful, push commit & tag
//  - if failed, undo commit & tag

/**
 * Adds space characters to `str` until the return value is `length` characters
 * long. Returns `str` unmodified if it is already `length` characters long (or
 * longer).
 */
function rightPad(str, length) {
  var paddingLength = length - str.length;
  for (var i = 0; i < paddingLength; i++) {
    str += ' ';
  }
  return str;
}

function usage() {
  var options = {
    '--help': 'Show this help message.',
    '--otp=<otpcode>': 'One-time-password (OTP) to pass to `npm publish`.',
    '--release-branch=<branch>': 'The branch you intend to cut the release ' +
                                 'from. Defaults to an ordered preference of ' +
                                 '[' + GIT_MAIN_BRANCHES.join(', ') + '].',
  };

  echo('');
  echo('Usage: ' + process.argv[1] + ' [OPTION] <major|minor|patch>');
  echo('');
  echo('Available options:');
  var longestOption = Object.keys(options).reduce(function (accum, option) {
    return accum.length > option.length ? accum : option;
  }, '');
  var columnSize = longestOption.length + 2;
  Object.keys(options).forEach(function (option) {
    var description = options[option];
    echo('  ' + rightPad(option, columnSize) + description);
  });
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
  if (argv.help) {
    usage();
    exit(0);
  }
  var version = argv._[0];
  config.silent = false;
  config.fatal = true;
  var releaseBranch = argv['release-branch'] || findMainBranch();
  try {
    var currentBranch = gitBranch();
    if (currentBranch !== releaseBranch) {
      echo('Please switch to the release branch: ' + releaseBranch);
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
    var npmVersions = exec('npm --version').trim().split('.');
    if (npmVersions[0] < 6 && argv.otp) {
      // I'm not sure about npm v5, but I've verified the --otp switch is not
      // documented for npm v4 and below.
      throw new Error(
          'The --otp switch only supports npm >= v6. Upgrade your node/nvm.');
    }
    var publishCmd = 'npm publish';
    if (argv.otp) {
      publishCmd += ' --otp=' + argv.otp;
    }
    exec(publishCmd);
  } catch (e) {
    config.fatal = false;
    echo('');
    echo(chalk.yellow.bold('Unable to publish, restoring previous repo state'));

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

    var message = e.message || e;
    echo(chalk.red.bold('Error: ' + message));
    exit(2);
  }

  config.silent = false;
  try {
    exec('git push origin ' + releaseBranch);
    exec('git push --tags origin ' + releaseBranch);
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
    echo(chalk.yellow.bold(
        'Missing version bump argument (<major|minor|patch>)'));
    usage();
    exit(1);
    break;
}
