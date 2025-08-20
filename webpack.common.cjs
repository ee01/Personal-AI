const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

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
      contentScriptGoogleSlide: './src/contentScriptGoogleSlide.tsx',
      contentScriptJira: './src/contentScriptJira.ts',
      contentScriptJiraAutomation: './src/contentScriptJiraAutomation.ts',
      contentScriptWebIntelligence: './src/contentScriptWebIntelligence.ts',
      popup: './src/popup.tsx',
      options: './src/options.tsx',
      offscreen: './src/offscreen.ts',
      entityExtraction: './src/entityExtraction.ts',
      agentThinking: './src/agentThinking.ts',
      agentVisualizer: './src/agent-visualizer.tsx',
      'topic-modal': './src/modals/topic-modal.tsx',
      'knowledge-query': './src/modals/knowledge-query.tsx',
      'slides-analysis': './src/modals/slides-analysis.tsx',
      'project-dashboard': './src/modals/project-dashboard.tsx',
      'enhanced-knowledge-query': './src/modals/enhanced-knowledge-query.tsx',
      'prompt-config': './src/modals/prompt-config.tsx',
      'analyzers/analyzerFactory': './src/analyzers/analyzerFactory.ts',
      'analyzers/llmAnalyzer': './src/analyzers/llmAnalyzer.ts',
      'analyzers/tableAnalyzer': './src/analyzers/tableAnalyzer.ts',
      'analyzers/textAnalyzer': './src/analyzers/textAnalyzer.ts',
      'memory': './src/modals/memory.tsx',
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
      publicPath: '/'
    },
    plugins: [
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
      new webpack.ProvidePlugin({
        SlideAnalyzerFactoryImpl: ['./src/analyzers/analyzerFactory', 'SlideAnalyzerFactoryImpl'],
        LLMContentAnalyzer: ['./src/analyzers/llmAnalyzer', 'LLMContentAnalyzer']
      })
    ],
    optimization: {
      splitChunks: false,
      runtimeChunk: false
    },
  };
};
