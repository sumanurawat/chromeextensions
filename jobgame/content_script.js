// Job Copilot Content Script
console.log("Job Copilot content script loaded");

// Function to extract job description using various heuristics
function extractJobDescription() {
  // Try common job description containers by ID and class names
  const possibleSelectors = [
    // LinkedIn selectors
    '.description__text', 
    '#job-details',
    '.job-description',
    
    // Indeed selectors
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    
    // Greenhouse selectors
    '.content-wrapper',
    '#content',
    
    // Generic selectors that might contain job info
    '[data-automation="jobDescription"]',
    '[data-testid="job-description"]',
    '.job-view-layout',
    '[class*="job-desc"]',
    '[class*="description"]',
    '[class*="job-details"]'
  ];
  
  // Try each selector until we find content
  for (const selector of possibleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 100) {
      console.log(`Found job description using selector: ${selector}`);
      return element.textContent.trim();
    }
  }
  
  // If no matches with specific selectors, look for sections with keywords
  const jobKeywords = ['requirements', 'qualifications', 'responsibilities', 'what youll do', 'what you will do', 'about this role', 'job summary', 'position summary'];
  const allParagraphs = document.querySelectorAll('p, div, section, article');
  
  let potentialContent = '';
  for (const element of allParagraphs) {
    const text = element.textContent.toLowerCase();
    
    // Check if this element likely contains part of a job description
    if (jobKeywords.some(keyword => text.includes(keyword)) && text.length > 100) {
      if (element.textContent.trim()) {
        potentialContent += element.textContent.trim() + "\\n\\n";
      }
    }
  }
  
  if (potentialContent.length > 200) {
    console.log("Found job description by keywords");
    return potentialContent;
  }
  
  // Last resort: get main content from the page
  const mainContent = document.querySelector('main') || document.querySelector('article');
  if (mainContent && mainContent.textContent.trim().length > 300) {
    console.log("Using main content section as job description");
    return mainContent.textContent.trim();
  }
  
  // Ultimate fallback: get body content but limit length
  const bodyText = document.body.textContent.trim();
  if (bodyText.length > 0) {
    console.log("Using body text as fallback (limited to 10000 chars)");
    return bodyText.substring(0, 10000);
  }
  
  return "Could not extract job description from this page.";
}

// Extract form fields (names and labels) on the page
function extractFormFields() {
  const fields = {};
  document.querySelectorAll('form input[name], form textarea[name], form select[name]').forEach(el => {
    let label = '';
    // Try to find associated label by for attribute
    if (el.id) {
      const lab = document.querySelector(`label[for="${el.id}"]`);
      if (lab) label = lab.innerText.trim();
    }
    // Fallback to placeholder or name
    if (!label) label = el.placeholder || el.name;
    fields[el.name] = label;
  });
  return fields;
}

// Update message listener to handle data extraction and form population
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    console.log('Content script received ping');
    sendResponse({ status: 'ok' });
    return true;
  }

  if (message.action === 'extractJobData') {
    console.log('Content script received extractJobData');
    const jobDescription = extractJobDescription();
    const formFields = extractFormFields();
    sendResponse({ jobDescription, formFields });
    return true;
  }

  if (message.action === 'populateForm') {
    console.log('Content script received populateForm', message.suggestions);
    const suggestions = message.suggestions || {};
    Object.entries(suggestions).forEach(([name, value]) => {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) {
        el.value = value;
      }
    });
    return;
  }

  if (message.action === 'extractJobDescription') {
    // legacy handler
    console.log('Content script received extract command.');
    const jobDescription = extractJobDescription();
    sendResponse({ jobDescription });
    return true;
  }

  return true; // Keep the message channel open
});
