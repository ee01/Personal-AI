const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

const DotenvPlugin = require('dotenv-webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

// 处理 manifest 模板
const processManifestTemplate = (env) => {
  const manifestTemplate = fs.readFileSync(path.resolve(__dirname, 'src/manifest.json'), 'utf8');
  const manifestContent = manifestTemplate.replace('{{GOOGLE_CLIENT_ID}}', env.GOOGLE_CLIENT_ID);
  fs.writeFileSync(path.resolve(__dirname, 'static/manifest.json'), manifestContent);
};

module.exports = (env) => {
  // 在配置加载时处理 manifest
  processManifestTemplate(env);

  return {
    entry: {
      background: './src/background.ts',
      contentScript: './src/contentScript.tsx',
      contentScriptGoogleSheet: './src/contentScriptGoogleSheet.tsx',
      contentScriptJira: './src/contentScriptJira.ts',
      popup: './src/popup.tsx',
      options: './src/options.tsx',
      offscreen: './src/offscreen.ts',
      entityExtraction: './src/entityExtraction.ts',
      intelligentAgent: './src/intelligentAgent.ts',
      agentVisualizer: './src/agent-visualizer.tsx',
      'topic-modal': './src/topic-modal.tsx',
      'knowledge-query': './src/knowledge-query.tsx',
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
      fallback: {
        "fs": false,
        "path": require.resolve("path-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/")
      }
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
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
    ],
    optimization: {
      splitChunks: false,
      runtimeChunk: false
    },
  };
};
