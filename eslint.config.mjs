import * as eslintConfig from '@lsby/eslint-config'
import noAbsoluteSrcImport from './scripts/eslint/rule/no-absolute-src-import.js'

let 作用域 = ['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts']

export default [
  { ignores: [...eslintConfig.常用忽略域, 'data/**', 'baselines/**', 'runs/**', 'pnpm-lock.yaml'] },
  { ...eslintConfig.ts安全性, files: 作用域 },
  { ...eslintConfig.jsDoc安全性, files: 作用域 },
  { ...eslintConfig.风格美化, files: 作用域 },
  {
    files: 作用域,
    plugins: { project: { rules: { 'no-absolute-src-import': noAbsoluteSrcImport } } },
    rules: { 'project/no-absolute-src-import': 'error' },
  },
]
