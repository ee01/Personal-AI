chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'indexedDBData') {
      chrome.storage.local.set({folders: message.data}, function() {
        console.log('IndexedDB data stored for popup use');
      });
    }
  });