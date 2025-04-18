// filepath: /Users/sumanurawat/Documents/GitHub/chromeextensions/jobgame/popup.js
document.addEventListener('DOMContentLoaded', function() {
  const analyzeButton = document.getElementById('analyzeButton');
  const resultsDiv = document.getElementById('results');

  // Display latest result on popup load (for Task 3.5)
  displayLatestResult();

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
        
        if (response && response.status === "processing") {
          resultsDiv.innerText = "Processing job description...";
          // The actual results will be displayed when analysisComplete message is received
        } else if (response && response.status === "error") {
          resultsDiv.innerText = `Error: ${response.message || "Unknown error"}`;
        }
      });
    });
  } else {
    console.error("Analyze button not found.");
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in popup:", message);
    
    if (message.action === "analysisComplete") {
      // Display the latest analysis result when notified
      displayLatestResult();
    } else if (message.action === "analysisError") {
      resultsDiv.innerText = `Error: ${message.error || "Unknown error"}`;
    }
  });
});

// Function to display the latest analysis result from storage
function displayLatestResult() {
  const resultsDiv = document.getElementById('results');
  
  chrome.storage.local.get('lastAnalysisResult', (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error retrieving results:", chrome.runtime.lastError.message);
      return;
    }
    
    if (result.lastAnalysisResult) {
      resultsDiv.innerText = result.lastAnalysisResult;
    } else {
      // Only show if not in the middle of an analysis
      if (resultsDiv.innerText !== 'Analyzing...' && 
          !resultsDiv.innerText.startsWith('Processing')) {
        resultsDiv.innerText = "No analysis results yet. Click 'Analyze Job Page' to begin.";
      }
    }
  });
}
