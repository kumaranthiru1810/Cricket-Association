/**
 * backend/eslint.config.js
 * ESLint Flat Configuration for Node.js Backend
 */

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'uploads/**',
      'docs/**',
      'coverage/**',
      'tests/**',
      'backups/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Buffer: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setImmediate: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        Boolean: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        RegExp: 'readonly',
        Error: 'readonly',
        JSON: 'readonly',
        encodeURIComponent: 'readonly',
        decodeURIComponent: 'readonly',
        global: 'writable'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-constant-condition': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  }
];
