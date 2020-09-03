import * as ts from 'typescript';
import { join, resolve, basename, dirname } from 'path';
import {ResolvedModuleFull} from 'typescript';

/**
 * Custom module resolver for the TypeScript compiler.
 * https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
 */
function resolveModuleNames(
  moduleNames: string[],
  containingFile: string,
  fileRoot: string,
  compilerOptions: ts.CompilerOptions
): ts.ResolvedModuleFull [] {
  const moduleSearchLocations = [fileRoot];
  const moduleExtensions = ['.d.ts', '.ts', '.riot'];
  const resolvedModules: ts.ResolvedModuleFull[] = [];

  for (const moduleName of moduleNames) {
    // try to use the default TypeScript resolver first
    const result = ts.resolveModuleName(moduleName, containingFile, compilerOptions, {
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile
    });

    // If the default resolver found the module, add the module to the list;
    // otherwise, doing custom resolution. This is so we can handle custom
    // files like other Riot tags.
    if (result.resolvedModule) {
      resolvedModules.push(result.resolvedModule);
    } else {
      // check fallback locations
      let foundModule = false;
      for (const location of moduleSearchLocations) {
        for (const extension of moduleExtensions) {
          const fullPath = resolve(join(location, dirname(moduleName)));
          const baseName = basename(moduleName, extension);
          const modulePath = join(fullPath, `${baseName}${extension}`);

          if (ts.sys.fileExists(modulePath)) {
            resolvedModules.push({
              resolvedFileName: modulePath,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              // .riot is not a known TypeScript Extension
              extension,
              isExternalLibraryImport: false
            });
            foundModule = true;
            break;
          }
        }
        if (foundModule) {
          break;
        }
      }
    }
  }

  return resolvedModules;
}

function stripTSExtension(filename: string): string {
  if (!filename.endsWith('ts')) {
    return filename;
  }

  // leaving the "." on purpose
  return filename.slice(0, -2);
}

export type PreprocessorResult = {
  diagnostics: ts.Diagnostic[];
  code: string;
  map: string;
};

export function processTypeScript(sourceFile: string, contents: string, fileRoot: string, compilerOptions: ts.CompilerOptions, disableCustomModuleResolver: boolean, additionalTypings: string[] = []): PreprocessorResult {
  // Any compiled code will be stored in `output`
  let output: string;
  // Any compiled sourcemaps will be stored in `map`
  let map: string;

  const sourceFileWithoutExtension = stripTSExtension(sourceFile);

  // Create a compilerHost object to allow the compiler to read and write files
  const compilerHost: ts.CompilerHost = {
    getSourceFile: function (filename, languageVersion) {
      if (filename === sourceFile) {
        return ts.createSourceFile(filename, contents, compilerOptions.target || ts.ScriptTarget.Latest, false);
      }

      const sourceText = ts.sys.readFile(filename);
      return sourceText !== undefined
        ? ts.createSourceFile(filename, sourceText, languageVersion)
        : undefined;
    },
    writeFile: (name, text) => {
      // write out to output or sourcemap depending on the data
      name = basename(name);
      if (name.replace('js', '') === sourceFileWithoutExtension) {
        output = text;
      }
      if (name.replace('js.map', '') === sourceFileWithoutExtension) {
        map = text;
      }
    },
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    getNewLine: () => ts.sys.newLine,
    getCanonicalFileName: fileName =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames
  };

  if (!disableCustomModuleResolver) {
    compilerHost.resolveModuleNames = (moduleNames, containingFile): ResolvedModuleFull[] => resolveModuleNames(
      moduleNames,
      containingFile,
      fileRoot,
      compilerOptions
    );
  }

  // Create a program from inputs
  const program = ts.createProgram([
    ...additionalTypings,
    sourceFile
  ], compilerOptions, compilerHost);
  const emitResult = program.emit();
  const allDiagnostics: ts.Diagnostic[] = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  // formatted console log of errors
  if (allDiagnostics.length > 0) {
    console.log(ts.formatDiagnosticsWithColorAndContext(allDiagnostics, compilerHost));
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return {diagnostics: allDiagnostics, code: output, map};
}
