import {basename, dirname, join} from 'path';
// Warning: CLIEngine is being deprecated, but the new version is async
// which will not work with Riot
import {CLIEngine} from 'eslint';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line
const stripIndent = require('strip-indent');
import {readFileSync} from 'fs';
import {processTypeScript} from './preprocessor';
import * as ts from 'typescript';

export interface PreprocessorOptions {
  eslintConfigPath?: string;
  riotTypingsPath?: string;
  additionalTypings?: string[];
  sourcePath?: string;
  tsconfigPath?: string;
  disableCustomResolver?: boolean;
  logModuleResolution?: boolean;
}

export function initRiotTypeScriptPreprocessor(registerFn: (t: string, ext: string, fn: (src: string, opts: unknown) => Record<string, unknown>) => void, options: PreprocessorOptions = {}): void {
  options.eslintConfigPath = options.eslintConfigPath || join(process.cwd(), '.eslintrc');
  options.sourcePath = options.sourcePath || join(process.cwd(), 'src');
  options.riotTypingsPath = options.riotTypingsPath || join(options.sourcePath, 'client', 'typings.d.ts');
  options.additionalTypings = options.additionalTypings || [];
  options.tsconfigPath = options.tsconfigPath || join(options.sourcePath, 'tsconfig.json');
  options.disableCustomResolver = options.disableCustomResolver || false;
  const preprocessorOptions = options;

  if (preprocessorOptions.logModuleResolution) {
    process.env['RIOT_TS_PREPROCESSOR_LOG_RESOLUTION'] = 'true';
  }

  // setup eslint
  const eslintRules = JSON.parse(readFileSync(options.eslintConfigPath) as unknown as string);
  const cli = new CLIEngine(eslintRules);
  const formatter = cli.getFormatter();

  // Load the configuration from the tsconfig
  const config = JSON.parse(readFileSync(options.tsconfigPath).toString());
  const compilerOptions: ts.CompilerOptions = ts.parseJsonConfigFileContent(config, ts.sys, options.sourcePath).options;

  // Riot preprocessor for handling TypeScript inside Riot tags.
  // https://riot.js.org/compiler/#pre-processors
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  registerFn('javascript', 'ts', (source: string, {options}) => {
    const filename = `${basename(options.file)}.ts`;
    const fileRoot = dirname(options.file);
    const lintReport = cli.executeOnText(stripIndent(source), options.file);

    if (lintReport.errorCount > 0 || lintReport.warningCount > 0) {
      console.log(formatter(lintReport.results)); // eslint-disable-line
      throw new Error(`Linting reports ${lintReport.errorCount} errors and ${lintReport.warningCount} warnings in Riot components.`);
    }

    const allTypings = [preprocessorOptions.riotTypingsPath as string].concat(preprocessorOptions.additionalTypings as string[]);

    // basic type checking and transformation
    const {diagnostics, code, map} = processTypeScript(
      filename,
      source,
      fileRoot,
      compilerOptions,
      preprocessorOptions.disableCustomResolver as boolean,
      allTypings);
    if (diagnostics && diagnostics.length > 0) {
      throw new Error(`TypeScript compiler reports ${diagnostics.length} errors in Riot Components.`);
    }
    return {code, map};
  });
}
