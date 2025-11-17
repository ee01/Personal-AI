const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');
const webpack = require('webpack');

module.exports = (env) => {
  // 加载开发环境变量
  const dotenv = require('dotenv').config();
  
  const config = common({
    ...env,
    GOOGLE_CLIENT_ID: dotenv.parsed.GOOGLE_CLIENT_ID,
    ICON_NAME: dotenv.parsed.ICON_NAME
  });

  return merge(config, {
    mode: 'production',
    devtool: 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env': JSON.stringify(dotenv.parsed),
        // 禁用 MobX 的调试功能，避免使用 new Function()
        '__DEV__': false,
      }),
      new webpack.BannerPlugin({
        banner: '/* Manifest V3 compliant - no remote code execution */',
        raw: true,
      })
    ],
    optimization: {
      minimize: false, // 关闭压缩以避免 Terser 错误
      nodeEnv: 'production',
    }
  });
};