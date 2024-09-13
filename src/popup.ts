function sendMessageToActiveTab(data: object, type: string) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, data, (response) => {
      if (response.status === 'done' && response.type === type) {
        window.close();
      }
    });
  });
}

function Init() {
  const type = 'RADAR-POC-OPEN-PANEL';
  const data = {
    type: type,
  };

  sendMessageToActiveTab(data, type);
}

window.onload = function() {
  Init();
}
