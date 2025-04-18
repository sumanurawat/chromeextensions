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
  // Look for inputs both within forms and directly on the page (many modern sites don't use <form> tags)
  document.querySelectorAll('input[name], textarea[name], select[name]').forEach(el => {
    // Skip hidden fields, submit buttons, and other non-fillable inputs
    if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || 
        el.type === 'file' || el.type === 'image' || el.type === 'reset' || 
        el.readOnly || el.disabled) {
      return;
    }

    let label = '';
    // Try to find associated label by for attribute
    if (el.id) {
      const lab = document.querySelector(`label[for="${el.id}"]`);
      if (lab) label = lab.innerText.trim();
    }

    // Try to find a parent label (for cases where the input is inside the label)
    if (!label) {
      const parentLabel = el.closest('label');
      if (parentLabel) {
        // Get text but exclude text from the input itself
        const clone = parentLabel.cloneNode(true);
        Array.from(clone.querySelectorAll('input, select, textarea')).forEach(input => input.remove());
        label = clone.textContent.trim();
      }
    }

    // Try to find nearby label or text
    if (!label) {
      // Look for nearby div or span with descriptive text
      const parent = el.parentElement;
      const siblings = parent ? Array.from(parent.children) : [];
      for (const sibling of siblings) {
        if ((sibling.tagName === 'DIV' || sibling.tagName === 'SPAN' || sibling.tagName === 'LABEL') && 
            sibling !== el && sibling.textContent.trim()) {
          label = sibling.textContent.trim();
          break;
        }
      }
    }

    // Fallback to placeholder or name
    if (!label) label = el.placeholder || el.name;
    
    console.log(`Found form field: ${el.name} (${label})`);
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
    
    // For debugging - log all form fields found on the page
    console.log('All form fields on page:');
    document.querySelectorAll('input[name], textarea[name], select[name]').forEach(el => {
      console.log(`- ${el.tagName} name="${el.name}" id="${el.id || ''}" type="${el.type || ''}" placeholder="${el.placeholder || ''}"`);
    });
    
    // Try to fill each field with its suggested value
    Object.entries(suggestions).forEach(([name, value]) => {
      console.log(`Trying to fill field "${name}" with value "${value}"`);
      
      // Try multiple selector strategies to find the field
      const selectors = [
        `[name="${name}"]`, // Exact name match
        `[id="${name}"]`,   // ID might match name
        `[name*="${name}"]`, // Name contains our name
        `[id*="${name}"]`,   // ID contains our name
        `input[placeholder*="${name}"]`, // Placeholder contains the name (case sensitive)
        `textarea[placeholder*="${name}"]`
      ];
      
      // Try each selector
      let el = null;
      for (const selector of selectors) {
        el = document.querySelector(selector);
        if (el) {
          console.log(`Found field using selector: ${selector}`);
          break;
        }
      }
      
      // If found, fill the field
      if (el) {
        try {
          // For select elements
          if (el.tagName === 'SELECT') {
            // Try to find an option that matches or contains our value
            let found = false;
            for (const option of el.options) {
              if (option.text.toLowerCase().includes(String(value).toLowerCase())) {
                el.value = option.value;
                found = true;
                break;
              }
            }
            
            // If no match, just set the value directly
            if (!found) {
              el.value = value;
            }
          } 
          // For checkboxes and radio buttons
          else if (el.type === 'checkbox' || el.type === 'radio') {
            // Convert value to boolean or treat "yes", "true", etc as checked
            const checkValue = String(value).toLowerCase();
            el.checked = (checkValue === 'true' || checkValue === 'yes' || checkValue === 'on' || value === true);
          } 
          // Regular inputs and textareas
          else {
            el.value = value;
            
            // Trigger change event to ensure any listeners know the field was updated
            const event = new Event('input', { bubbles: true });
            el.dispatchEvent(event);
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          console.log(`Successfully set value for ${name}`);
        } catch (err) {
          console.error(`Error setting value for ${name}:`, err);
        }
      } else {
        console.warn(`Could not find field with name "${name}" to populate`);
      }
    });
    
    // Confirm form filling is complete
    console.log('Form population complete');
    return true;
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
