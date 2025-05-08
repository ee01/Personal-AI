const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');

module.exports = (env) => {
  // 加载开发环境变量
  const dotenv = require('dotenv').config();
  
  return merge(common({
    ...env,
    GOOGLE_CLIENT_ID: dotenv.parsed.GOOGLE_CLIENT_ID
  }), {
    mode: 'development',
    devtool: 'source-map',
  });
};