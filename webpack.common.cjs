const path = require('path');

const DotenvPlugin = require('dotenv-webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    contentScript: './src/contentScript.tsx',
    popup: './src/popup.ts',
    background: './src/background.ts',
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)x?$/,
        use: ['babel-loader'],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new DotenvPlugin(),
    new ESLintPlugin({
      extensions: ['js', 'ts', 'jsx', 'tsx'],
      overrideConfigFile: path.resolve(__dirname, '.eslintrc'),
    }),
    new CopyPlugin({
      patterns: [{ from: 'static' }],
    }),
  ],
};
