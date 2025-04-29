// Handle scan button action
document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan');
  const output = document.getElementById('output');
  const aiOutput = document.getElementById('ai-output');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Set up tab functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Handle scan button click
  scanBtn.addEventListener('click', () => {
    // Show loading state
    output.textContent = 'Scanning page...';
    aiOutput.textContent = 'Generating AI summary...';
    aiOutput.classList.add('loading');
    
    // First, get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        output.textContent = 'Error: Could not find active tab';
        aiOutput.textContent = 'Error: Could not find active tab';
        aiOutput.classList.remove('loading');
        return;
      }
      
      const activeTab = tabs[0];
      
      // First inject config.js, then the content script to ensure config is available
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['config.js']
      })
      .then(() => {
        // Now inject the content script
        return chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content_script.js']
        });
      })
      .then(() => {
        // Now send message to the content script
        chrome.tabs.sendMessage(
          activeTab.id, 
          { type: 'scan' }, 
          (response) => {
            if (chrome.runtime.lastError) {
              const errorMsg = `Error: ${chrome.runtime.lastError.message}`;
              output.textContent = errorMsg;
              aiOutput.textContent = errorMsg;
              aiOutput.classList.remove('loading');
              console.error('Error:', chrome.runtime.lastError);
              return;
            }
            
            if (response) {
              // Display raw data in the output pre element
              output.textContent = JSON.stringify(response, null, 2);
              
              // Display AI summary in the ai-output div
              if (response.aiSummary) {
                aiOutput.innerHTML = response.aiSummary;
              } else {
                aiOutput.textContent = 'No AI summary generated';
              }
              
              aiOutput.classList.remove('loading');
            } else {
              output.textContent = 'No response from page';
              aiOutput.textContent = 'No response from page';
              aiOutput.classList.remove('loading');
            }
          }
        );
      })
      .catch(err => {
        const errorMsg = `Failed to inject script: ${err.message}`;
        output.textContent = errorMsg;
        aiOutput.textContent = errorMsg;
        aiOutput.classList.remove('loading');
        console.error('Script injection error:', err);
      });
    });
  });
});
