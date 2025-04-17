// Functions to manage options page
document.addEventListener('DOMContentLoaded', function() {
  // Load saved options when the page opens
  loadSavedOptions();
  
  // Set up event listener for the save button
  document.getElementById('saveOptions').addEventListener('click', saveOptions);
});

// Load saved options from Chrome storage
function loadSavedOptions() {
  chrome.storage.local.get(['profile', 'apiKey'], (result) => {
    if (result.profile) {
      document.getElementById('profileData').value = result.profile;
    }
    
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });
}

// Save options to Chrome storage
function saveOptions() {
  const profileData = document.getElementById('profileData').value;
  const apiKey = document.getElementById('apiKey').value;
  const statusElement = document.getElementById('status');
  
  // Validate JSON if profile data is provided
  if (profileData) {
    try {
      // Check if it's valid JSON by parsing it
      JSON.parse(profileData);
    } catch (e) {
      // Show error if JSON is invalid
      showStatus('Invalid JSON format in profile data. Please check and try again.', 'error');
      return;
    }
  }
  
  // Save to Chrome storage
  chrome.storage.local.set(
    { 
      profile: profileData, 
      apiKey: apiKey 
    }, 
    () => {
      // Show success message
      showStatus('Options saved successfully!', 'success');
    }
  );
}

// Helper function to show status messages
function showStatus(message, type) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.style.display = 'block';
  
  // Remove any existing classes
  statusElement.className = '';
  
  // Add appropriate class based on message type
  if (type === 'success') {
    statusElement.classList.add('success');
  } else if (type === 'error') {
    statusElement.classList.add('error');
  }
  
  // Hide the status message after 3 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}
