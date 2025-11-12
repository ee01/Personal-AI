const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const NodeProtocolResolverPlugin = require('./node-protocol-resolver.cjs');

// 处理 manifest 模板
const processManifestTemplate = (env) => {
  const manifestTemplate = fs.readFileSync(path.resolve(__dirname, 'src/manifest.json'), 'utf8');
  const manifestContent = manifestTemplate.replace('{{GOOGLE_CLIENT_ID}}', env.GOOGLE_CLIENT_ID).replaceAll('{{ICON_NAME}}', env.ICON_NAME || 'icon');
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
      contentScriptGoogleSlide: './src/contentScriptGoogleSlide.tsx',
      contentScriptJira: './src/contentScriptJira.ts',
      contentScriptJiraAutomation: './src/contentScriptJiraAutomation.ts',
      contentScriptWebIntelligence: './src/contentScriptWebIntelligence.ts',
      popup: './src/popup.tsx',
      options: './src/options.tsx',
      offscreen: './src/offscreen.ts',
      agentThinking: './src/agentThinking.ts',
      agentVisualizer: './src/agent-visualizer.tsx',
      'topic-modal': './src/modals/topic-modal.tsx',
      'slides-analysis': './src/modals/slides-analysis.tsx',
      'project-dashboard': './src/modals/project-dashboard.tsx',
      'prompt-config': './src/modals/prompt-config.tsx',
      'analyzers/analyzerFactory': './src/analyzers/analyzerFactory.ts',
      'analyzers/llmAnalyzer': './src/analyzers/llmAnalyzer.ts',
      'analyzers/tableAnalyzer': './src/analyzers/tableAnalyzer.ts',
      'analyzers/textAnalyzer': './src/analyzers/textAnalyzer.ts',
      'memory-exploring': './src/modals/memory-exploring-entry.ts',
      'scheduled-messages': './src/scheduled-messages/ScheduledMessagesManager.tsx',
    },
    module: {
      rules: [
        {
          test: /\.(js|ts)x?$/,
          use: ['babel-loader'],
          exclude: /node_modules/,
        },
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.css$/,
          use: ['vue-style-loader', 'css-loader']
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.tsx', '.jsx', '.vue'],
      fallback: {
        "fs": false,
        "path": require.resolve("path-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/"),
        "process": require.resolve("process/browser.js"),
        "process/browser": require.resolve("process/browser.js"),
        "node:process": require.resolve("process/browser.js"),
        "node:path": require.resolve("path-browserify"),
        "node:crypto": require.resolve("crypto-browserify"),
        "node:stream": require.resolve("stream-browserify"),
        "node:buffer": require.resolve("buffer/"),
        "node:fs": false,
        "node:util": require.resolve("util/"),
        "node:url": require.resolve("url/")
      },
      plugins: [
        new NodeProtocolResolverPlugin()
      ]
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
      publicPath: '/'
    },
    plugins: [
      new VueLoaderPlugin(),
      // 处理 node: 协议导入的插件
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
      new ESLintPlugin({
        extensions: ['js', 'ts', 'jsx', 'tsx', 'vue'],
        overrideConfigFile: path.resolve(__dirname, '.eslintrc'),
      }),
      new CopyPlugin({
        patterns: [
          { from: 'static' },
          // { from: 'docs/demo', to: 'demo' },
          { from: 'src/scheduled-messages/app-script-template.gs', to: 'app-script-template.gs' },
          // 复制 WASM 文件以符合 Manifest V3 要求（禁止远程托管代码）
          { 
            from: 'node_modules/@xenova/transformers/dist/*.wasm', 
            to: '[name][ext]',
            noErrorOnMissing: true 
          }
        ],
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser.js',
      }),
      new webpack.ProvidePlugin({
        SlideAnalyzerFactoryImpl: ['./src/analyzers/analyzerFactory', 'SlideAnalyzerFactoryImpl'],
        LLMContentAnalyzer: ['./src/analyzers/llmAnalyzer', 'LLMContentAnalyzer']
      }),
      // 定义 Vue 特性标志
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: JSON.stringify(true),
        __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
      })
    ],
    optimization: {
      splitChunks: false,
      runtimeChunk: false
    },
  };
};
