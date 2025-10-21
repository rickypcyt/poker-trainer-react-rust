// Hot refresh utility for development
let hotRefreshServer: any = null;

export function startHotRefreshServer() {
  // Only start in development mode
  if (import.meta.env.DEV) {
    try {
      // Hot refresh server is not available in browser environment
      // This functionality would need to be implemented differently for browser-based hot refresh
      console.log('🔄 [HOT REFRESH] Hot refresh server not available in browser environment');
      return;
    } catch (error) {
      console.log('⚠️ [HOT REFRESH] Could not start hot refresh server:', error);
    }
  }
}

export function stopHotRefreshServer() {
  if (hotRefreshServer) {
    hotRefreshServer.close();
    hotRefreshServer = null;
    console.log('🔄 [HOT REFRESH] Server stopped');
  }
}
