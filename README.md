# release

[![npm version](https://img.shields.io/npm/v/shelljs-release.svg?style=flat-square)](https://www.npmjs.com/package/shelljs-release)
[![npm downloads](https://img.shields.io/npm/dm/shelljs-release.svg?style=flat-square)](https://www.npmjs.com/package/shelljs-release)

A simple NodeJS script to help make npm releases.

## Installation and setup

```bash
npm install --save-dev shelljs-release
```

Also, make sure your primary/main branch has upstream-tracking set-up:

```bash
# Assuming your primary branch is named 'main':
git push --set-upstream origin main
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

## Two Factor Authentication (2FA, OTP)

Newer versions of npm [support Two Factor
Authentication](https://docs.npmjs.com/getting-started/using-two-factor-authentication)
(2FA) for added security. We've added support passing OTPs on the commandline:

```bash
$ npm run release:patch -- --otp=123456
$ # Substitute "123456" for your actual OTP from a supported app.
```
