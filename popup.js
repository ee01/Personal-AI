const fetchDataButton = document.getElementById('fetchDataButton');
const indexingButton = document.getElementById('indexingButton');
const moreButton = document.getElementById('moreButton');

function toggleMore() {
  var moreOptions = document.getElementById('moreOptions');
  var moreButton = document.getElementById('moreButton');
  if (moreOptions.style.display === 'none' || moreOptions.style.display === '') {
    moreOptions.style.display = 'block';
    moreButton.textContent = 'Show Less Options';
  } else {
    moreOptions.style.display = 'none';
    moreButton.textContent = 'Show More Options';
  }
}

function getData(action) {
  const recentDaysInput = document.getElementById('recentDays');
  const apiKey = document.getElementById('apiKey');
  // const contactUserName = document.getElementById('contactUserName');
  const selectGroupName = document.getElementById('selectGroupName');
  // const selectDirectMessages = document.getElementById('selectDirectMessages');
  const ignoreGroupName = document.getElementById('ignoreGroupName');

  const enableMessage = document.getElementById('enableMessage').checked;
  const enableSms = document.getElementById('enableSms').checked;
  const enableVoicemail = document.getElementById('enableVoicemail').checked;;
  const enableCallTranscript = document.getElementById('enableCallTranscript').checked;
  const enableCalendar = document.getElementById('enableCalendar').checked;
  // const autoFilterGroup = document.getElementById('autoFilterGroup').checked
  const selectFolderGroupIds = document.getElementById('folder').value;
  const model = document.getElementById('model').value;

  const recentDays = +recentDaysInput.value || 1;
  const apiKeyValue = apiKey.value;
  // const contactUserNameValue = contactUserName.value;
  const selectGroupNameValue = selectGroupName.value;
  const ignoreGroupNameValue = ignoreGroupName.value;
  // const selectDirectMessagesValue = selectDirectMessages.checked;

  const data = { 
    type: 'RADAR-POC-CUSTOM',
    action: action,
    recentDays: recentDays,
    model: model,
    // groupPost: groupPostValue,
    apiKey: apiKeyValue,
    // contactUserName: contactUserNameValue,
    selectGroupName: selectGroupNameValue,
    // selectDirectMessages: selectDirectMessagesValue,
    ignoreGroupName: ignoreGroupNameValue,
    enableMessage: enableMessage,
    enableSms: enableSms,
    enableVoicemail: enableVoicemail,
    enableCallTranscript: enableCallTranscript,
    enableCalendar: enableCalendar,
    // autoFilterGroup: autoFilterGroup,
    selectFolderGroupIds: selectFolderGroupIds
  }

  return data;
}

moreButton.addEventListener('click', toggleMore);

indexingButton.addEventListener('click', () => {
  let result = window.confirm("Indexing is a relatively expensive operation. If you have already indexed, please do not repeat the indexing. Do you want to continue?");
  if (!result) {
    return;
  }

  const data = getData('INDEXING');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, data, (response) => {
      // Hide loading and show result
      if (response.status === 'success' && response.action === 'INDEXING') {
        console.log('indexing data sent successfully');
        window.close();
      }
    });
  });
});

fetchDataButton.addEventListener('click', () => {
  const data = getData('GENERATE_REPORT');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, data, (response) => {
      // Hide loading and show result
      if (response.status === 'success' && response.action === 'GENERATE_REPORT') {
        console.log('generate report data sent successfully');
        window.close();
      }
    });
  });
});


document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['folders'], function(result) {
    if (result.folders) {
      renderSelect(result.folders);
    } else {
      console.log("No data available");
    }
  });
});

function renderSelect(data) {
  const select = document.getElementById('folder');
  data.forEach(function(item) {
    let option = document.createElement('option');
    option.value = item.ids;
    option.textContent = item.title;
    select.appendChild(option);
  });
}