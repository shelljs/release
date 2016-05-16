#!/usr/bin/env node
require('shelljs/global');

// require npm user
// bump package version
// commit
// create tag
// push commit & tag
// publish

function usage() {
  echo("");
  echo("  Usage: bash $0 <major|minor|patch>");
}

config.silent = true;
function run(version) {
  var npm_user = exec('npm whoami').trimRight();
  var is_collaborator = exec('npm access ls-collaborators').grep('.*' + npm_user + '.*:.*write.*').trimRight();
  var is_owner = exec('npm owner ls').grep('.*' + npm_user + ' <.*').trimRight();

  if (npm_user) {
    config.silent = false;
    if (is_collaborator || is_owner) {
      echo('Publishing new ' + version + ' version as ' + npm_user + '.');
      echo('');
      exec('npm version ' + version);
      exec('git push');
      exec('git push --follow-tags');
      exec('npm publish');
    } else {
      echo(npm_user + ' does not have NPM write access. Request access from one of these fine folk:');
      echo('');
      exec('npm owner ls');
    }
  } else {
    echo('You must be logged in to NPM to publish, run "npm login" first.');
  }
}

switch (process.argv[2]) {
  case 'major':
  case 'minor':
  case 'patch':
    run(process.argv[2]);
    break;

  default:
    usage();
    exit(1);
    break;
}
