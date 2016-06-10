# release

A simple NodeJS script to help make npm releases.

## Installation

```bash
npm install --save-dev shelljs/release
```

## Usage

In `package.json`:

```json
  "scripts": [
    "test": "... whatever you had here before ...",
    "release:major": "release major",
    "release:minor": "release minor",
    "release:patch": "release patch"
  ],
```

Use this by running:

```bash
$ npm run release:major # bumps major version & releases
$ npm run release:minor # bumps minor version & releases
$ npm run release:patch # bumps patch version & releases
```
