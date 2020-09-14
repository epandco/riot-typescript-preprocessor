# Riot TypeScript Preprocessor

This is a utility used by the Unthink Stack. It is a Riot preprocessor that
compiles TypeScript inside of the Riot components.

## Installation

    npm i --save-dev @epandco/riot-typescript-preprocessor

## Usage

In your build script, init the preprocessor by passing in the
`registerPreprocessor` function from `@riotjs/compiler`:

```javascript
const {registerPreprocessor} = require('@riotjs/compiler');

const { initRiotTypeScriptPreprocessor } = require('@epandco/riot-typescript-preprocessor');

initRiotTypeScriptPreprocessor(registerPreprocessor);
```

## Options

You can provide additional options to the init function. Each is optional.

```javascript
initRiotTypeScriptPreprocessor(registerPreprocessor, {

// Path to the eslint config file.
// Default is the process root.
eslintConfigPath: '...',

// Path to the typings for Riot files.
// Default is sourcePath + /client/typings.d.ts
riotTypingsPath: '...',

// Paths to additional typings (.d.ts) files
additionalTypings: ['...'],

// Root path for the source files.
// Defaults to './src'.
sourcePath: '...',

// Path to the tsconfig file to use with the TypeScript compiler.
// Defaults to the clientRootPath + 'tsconfig.json'.
tsconfigPath: '...',

// Set to true to disable the custom module resolver function.
// Defaults to false.
disableCustomResolver: false,

// Set to true to enable debug logging of module resolution.
// Defaults to false
logModuleResolution: false

});
```
