console.log("Background script loaded."); // Task 1.3 check

// Task 1.4: Listener for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message); // Log entire message for debugging
  if (message.action === "analyzePage") {
    console.log("Analyze page message received from popup."); // Task 1.4 check

    // Task 3.2: Get active tab and send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error("No active tab found");
        sendResponse({ status: "error", message: "No active tab found" });
        return;
      }
      
      const tabId = tabs[0].id;
      // Call the function to handle job description extraction
      triggerContentScriptAnalysis(tabId);
      
      // Let the popup know we're processing the request
      sendResponse({ status: "processing" });
    });
  }
  // Return true to indicate you wish to send a response asynchronously.
  // This is important even if you sendResponse synchronously in simple cases,
  // and crucial if you do any async work before sending the response.
  return true;
});

// Task 3.2: Function to communicate with content script
function triggerContentScriptAnalysis(tabId) {
  // First, check if we can communicate with existing content script
  chrome.tabs.sendMessage(tabId, { action: "ping" }, function(response) {
    if (chrome.runtime.lastError) {
      console.log("Content script not yet loaded, injecting it now...");
      
      // Explicitly inject the content script
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content_script.js']
      }).then(() => {
        console.log("Content script injected successfully");
        // Now try to communicate with the freshly injected content script
        setTimeout(() => {
          sendMessageToContentScript(tabId);
        }, 300); // Small delay to ensure script initialization
      }).catch(err => {
        console.error("Error injecting content script:", err);
        chrome.runtime.sendMessage({ 
          action: "analysisError", 
          error: "Could not inject content script: " + err.message 
        });
      });
    } else {
      console.log("Content script already loaded");
      sendMessageToContentScript(tabId);
    }
  });
}

// Helper function to send message to content script
function sendMessageToContentScript(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "extractJobData" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message to content script:", chrome.runtime.lastError.message);
      // Handle error - send an error status back to popup
      chrome.runtime.sendMessage({ 
        action: "analysisError", 
        error: chrome.runtime.lastError.message 
      });
      return;
    }
    
    if (response && response.jobDescription) {
      console.log("Background received JD:", response.jobDescription);
      
      // Check if we have form fields to fill
      if (response.formFields && Object.keys(response.formFields).length > 0) {
        console.log("Form fields detected:", response.formFields);
        // Call Gemini API with job description AND form fields
        callGeminiAPIWithFormFields(tabId, response.jobDescription, response.formFields);
      } else {
        // If no form fields, just analyze the job description as before
        callGeminiAPI(response.jobDescription);
      }
    } else {
      console.log("No job description received from content script or empty response.");
      // Handle case where content script couldn't find JD
      chrome.runtime.sendMessage({ 
        action: "analysisError", 
        error: "Could not extract job description." 
      });
    }
  });
}

// Task 3.4: Call Gemini API
function callGeminiAPI(jobDescription) {
  // Retrieve API key and profile data from storage
  chrome.storage.local.get(['apiKey', 'profile'], (result) => {
    if (!result.apiKey) {
      console.error("No API key found in storage");
      chrome.runtime.sendMessage({ 
        action: "analysisError", 
        error: "Please set your Gemini API key in the options page." 
      });
      return;
    }

    if (!result.profile) {
      console.error("No profile data found in storage");
      chrome.runtime.sendMessage({ 
        action: "analysisError", 
        error: "Please set your profile data in the options page." 
      });
      return;
    }

    // Construct the prompt for Gemini
    const prompt = `My profile:
${result.profile}

Job Description:
${jobDescription}

Please analyze the job description and suggest bullet points from my profile suitable for a CV for this role.`;

    // API call to Gemini using the correct v1beta endpoint and generation_config
    const model = 'gemini-1.5-pro'; // Using stable version
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${result.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generation_config: { 
        maxOutputTokens: 1024, // Increased token limit
        temperature: 0.2,
        topP: 0.95
      }
    };
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(json => {
        console.log("Full Gemini API response:", json);
        console.log("Response structure:", JSON.stringify(json, null, 2).substring(0, 500)); // Cleaner debug output
        let analysisResult = "";

        // Handle different possible response formats
        if (json.candidates && json.candidates.length > 0) {
          const candidate = json.candidates[0];
          if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
            analysisResult = candidate.content.parts[0].text;
          } else if (candidate.output) {
            analysisResult = candidate.output;
          }
        } else if (json.text) {
          analysisResult = json.text;
        }

        // Check for empty result but valid response structure
        if (analysisResult === "" && json.candidates && json.candidates[0]) {
          analysisResult = "The AI couldn't generate a response. This could be due to content filtering or token limits. Please try again with a shorter job description.";
        }

        if (!analysisResult) {
          console.error("Unexpected API structure:", json);
          throw new Error("Unexpected API response format");
        }

        // Store the result and notify the popup
        chrome.storage.local.set({ lastAnalysisResult: analysisResult }, () => {
          chrome.runtime.sendMessage({ action: 'analysisComplete' });
        });
      })
      .catch(err => {
        console.error('Gemini API error:', err);
        chrome.runtime.sendMessage({ action: 'analysisError', error: err.message });
      });
  });
}

// Function to call Gemini API with job description and form fields
function callGeminiAPIWithFormFields(tabId, jobDescription, formFields) {
  // Retrieve API key and profile data from storage
  chrome.storage.local.get(['apiKey', 'profile'], (result) => {
    if (!result.apiKey || !result.profile) {
      // Error handling for missing API key or profile (reusing existing code)
      chrome.runtime.sendMessage({ 
        action: "analysisError", 
        error: !result.apiKey ? 
          "Please set your Gemini API key in the options page." : 
          "Please set your profile data in the options page." 
      });
      return;
    }

    // Create form fields section for the prompt
    const formFieldsText = Object.entries(formFields)
      .map(([name, label]) => `${label} (field name: ${name})`)
      .join('\n');

    // Create a more specific prompt for form filling
    const prompt = `My profile data:
${result.profile}

Job Description:
${jobDescription}

I need to fill out a job application form that has the following fields:
${formFieldsText}

Based on my profile and the job description, please provide appropriate values for each form field.
Format your response as a JSON object with field names as keys and suggested values as values.
For example: {"firstName": "John", "workExperience": "5 years of experience in..."}
Only include fields that you can confidently fill based on my profile information.`;

    // API call to Gemini
    const model = 'gemini-1.5-pro';
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${result.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generation_config: { 
        maxOutputTokens: 1024,
        temperature: 0.2,
        topP: 0.95
      }
    };

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(res => {
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res.json();
    })
    .then(json => {
      console.log("Form field suggestions response:", json);
      
      let responseText = "";
      if (json.candidates && json.candidates[0] && json.candidates[0].content && 
          json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
        responseText = json.candidates[0].content.parts[0].text;
      }
      
      if (!responseText) {
        throw new Error("No form field suggestions generated");
      }
      
      // Try to extract JSON from the response (AI might include explanation text)
      let suggestions = {};
      try {
        // Look for JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, still show the text response
          chrome.storage.local.set({ 
            lastAnalysisResult: "AI generated suggestions but not in the expected format:\n\n" + responseText 
          }, () => {
            chrome.runtime.sendMessage({ action: 'analysisComplete' });
          });
          return;
        }
      } catch (e) {
        console.error("Error parsing suggestions JSON:", e);
        chrome.storage.local.set({ 
          lastAnalysisResult: "Could not parse AI suggestions. Raw response:\n\n" + responseText 
        }, () => {
          chrome.runtime.sendMessage({ action: 'analysisComplete' });
        });
        return;
      }
      
      // Send suggestions to content script to fill the form
      chrome.tabs.sendMessage(tabId, { 
        action: 'populateForm',
        suggestions: suggestions
      });
      
      // Also store the result for display in popup
      const formattedSuggestions = Object.entries(suggestions)
        .map(([field, value]) => `${field}: ${value}`)
        .join('\n\n');
        
      chrome.storage.local.set({ 
        lastAnalysisResult: "Form field suggestions:\n\n" + formattedSuggestions 
      }, () => {
        chrome.runtime.sendMessage({ action: 'analysisComplete' });
      });
    })
    .catch(err => {
      console.error('Gemini API form suggestions error:', err);
      chrome.runtime.sendMessage({ 
        action: 'analysisError', 
        error: `Form field suggestions error: ${err.message}` 
      });
    });
  });
}
