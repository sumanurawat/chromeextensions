document.addEventListener('DOMContentLoaded', function() {
  const analyzeButton = document.getElementById('analyzeButton');
  const resultsDiv = document.getElementById('results');

  // Display latest result on popup load (for Task 3.5)
  // displayLatestResult(); // We'll uncomment this later

  if (analyzeButton) {
    analyzeButton.addEventListener('click', () => {
      console.log("Analyze button clicked."); // For Task 1.2 check
      resultsDiv.innerText = 'Analyzing...'; // Provide feedback

      // Task 1.4: Send message to background script
      chrome.runtime.sendMessage({ action: "analyzePage" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError.message);
          resultsDiv.innerText = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        console.log('Response from background:', response);
        // We will display actual results later (Task 3.5)
        // For now, just confirm receipt
        if (response && response.status) {
           // resultsDiv.innerText = `Background status: ${response.status}`; // Optional feedback
        } else {
           resultsDiv.innerText = 'Received unexpected response from background.';
        }
      });
    });
  } else {
    console.error("Analyze button not found.");
  }

  // Function to display results (for Task 3.5)
  /*
  function displayLatestResult() {
    chrome.storage.local.get('lastAnalysisResult', (result) => {
      if (resultsDiv) {
        resultsDiv.innerText = result.lastAnalysisResult || 'Click "Analyze Job Page" on a job description page.';
      }
    });
  }
  */

  // Listener for updates from background (for Task 3.5)
  /*
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analysisComplete") {
      console.log("Popup received analysis complete message.");
      displayLatestResult();
    }
  });
  */
});
