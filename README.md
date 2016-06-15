# release

A simple NodeJS script to help make npm releases.

## Installation and setup

```bash
npm install --save-dev shelljs-release
```

Also, make sure your master branch has upstream-tracking set-up:

```bash
git push --set-upstream origin master
```

Now, add some `scripts` to `package.json` like so:

```json
  "scripts": {
    "test": "... whatever you had here before ...",
    "release:major": "shelljs-release major",
    "release:minor": "shelljs-release minor",
    "release:patch": "shelljs-release patch"
  },
```

Alright, you're good to go!

## Usage example

If you made some commits to your project and now want to release a new update,
with a bump in the patch number (i.e. from `v1.2.6` to `v1.2.7`), run this
command:

```bash
$ npm run release:patch
```

This will:

 - Bump the version & commit for you
 - Create the corresponding git tag
 - Push your commit and tags upstream
 - Release to npm!

Cool!

Similarly, if you want to jump from `v1.2.6` to `v1.3.0,` or from `v1.2.6` to
`v2.0.0`, you can run `npm run release:minor` or `npm run release:major`
respectively.
