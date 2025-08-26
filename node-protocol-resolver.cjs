// Custom webpack plugin to handle node: protocol imports
class NodeProtocolResolverPlugin {
  apply(resolver) {
    const target = resolver.ensureHook("resolve");
    
    resolver.getHook("before-resolve").tapAsync("NodeProtocolResolverPlugin", (request, resolveContext, callback) => {
      if (request.request && request.request.startsWith("node:")) {
        const moduleName = request.request.slice(5); // Remove 'node:' prefix
        const newRequest = {
          ...request,
          request: moduleName
        };
        
        return resolver.doResolve(
          target,
          newRequest,
          `resolve node:${moduleName} as ${moduleName}`,
          resolveContext,
          callback
        );
      }
      callback();
    });
  }
}

module.exports = NodeProtocolResolverPlugin;
