const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');
const webpack = require('webpack');

module.exports = (env) => {
  // 加载开发环境变量
  const dotenv = require('dotenv').config();
  
  return merge(common({
    ...env,
    GOOGLE_CLIENT_ID: dotenv.parsed.GOOGLE_CLIENT_ID,
    ICON_NAME: dotenv.parsed.ICON_NAME
  }), {
    mode: 'production',
    devtool: 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(dotenv.parsed)
      })
    ],
    optimization: {
      minimize: false // 关闭压缩以避免 Terser 错误
    }
  });
};