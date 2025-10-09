const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = (env) => {
  // 加载开发环境变量
  const dotenv = require('dotenv').config({ path: '.env.development' });
  
  return merge(common({
    ...env,
    GOOGLE_CLIENT_ID: dotenv.parsed.GOOGLE_CLIENT_ID
  }), {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
      static: './dist',
    },
    plugins: [
      // 似乎不生效
      new Dotenv({
        path: '.env.development'
      })
    ]
  });
};