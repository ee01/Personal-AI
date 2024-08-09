const fetchDataButton = document.getElementById('fetchDataButton');
const recentDaysInput = document.getElementById('recentDays');
const groupPost = document.getElementById('groupPost');

fetchDataButton.addEventListener('click', () => {
  const recentDays = +recentDaysInput.value || 1;
  const groupPostValue = groupPost.checked; // 获取复选框的值
  const now = new Date(); // 获取当前时间
  const startTime = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000); // 计算开始时间
  console.log(`Start Time: ${startTime}`);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_INDEX_DB_DATA", startTime: startTime, groupPost: groupPostValue }, (response) => {
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
