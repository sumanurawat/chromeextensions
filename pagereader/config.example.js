// Example configuration file (template)
// Copy this file to config.js and add your API keys
const config = {
  // OpenAI API Key (get from https://platform.openai.com/api-keys)
  OPENAI_API_KEY: "your-openai-api-key-here",
  
  // OpenAI API configuration
  OPENAI_MODEL: "gpt-3.5-turbo-1106", // Primary model
  OPENAI_FALLBACK_MODEL: "gpt-3.5-turbo", // Fallback model if primary hits rate limits
  
  // API URL endpoints
  OPENAI_API_URL: "https://api.openai.com/v1/chat/completions",
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000, // Start with 2 seconds delay
  USE_EXPONENTIAL_BACKOFF: true // Will increase retry delay exponentially
};