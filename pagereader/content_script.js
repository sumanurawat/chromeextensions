// Content script for Page Reader extension
console.log('Page Reader content script loaded');

// Import configuration from config.js (handled via manifest.json)
// The config object should be available globally if config.js is loaded before this script

// Function to scan the page and extract structure
function scanPage() {
  // Get page title
  const title = document.title;
  
  // Get page metadata
  const metadata = {};
  document.querySelectorAll('meta').forEach(meta => {
    if (meta.name && meta.content) {
      metadata[meta.name] = meta.content;
    } else if (meta.property && meta.content) {
      metadata[meta.property] = meta.content;
    }
  });
  
  // Get main headings
  const headings = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
    headings.push({
      level: parseInt(heading.tagName.substring(1)),
      text: heading.textContent.trim()
    });
  });
  
  // Get all links without limit
  const links = [];
  document.querySelectorAll('a[href]').forEach(link => {
    links.push({
      text: link.textContent.trim(),
      href: link.href,
      id: link.id || '',
      classes: Array.from(link.classList).join(' ') || ''
    });
  });
  
  // Get all images without limit
  const images = [];
  document.querySelectorAll('img[src]').forEach(img => {
    images.push({
      alt: img.alt,
      src: img.src,
      width: img.width,
      height: img.height
    });
  });
  
  // Enhanced form field detection
  const formFields = [];
  
  // Function to extract text content from an element and its children
  function getElementText(element) {
    if (!element) return '';
    return element.innerText || element.textContent || '';
  }
  
  // Helper function to find associated label
  function findLabel(field) {
    // Try to find explicit label with for attribute
    if (field.id) {
      const labelElem = document.querySelector(`label[for="${field.id}"]`);
      if (labelElem) {
        return getElementText(labelElem).trim();
      }
    }
    
    // Look for parent label (implicit label)
    let parent = field.parentElement;
    while (parent) {
      if (parent.tagName === 'LABEL') {
        // Remove the field's own text content from the label
        const labelText = getElementText(parent).trim();
        return labelText;
      }
      // Check for label-like elements nearby
      const siblingLabel = parent.querySelector('label, .label, [aria-label], [role="label"]');
      if (siblingLabel) {
        return getElementText(siblingLabel).trim();
      }
      parent = parent.parentElement;
      if (parent && parent.tagName === 'BODY') break;
    }
    
    // Try nearby elements that might be labels
    const previousElement = field.previousElementSibling;
    if (previousElement && 
        (previousElement.tagName === 'LABEL' || 
         previousElement.classList.contains('label') || 
         previousElement.hasAttribute('aria-label'))) {
      return getElementText(previousElement).trim();
    }
    
    // Try placeholder or name as fallback
    return field.placeholder || field.name || '';
  }
  
  // Process all standard form fields
  document.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(field => {
    // Skip truly hidden fields (but include those just visually hidden with CSS)
    if (field.type === 'hidden') {
      return;
    }
    
    // Find the best label for this field
    const label = findLabel(field);
    const placeholder = field.placeholder || '';
    const ariaLabel = field.getAttribute('aria-label') || '';
    
    // Create context for the field
    const nearbyHeadings = [];
    let element = field.parentElement;
    while (element && nearbyHeadings.length < 2) {
      const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) {
        nearbyHeadings.push(heading.textContent.trim());
      }
      element = element.parentElement;
      if (element && element.tagName === 'BODY') break;
    }
    
    formFields.push({
      type: field.type || field.tagName.toLowerCase(),
      name: field.name || '',
      id: field.id || '',
      value: field.type === 'password' ? '******' : (field.value || ''),
      label: label,
      placeholder: placeholder,
      ariaLabel: ariaLabel, 
      required: field.required || false,
      context: nearbyHeadings.join(' > '),
      attributes: getElementAttributes(field)
    });
  });
  
  // Helper to get all attributes of an element
  function getElementAttributes(element) {
    const attributes = {};
    for(let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }
  
  // Look for non-standard form elements (custom inputs with ARIA roles)
  document.querySelectorAll('[role="textbox"], [role="combobox"], [role="button"], [contenteditable="true"]').forEach(field => {
    if (!field.matches('input, select, textarea')) { // Avoid duplicates
      const label = field.getAttribute('aria-label') || 
                   (field.getAttribute('aria-labelledby') ? 
                    document.getElementById(field.getAttribute('aria-labelledby'))?.textContent : '') || 
                    findLabel(field);
      
      formFields.push({
        type: field.getAttribute('role') || (field.hasAttribute('contenteditable') ? 'contenteditable' : 'custom'),
        name: field.id || '',
        id: field.id || '',
        label: label,
        required: field.getAttribute('aria-required') === 'true',
        context: field.closest('form, section, div[class*="form"]')?.querySelector('h1, h2, h3, h4')?.textContent || '',
        attributes: getElementAttributes(field)
      });
    }
  });
  
  // Look for complete forms
  const forms = [];
  document.querySelectorAll('form').forEach(form => {
    forms.push({
      id: form.id || '',
      name: form.getAttribute('name') || '',
      action: form.action || '',
      method: form.method || '',
      numFields: form.querySelectorAll('input, select, textarea').length,
      attributes: getElementAttributes(form)
    });
  });
  
  // Find apply buttons 
  const applyButtons = [];
  const potentialApplyElements = document.querySelectorAll('a[href*="apply"], button, a, [role="button"]');
  potentialApplyElements.forEach(btn => {
    const buttonText = btn.textContent.toLowerCase();
    if (buttonText.includes('apply')) {
      applyButtons.push({
        type: btn.tagName.toLowerCase(),
        text: btn.textContent.trim(),
        href: btn.tagName === 'A' ? btn.href : '',
        id: btn.id || '',
        classes: Array.from(btn.classList).join(' ') || '',
        location: `Near: ${btn.closest('h1, h2, h3, section')?.textContent?.substring(0, 50)?.trim() || 'Unknown'}`,
        attributes: getElementAttributes(btn)
      });
    }
  });
  
  // NEW: Extract all text content by section
  const textContent = [];
  
  // Function to check if an element is visible
  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }
  
  // Function to get text from an element excluding child elements that have already been processed
  function extractTextFromNode(node, processed = new Set()) {
    if (!node || processed.has(node)) return '';
    processed.add(node);
    
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    
    // Skip hidden elements
    if (!isVisible(node)) return '';
    
    // Skip already processed sections like navigation
    if (node.tagName === 'NAV' || 
        node.tagName === 'HEADER' || 
        node.tagName === 'FOOTER' ||
        node.tagName === 'SCRIPT' ||
        node.tagName === 'STYLE' ||
        node.tagName === 'NOSCRIPT') {
      return '';
    }
    
    let result = '';
    for (const child of node.childNodes) {
      result += extractTextFromNode(child, processed);
    }
    return result;
  }
  
  // Process main content sections
  const sections = [];
  const mainContentSelectors = [
    'main',
    'article',
    'section',
    '[role="main"]',
    '.main-content',
    '.content',
    '.job-description',
    '.description',
    '[id*="content"]',
    '[id*="description"]'
  ];
  
  // First try to find main content containers
  let mainElements = [];
  for (const selector of mainContentSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      mainElements = Array.from(elements);
      break;
    }
  }
  
  // If no main content found, use div containers with substantial content
  if (mainElements.length === 0) {
    document.querySelectorAll('div').forEach(div => {
      if (div.innerText && div.innerText.length > 100) {
        mainElements.push(div);
      }
    });
  }
  
  const processedElements = new Set();
  
  // Process each main element
  mainElements.forEach(element => {
    if (processedElements.has(element)) return;
    
    let sectionTitle = '';
    const prevHeading = element.previousElementSibling;
    if (prevHeading && /^h[1-6]$/i.test(prevHeading.tagName)) {
      sectionTitle = prevHeading.textContent.trim();
    } else {
      const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) {
        sectionTitle = heading.textContent.trim();
      }
    }
    
    const textContent = extractTextFromNode(element, processedElements).trim();
    if (textContent) {
      sections.push({
        title: sectionTitle,
        text: textContent
      });
    }
  });
  
  // NEW: Extract job details
  const jobDetails = {};
  
  // Look for job title
  const jobTitle = document.querySelector('h1')?.textContent.trim() || '';
  if (jobTitle) {
    jobDetails.title = jobTitle;
  }
  
  // Look for salary information
  const salaryRegex = /\$[\d,]+(?:\.\d+)?(?:\s*[-–—]\s*\$[\d,]+(?:\.\d+)?)?(?:\s*USD)?/g;
  const pageText = document.body.innerText;
  const salaryMatches = pageText.match(salaryRegex);
  if (salaryMatches) {
    jobDetails.salary = salaryMatches[0];
  }
  
  // Look for location information
  const locationContainers = Array.from(document.querySelectorAll('*'))
    .filter(element => /location|city|address|area|place|where/i.test(element.textContent))
    .map(element => element.closest('div, section, p'));
  
  locationContainers.forEach(container => {
    if (container && !jobDetails.location) {
      const text = container.textContent.trim();
      // Common city/state patterns
      const locationMatch = text.match(/(?:([A-Z][a-z]+(?: [A-Z][a-z]+)*),? (?:[A-Z]{2}))|(?:Remote)|(?:[A-Z][a-z]+(?: [A-Z][a-z]+)*(?:\s\/\s[A-Z][a-z]+(?: [A-Z][a-z]+)*)+)/);
      if (locationMatch) {
        jobDetails.location = locationMatch[0];
      }
    }
  });
  
  // Look for job type (full-time, part-time, contract, etc.)
  const jobTypeRegex = /\b(?:full[- ]?time|part[- ]?time|contract|temporary|permanent|regular|internship)\b/i;
  const jobTypeMatch = pageText.match(jobTypeRegex);
  if (jobTypeMatch) {
    jobDetails.jobType = jobTypeMatch[0];
  }
  
  // NEW: Extract skills and requirements
  const skills = new Set();
  const paragraphs = document.querySelectorAll('p');
  
  // Common tech skills to look for
  const techSkills = [
    'Python', 'Java', 'JavaScript', 'TypeScript', 'C\\+\\+', 'C#', 'Ruby',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'NoSQL',
    'AWS', 'Azure', 'GCP', 'Cloud',
    'Docker', 'Kubernetes', 'CI/CD',
    'React', 'Angular', 'Vue', 'Node.js',
    'Machine Learning', 'Deep Learning', 'AI', 'NLP',
    'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn',
    'Hadoop', 'Spark', 'Apache Kafka', 'Airflow',
    'Git', 'GitHub', 'GitLab', 'Bitbucket',
    'Agile', 'Scrum', 'Kanban', 'Jira'
  ];
  
  const skillsRegex = new RegExp(`\\b(${techSkills.join('|')})\\b`, 'gi');
  
  // Look for skills in paragraphs
  paragraphs.forEach(p => {
    const text = p.textContent;
    const matches = text.match(skillsRegex);
    if (matches) {
      matches.forEach(match => skills.add(match));
    }
  });
  
  // Look for education requirements
  const educationRegex = /\b(?:Bachelor'?s|Master'?s|Ph\.?D\.?|MBA|degree|diploma)\b/gi;
  const educationMatches = pageText.match(educationRegex);
  const educationRequirements = educationMatches ? [...new Set(educationMatches)] : [];
  
  // Look for experience requirements
  const experienceRegex = /\b\d+\+?\s*(?:year|yr)s?\b.*?experience/gi;
  const experienceMatches = pageText.match(experienceRegex);
  const experienceRequirements = experienceMatches ? [...new Set(experienceMatches)] : [];
  
  // NEW: Get all button elements
  const buttons = [];
  document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a.button, .btn').forEach(button => {
    buttons.push({
      type: button.tagName.toLowerCase(),
      text: button.textContent.trim(),
      id: button.id || '',
      classes: Array.from(button.classList).join(' ') || '',
      disabled: button.disabled || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
      attributes: getElementAttributes(button)
    });
  });
  
  // Full HTML source of the page (for debugging)
  const htmlSource = document.documentElement.outerHTML;
  
  // Return structured data
  return {
    title,
    url: window.location.href,
    metadata,
    headings,
    links,
    images,
    formFields,
    forms,
    applyButtons,
    buttons,
    sections,
    jobDetails: {
      ...jobDetails,
      skills: Array.from(skills),
      education: educationRequirements,
      experience: experienceRequirements
    },
    fullText: pageText,
    htmlSource: htmlSource.substring(0, 200000) // Limit to avoid excessive data
  };
}

// Function to call OpenAI API for AI summary
async function getAISummary(pageData) {
  let retries = 0;
  let delay = config.RETRY_DELAY_MS || 2000;
  let currentModel = config.OPENAI_MODEL;
  
  // Helper function for delay with exponential backoff
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  async function attemptRequest() {
    try {
      // Use API configuration from config.js
      const API_KEY = config.OPENAI_API_KEY;
      const API_URL = config.OPENAI_API_URL;
      
      if (!API_KEY) {
        throw new Error("OpenAI API key not found. Please check your config.js file.");
      }
      
      console.log(`Attempting API request with model: ${currentModel}`);
      
      // Create a concise version of page data to send to API
      // Reduce token usage by limiting the content sent
      const concisePageData = {
        title: pageData.title,
        url: pageData.url,
        headings: pageData.headings?.slice(0, 20), // Limit to first 20 headings
        formFields: (pageData.formFields || []).slice(0, 30), // Limit to 30 form fields
        buttons: (pageData.buttons || []).slice(0, 20), // Limit to 20 buttons
        jobDetails: pageData.jobDetails || {},
        textSample: pageData.fullText ? pageData.fullText.substring(0, 6000) : "", // Reduced from 8000 to 6000 chars
      };

      // System prompt with instructions
      const systemPrompt = "You are a helpful assistant who will help the user read the contents of a web page and understand the context by giving a short summary, and also make an exhaustive list of form fields to fill, check boxes, basically everything that can be filled. Create a list of all these fields and return the response in a structured format.";

      // Prepare the request payload for OpenAI
      const payload = {
        model: currentModel,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Here is the page data to analyze:\n${JSON.stringify(concisePageData, null, 2)}`
          }
        ],
        temperature: 0.2, 
        max_tokens: 1024 // Reduced from 2048
      };

      // Make API call to OpenAI
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload),
      });

      // Handle rate limit errors specifically
      if (response.status === 429) {
        const responseText = await response.text();
        console.warn(`Rate limit hit: ${responseText}`);
        
        // If we can retry, do so with backoff
        if (retries < (config.MAX_RETRIES || 3)) {
          retries++;
          
          // Switch to fallback model if available
          if (config.OPENAI_FALLBACK_MODEL && currentModel !== config.OPENAI_FALLBACK_MODEL) {
            console.log(`Switching to fallback model: ${config.OPENAI_FALLBACK_MODEL}`);
            currentModel = config.OPENAI_FALLBACK_MODEL;
          }
          
          // Implement exponential backoff if configured
          if (config.USE_EXPONENTIAL_BACKOFF) {
            delay *= 2; // Double the delay each time
          }
          
          console.log(`Retrying in ${delay}ms... (Attempt ${retries} of ${config.MAX_RETRIES || 3})`);
          await sleep(delay);
          return attemptRequest(); // Recursively retry
        } else {
          throw new Error(`API rate limit exceeded after ${retries} retries. Please try again later.`);
        }
      }
      
      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorDetails}`);
      }

      // Parse the response from OpenAI
      const result = await response.json();
      return result.choices[0].message.content;
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      
      // Retry non-fatal errors
      if ((error.message.includes('429') || error.message.includes('rate_limit')) && 
          retries < (config.MAX_RETRIES || 3)) {
        retries++;
        
        // Try fallback model
        if (config.OPENAI_FALLBACK_MODEL && currentModel !== config.OPENAI_FALLBACK_MODEL) {
          console.log(`Switching to fallback model: ${config.OPENAI_FALLBACK_MODEL}`);
          currentModel = config.OPENAI_FALLBACK_MODEL;
        }
        
        // Implement exponential backoff
        if (config.USE_EXPONENTIAL_BACKOFF) {
          delay *= 2;
        }
        
        console.log(`Retrying in ${delay}ms... (Attempt ${retries} of ${config.MAX_RETRIES || 3})`);
        await sleep(delay);
        return attemptRequest();
      }
      
      return `Error generating AI summary: ${error.message}`;
    }
  }
  
  // Start the request process
  return attemptRequest();
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  // Add a ping handler to verify content script is working
  if (message.type === 'ping') {
    console.log('Ping received, responding with pong');
    sendResponse({ pong: true });
    return true;
  }
  
  if (message.type === 'scan') {
    console.log('Scanning page...');
    try {
      const pageData = scanPage();
      console.log('Page data collected:', pageData);
      
      // For AI summary, we need to handle async operation differently
      // since sendResponse doesn't work with promises directly
      getAISummary(pageData)
        .then(aiSummary => {
          pageData.aiSummary = aiSummary;
          sendResponse(pageData);
        })
        .catch(error => {
          console.error('Error getting AI summary:', error);
          pageData.aiSummary = `Failed to generate AI summary: ${error.message}`;
          sendResponse(pageData);
        });
      
      // Return true to indicate we will send a response asynchronously
      return true;
    } catch (error) {
      console.error('Error scanning page:', error);
      sendResponse({ error: error.message });
      return true;
    }
  }
  
  return true; // Keep the message channel open for other message types
});