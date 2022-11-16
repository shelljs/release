#!/usr/bin/env node
var shell = require('shelljs');

var path = require('path');

var chalk = require('chalk');
var minimist = require('minimist');

var GIT_MAIN_BRANCHES = [ 'main', 'master' ];
function findMainBranch() {
  for (branch of GIT_MAIN_BRANCHES) {
    var branchExists = shell.exec('git branch --list ' + branch, { silent: true }).trim() != '';
    if (branchExists) {
      return branch;
    }
  }
  throw new Error('Cannot determine main branch of repo');
}

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

  shell.echo('');
  shell.echo('Usage: ' + process.argv[1] + ' [OPTION] <major|minor|patch>');
  shell.echo('');
  shell.echo('Available options:');
  var longestOption = Object.keys(options).reduce(function (accum, option) {
    return accum.length > option.length ? accum : option;
  }, '');
  var columnSize = longestOption.length + 2;
  Object.keys(options).forEach(function (option) {
    var description = options[option];
    shell.echo('  ' + rightPad(option, columnSize) + description);
  });
}

function gitBranch() {
  var output = shell.exec('git rev-parse --abbrev-ref HEAD', { silent: true });
  if (output.code) {
    throw new Error('Unable to fetch git branch');
  }
  return output.stdout.trimRight();
}

shell.config.silent = true;
function run(argv) {
  if (argv.help) {
    usage();
    shell.exit(0);
  }
  var version = argv._[0];
  shell.config.silent = false;
  shell.config.fatal = true;
  var releaseBranch = argv['release-branch'] || findMainBranch();
  try {
    var currentBranch = gitBranch();
    if (currentBranch !== releaseBranch) {
      shell.echo('Please switch to the release branch: ' + releaseBranch);
      shell.echo('Currently on: ' + currentBranch);
      shell.exit(1);
    }
  } catch (e) {
    shell.echo('Are you in a git repo?');
    shell.exit(1);
  }

  try {
    shell.echo('Publishing new ' + version + ' version');
    shell.echo('');
    shell.exec('npm version ' + version);
  } catch (e) {
    shell.echo('');
    shell.echo('Unable to bump version, is your repo clean?');
    shell.exit(1);
  }

  try {
    var npmVersions = shell.exec('npm --version').trim().split('.');
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
    shell.exec(publishCmd);
  } catch (e) {
    shell.config.fatal = false;
    shell.echo('');
    shell.echo(chalk.yellow.bold('Unable to publish, restoring previous repo state'));

    // Clean up
    var newVersion = require(path.resolve('.', 'package.json')).version;
    var tagName = 'v' + newVersion;

    // Delete the tag and undo the commit
    shell.echo('Removing git tag...');
    var cleanTag = shell.exec('git tag -d ' + tagName);
    shell.echo('Removing git commit...');
    var cleanCommit = shell.exec('git reset --hard HEAD~1');
    if (cleanTag.code === 0 && cleanCommit.code === 0) {
      shell.echo(chalk.white.bold('Successfully cleaned up commit and tag'));
    }
    var npm_user = shell.exec('npm whoami', { silent: true }).trimRight();
    if (npm_user.toString() === '') {
      shell.config.silent = false;
      shell.echo('');
      shell.echo(chalk.yellow.bold(
          'You must be logged in to NPM to publish, run "npm login" first.'));
      shell.exit(1);
    }
    shell.config.silent = true;
    var is_collaborator = shell.exec('npm access ls-collaborators')
                               .grep('.*' + npm_user + '.*:.*write.*')
                               .trimRight();
    var is_owner = shell.exec('npm owner ls').grep('.*' + npm_user + ' <.*')
                        .trimRight();
    if (is_collaborator + is_owner === '') {
      // Neither collaborator nor owner
      shell.config.silent = false;
      shell.echo(chalk.yellow.bold(
          npm_user + ' does not have NPM write access. Request access from one of these fine folk:'));
      shell.echo('');
      shell.exec('npm owner ls');
      shell.exit(1);
    }

    var message = e.message || e;
    shell.echo(chalk.red.bold('Error: ' + message));
    shell.exit(2);
  }

  shell.config.silent = false;
  try {
    shell.exec('git push origin ' + releaseBranch);
    shell.exec('git push --tags origin ' + releaseBranch);
  } catch (e) {
    shell.echo('');
    shell.echo('Version has been released, but commit/tag could not be pushed.');
    shell.echo('Please push these manually.');
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
    shell.echo(chalk.yellow.bold(
        'Missing version bump argument (<major|minor|patch>)'));
    usage();
    shell.exit(1);
    break;
}
