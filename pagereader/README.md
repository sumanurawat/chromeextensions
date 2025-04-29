# Page Reader Chrome Extension

## Overview

Page Reader is a Chrome extension that extracts and analyzes the structure and content of web pages. It provides comprehensive information about page elements including headings, links, images, form fields, and interactive elements. With AI-powered summarization using OpenAI's GPT models, it helps users quickly understand page content and identify fillable form fields.

## Features

- **Comprehensive Page Analysis**: Extracts all elements of a web page including:
  - Headings, links, and images
  - Form fields and interactive elements
  - Hidden fields and dynamic content
  - Job details (when viewing job postings)
  - Buttons and apply links

- **AI-Powered Summaries**: Uses OpenAI's GPT models to provide:
  - Concise summaries of page content
  - Lists of all fillable form fields
  - Context about the page's purpose and structure

- **Simple Interface**: Two-tab system:
  - Raw Data tab: Shows all extracted data in JSON format
  - AI Summary tab: Shows user-friendly AI-generated summary

- **Rate Limit Handling**: Built-in rate limit handling with:
  - Automatic retries with exponential backoff
  - Model fallback options
  - Optimized token usage

## Installation

1. Clone this repository:
```
git clone https://github.com/yourusername/chromeextensions.git
```

2. Set up API credentials:
   - Copy `config.example.js` to `config.js`
   - Add your OpenAI API key to `config.js`

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `pagereader` folder

## Configuration

Edit the `config.js` file to configure:

- OpenAI API key (required)
- AI model to use (defaults to gpt-3.5-turbo-1106)
- Fallback model options
- Retry settings and exponential backoff

## Usage

1. Navigate to any web page you want to analyze
2. Click the Page Reader icon in your browser toolbar
3. Click "Scan Page" to analyze the current page
4. View the results:
   - Raw Data tab: Complete extracted data
   - AI Summary tab: Human-readable summary and form field list

## Use Cases

- **Job Application Pages**: Quickly understand job requirements and application forms
- **Complex Forms**: Get an overview of all form fields that need to be filled out
- **Content Analysis**: Extract structured data from articles and blog posts
- **Web Scraping**: Extract specific content from web pages in a structured format

## Privacy & Security

- Your API key is stored locally and is never shared
- Page data is processed locally and only sent to OpenAI for summarization
- No data is stored on remote servers

## Development

To modify or contribute to this extension:

1. Make your changes to the codebase
2. Reload the extension in Chrome to test
3. Submit pull requests for new features or bug fixes
