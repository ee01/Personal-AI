const fetchDataButton = document.getElementById('fetchDataButton');
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

moreButton.addEventListener('click', toggleMore);

fetchDataButton.addEventListener('click', () => {
  const recentDaysInput = document.getElementById('recentDays');
  const groupPost = document.getElementById('groupPost');
  const apiKey = document.getElementById('apiKey');
  const contactUserName = document.getElementById('contactUserName');
  const selectGroupName = document.getElementById('selectGroupName');
  // const selectDirectMessages = document.getElementById('selectDirectMessages');
  const ignoreGroupName = document.getElementById('ignoreGroupName');

  const enableMessage = document.getElementById('enableMessage').checked;
  const enableSms = document.getElementById('enableSms').checked;
  const enableVoicemail = document.getElementById('enableVoicemail').checked;;
  const enableCallTranscript = document.getElementById('enableCallTranscript').checked;
  const autoFilterGroup = document.getElementById('autoFilterGroup').checked
  const selectFolderGroupIds = document.getElementById('folder').value;

  const recentDays = +recentDaysInput.value || 1;
  const groupPostValue = groupPost.checked; // 获取复选框的值
  const apiKeyValue = apiKey.value;
  const contactUserNameValue = contactUserName.value;
  const selectGroupNameValue = selectGroupName.value;
  const ignoreGroupNameValue = ignoreGroupName.value;
  // const selectDirectMessagesValue = selectDirectMessages.checked;

  const now = new Date(); // 获取当前时间
  const startTime = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000); // 计算开始时间
  console.log(`Start Time: ${startTime}`);
  const data = { 
    type: "GET_INDEX_DB_DATA",
    startTime: startTime,
    groupPost: groupPostValue,
    apiKey: apiKeyValue,
    contactUserName: contactUserNameValue,
    selectGroupName: selectGroupNameValue,
    // selectDirectMessages: selectDirectMessagesValue,
    ignoreGroupName: ignoreGroupNameValue,
    enableMessage: enableMessage,
    enableSms: enableSms,
    enableVoicemail: enableVoicemail,
    enableCallTranscript: enableCallTranscript,
    autoFilterGroup: autoFilterGroup,
    selectFolderGroupIds: selectFolderGroupIds
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, data, (response) => {
      // Hide loading and show result
      if (response.status === 'success') {
        console.log('Data sent successfully');
        window.close();
      } else {
        console.error('Failed to fetch data:', response.error);
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