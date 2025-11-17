/**
 * Webpack 插件：移除生成代码中的 new Function() 调用
 * 这是为了符合 Chrome Extension Manifest V3 的要求，禁止动态代码执行
 */
class RemoveNewFunctionPlugin {
  apply(compiler) {
    const { RawSource } = compiler.webpack.sources;
    
    compiler.hooks.compilation.tap('RemoveNewFunctionPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RemoveNewFunctionPlugin',
          stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        (assets) => {
          Object.keys(assets).forEach((filename) => {
            if (!filename.endsWith('.js')) return;
            
            const asset = assets[filename];
            // 正确获取源代码字符串
            let source = asset.source().toString();
            
            // 替换 Webpack 运行时中的 new Function('return this')
            // 替换为直接返回 globalThis
            source = source.replace(
              /return this \|\| new Function\(['"]return this['"]\)\(\);/g,
              'return globalThis;'
            );
            
            // 移除所有 new Function() 调用
            // 使用更宽松的匹配，处理跨行和转义字符
            // 匹配: new Function("...任何内容...")();
            let newFunctionCount = 0;
            const maxIterations = 100;
            while (source.includes('new Function(') && newFunctionCount < maxIterations) {
              newFunctionCount++;
              // 找到 new Function( 的位置
              const startIdx = source.indexOf('new Function(');
              if (startIdx === -1) break;
              
              // 找到匹配的结束括号和调用括号
              let depth = 0;
              let inString = false;
              let stringChar = null;
              let escaped = false;
              let endIdx = startIdx + 'new Function('.length;
              
              for (let i = endIdx; i < source.length; i++) {
                const char = source[i];
                
                if (escaped) {
                  escaped = false;
                  continue;
                }
                
                if (char === '\\') {
                  escaped = true;
                  continue;
                }
                
                if (!inString) {
                  if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                  } else if (char === '(') {
                    depth++;
                  } else if (char === ')') {
                    if (depth === 0) {
                      // 检查后面是否有 ();
                      if (source[i+1] === '(' && source[i+2] === ')') {
                        endIdx = i + 3;
                      } else {
                        endIdx = i + 1;
                      }
                      break;
                    }
                    depth--;
                  }
                } else {
                  if (char === stringChar) {
                    inString = false;
                    stringChar = null;
                  }
                }
              }
              
              // 替换找到的 new Function() 调用
              // 使用不会被再次匹配的替换字符串
              source = source.substring(0, startIdx) + 
                      '/* removed: new_Function() for Manifest V3 compliance */ void 0'  +
                      source.substring(endIdx);
            }
            
            if (newFunctionCount >= maxIterations) {
              console.warn(`[RemoveNewFunctionPlugin] Warning: Reached max iterations (${maxIterations}) for ${filename}`);
            }
            
            // 更新资产
            compilation.updateAsset(filename, new RawSource(source));
          });
        }
      );
    });
  }
}

module.exports = RemoveNewFunctionPlugin;

