const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');
const webpack = require('webpack');
const path = require('path');

function loadMergedEnv() {
  const root = require('dotenv').config({
    path: path.resolve(__dirname, '.env'),
  });
  const dev = require('dotenv').config({
    path: path.resolve(__dirname, '.env.development'),
  });
  const parsed = { ...(root.parsed || {}) };
  for (const [key, value] of Object.entries(dev.parsed || {})) {
    if (String(value || '').trim()) parsed[key] = value;
  }
  return parsed;
}

module.exports = (env) => {
  const parsed = loadMergedEnv();

  return merge(
    common({
      ...env,
      GOOGLE_CLIENT_ID: parsed.GOOGLE_CLIENT_ID,
      ICON_NAME: parsed.ICON_NAME,
    }),
    {
      mode: 'development',
      devtool: 'inline-source-map',
      devServer: {
        static: './dist',
      },
      plugins: [
        new webpack.DefinePlugin({
          'process.env': JSON.stringify(parsed),
        }),
      ],
    },
  );
};