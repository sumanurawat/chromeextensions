console.log("Background script loaded."); // Task 1.3 check

// Task 1.4: Listener for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message); // Log entire message for debugging
  if (message.action === "analyzePage") {
    console.log("Analyze page message received from popup."); // Task 1.4 check

    // Placeholder for Task 3.2: Get active tab and send message to content script
    // For now, just send a simple response back to the popup
    sendResponse({ status: "Received by background" });
  }
  // Return true to indicate you wish to send a response asynchronously.
  // This is important even if you sendResponse synchronously in simple cases,
  // and crucial if you do any async work before sending the response.
  return true;
});

// Placeholder for Task 3.2 logic (will be expanded later)
function triggerContentScriptAnalysis(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "extractJobDescription" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message to content script:", chrome.runtime.lastError.message);
      // Handle error - maybe send an error status back to popup?
      // chrome.runtime.sendMessage({ action: "analysisError", error: chrome.runtime.lastError.message });
      return;
    }
    if (response && response.jobDescription) {
      console.log("Background received JD:", response.jobDescription);
      // TODO: Task 3.4 - Retrieve API key/profile and call Gemini
      // For now, maybe store the JD or send it back to popup if needed immediately
      // chrome.storage.local.set({ lastJobDescription: response.jobDescription });
      // chrome.runtime.sendMessage({ action: "jdReceived", jobDescription: response.jobDescription });
    } else {
      console.log("No job description received from content script or empty response.");
      // Handle case where content script couldn't find JD
      // chrome.runtime.sendMessage({ action: "analysisError", error: "Could not extract job description." });
    }
  });
}
