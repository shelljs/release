#!/usr/bin/env node
var shell = require('shelljs');

var path = require('path');

var chalk = require('chalk');
var minimist = require('minimist');

var GIT_MAIN_BRANCHES = ['main', 'master'];
function findMainBranch() {
  for (var idx = 0; idx < GIT_MAIN_BRANCHES.length; idx++) {
    var branch = GIT_MAIN_BRANCHES[idx];
    var branchExists = shell.cmd('git', 'branch', '--list', branch).trim() !== '';
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
    '--dryrun': 'Go through the release steps but do not publish anything.',
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
  var output = shell.cmd('git', 'rev-parse', '--abbrev-ref', 'HEAD');
  if (output.code) {
    throw new Error('Unable to fetch git branch');
  }
  return output.stdout.trimRight();
}

function maybeExecute(dryrun, cmdArray, opts) {
  opts = opts || {};
  if (dryrun) {
    var cmdString = cmdArray.join(' ');
    shell.echo('... skipping command ' + JSON.stringify(cmdString) + ' (dryrun)');
  } else {
    const result = shell.cmd(...cmdArray);
    if (opts.loud) {
      shell.echo(result.stdout.trimRight());
    }
  }
}

function gitTagName() {
  var newVersion = require(path.resolve('.', 'package.json')).version;
  var tagName = 'v' + newVersion;
  return tagName;
}

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
      shell.echo(chalk.red.bold('Please switch to the release branch: ' + releaseBranch));
      shell.echo(chalk.red.bold('Currently on: ' + currentBranch));
      if (argv.dryrun) {
        shell.echo('Release branch does not match: ignoring because this is a dryrun');
      } else {
        shell.exit(1);
      }
    }
  } catch (e) {
    shell.echo('Are you in a git repo?');
    shell.exit(1);
  }

  try {
    shell.echo('Publishing new ' + version + ' version');
    shell.echo('');
    maybeExecute(argv.dryrun, ['npm', 'version', version]);
  } catch (e) {
    shell.echo('');
    shell.echo('Unable to bump version, is your repo clean?');
    shell.exit(1);
  }

  try {
    var npmVersions = shell.cmd('npm', '--version').trim().split('.');
    if (npmVersions[0] < 6 && argv.otp) {
      // I'm not sure about npm v5, but I've verified the --otp switch is not
      // documented for npm v4 and below.
      throw new Error(
          'The --otp switch only supports npm >= v6. Upgrade your node/nvm.');
    }
    // 'npm publish' will internally call both 'git commit' and 'git tag'
    var publishCmd = ['npm', 'publish'];
    if (argv.otp) {
      publishCmd.push('--otp=' + argv.otp);
    }
    maybeExecute(argv.dryrun, publishCmd, { loud: true });
  } catch (e) {
    shell.config.fatal = false;
    shell.echo('');
    shell.echo(chalk.yellow.bold('Unable to publish, restoring previous repo state'));

    // Clean up
    // Delete the tag and undo the commit
    shell.echo('Removing git tag...');
    var cleanTag = shell.cmd('git', 'tag', '-d', gitTagName());
    shell.echo('Removing git commit...');
    var cleanCommit = shell.cmd('git', 'reset', '--hard', 'HEAD~1');
    if (cleanTag.code === 0 && cleanCommit.code === 0) {
      shell.echo(chalk.white.bold('Successfully cleaned up commit and tag'));
    }
    var npmUser = shell.cmd('npm', 'whoami').trim()();
    if (npmUser === '') {
      shell.echo('');
      shell.echo(chalk.yellow.bold(
          'You must be logged in to NPM to publish, run "npm login" first.'));
      shell.exit(1);
    }
    var isCollaborator = shell.cmd('npm', 'access', 'ls-collaborators')
                              .grep('.*' + npmUser + '.*:.*write.*')
                              .trimRight();
    var isOwner = shell.cmd('npm', 'owner', 'ls')
                       .grep('.*' + npmUser + ' <.*')
                       .trimRight();
    if (isCollaborator + isOwner === '') {
      // Neither collaborator nor owner
      shell.echo(chalk.yellow.bold(
          npmUser + ' does not have NPM write access. Request access from one of these fine folk:'));
      shell.echo('');
      var ownerList = shell.cmd('npm', 'owner', 'ls').stdout;
      shell.echo(ownerList);
      shell.exit(1);
    }

    var message = e.message || e;
    shell.echo(chalk.red.bold('Error: ' + message));
    shell.exit(2);
  }

  shell.config.silent = false;
  try {
    maybeExecute(argv.dryrun, ['git', 'push', 'origin', releaseBranch],
                 { loud: true });
    maybeExecute(argv.dryrun,
                 ['git', 'push', 'origin', 'refs/tags/' + gitTagName()],
                 { loud: true });
  } catch (e) {
    shell.echo('');
    shell.echo(chalk.yellow.bold('Version has been released, but commit/tag could not be pushed.'));
    shell.echo(chalk.yellow.bold('Please push these manually.'));
  }
  if (argv.dryrun) {
    shell.echo('Dry run completed successfully!');
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
