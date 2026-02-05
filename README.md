# Bulk Email Extractor with Deep Search

A powerful, browser-based tool for extracting and validating email addresses from websites and text content.

## Features

### 🔍 **Deep Search Mode**
- Crawls multiple pages on a website automatically
- Follows internal links to discover more emails
- Configurable depth and page limits
- Real-time progress tracking with live updates
- Aggregates emails from all scanned pages

### ⚡ **Quick Extract Mode**
- Fast single-page email extraction
- Extract from URLs or pasted text
- Immediate results

### ✅ **Email Validation**
- Comprehensive syntax validation
- RFC-compliant email checking
- Validates local part and domain structure
- Filters valid/invalid/unchecked emails

### 📊 **Results Management**
- Live statistics (total, valid, invalid counts)
- Filter emails by status
- Copy valid emails to clipboard
- Download results as CSV
- Clean, organized interface

## How to Use

### 1. **Extract from Text**
- Paste any text containing emails into the text area
- Click "Extract from Text"
- All emails will be extracted and displayed

### 2. **Quick Extract from URL**
- Enter a website URL
- Click "Quick Extract" to scan just that page

### 3. **Deep Search (Recommended for Best Results)**

**Step-by-step:**

1. **Enter a website URL** in the URL input field
   ```
   Example: https://example.com
   ```

2. **Configure Deep Search Options:**
   - **Follow internal links**: ☑ (Enabled by default)
     - When enabled, the tool will automatically discover and scan linked pages
   - **Max depth**: 2 (default)
     - Controls how many levels deep to follow links
     - Level 0 = just the main page
     - Level 1 = main page + directly linked pages
     - Level 2 = main page + linked pages + their linked pages
   - **Max pages**: 10 (default)
     - Maximum number of pages to scan
     - Prevents infinite loops and excessive scanning

3. **Click "Deep Search"** button

4. **Monitor Progress:**
   - Watch the progress bar fill up
   - See real-time updates of which pages are being scanned
   - View how many emails are found on each page
   - Track newly discovered links

5. **Wait for Completion:**
   - The search will automatically stop when it reaches max pages or max depth
   - All unique emails are aggregated in real-time

### 4. **Validate Emails**
- Click "Validate All" to check email syntax
- Use filters to view only valid or invalid emails

### 5. **Export Results**
- **Copy Valid**: Copies all valid emails to clipboard (one per line)
- **Download**: Exports all emails with their validation status as CSV

## Deep Search Configuration Examples

### Conservative Search (Fast)
- Max depth: 1
- Max pages: 5
- Best for: Small sites or quick scans

### Balanced Search (Recommended)
- Max depth: 2
- Max pages: 10-20
- Best for: Medium-sized websites

### Comprehensive Search (Thorough)
- Max depth: 3
- Max pages: 30-50
- Best for: Large sites where you need maximum coverage

## Important Notes

### ✅ **CORS Proxy Solution (NOW WORKING!)**

The tool now includes **automatic CORS proxy support** that works in most cases:

**How it works:**
1. First tries direct URL fetch (works for CORS-enabled sites)
2. If blocked, automatically tries multiple public CORS proxy services:
   - AllOrigins API
   - CorsProxy.io
   - CodeTabs Proxy API
3. Falls back gracefully with helpful error messages

**To enable/disable:**
- Check/uncheck "Use CORS proxy" in the deep search options
- Enabled by default for best results

**What this means:**
- ✅ Most websites now work without manual copying
- ✅ Deep search can crawl multiple pages automatically
- ✅ Quick extract works on most sites
- ⚠️ Some sites with strict security may still block requests

**If you still encounter issues:**

**If you still encounter issues:**

1. **Manual Copy-Paste** (100% reliable):
   - Visit the website
   - Press Ctrl+A (Select All), then Ctrl+C (Copy)
   - Paste into "Extract from Text" field
   - Repeat for multiple pages if needed

2. **Try different proxy**:
   - The tool automatically tries 3 different proxy services
   - If one fails, it moves to the next automatically

3. **Disable CORS temporarily**:
   - For testing only: Install a CORS unblock browser extension
   - Not recommended for regular use

4. **Self-hosted backend**:
   - Deploy your own proxy server for production use
   - Complete control over fetching and rate limiting

## Technical Details

### CORS Proxy Services

The tool uses multiple public CORS proxy services in fallback order:

1. **AllOrigins** (`api.allorigins.win`)
   - Fast and reliable
   - Good for most websites
   - 10 second timeout per request

2. **CorsProxy.io** (`corsproxy.io`)
   - Alternative proxy service
   - Different IP pools
   - Good fallback option

3. **CodeTabs** (`api.codetabs.com`)
   - Third-tier fallback
   - Handles various content types

**Proxy Features:**
- Automatic retry on failure
- 10-second timeout per proxy attempt
- Validates response content quality
- Console logging for debugging
- Seamless fallback between services

### Email Extraction
- Uses comprehensive regex pattern: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g`
- Extracts from plain text, HTML, and source code
- Automatically deduplicates emails

### Email Validation Rules
- **Local part** (before @): Max 64 characters, no leading/trailing dots
- **Domain**: Max 255 characters, valid DNS structure
- **TLD**: Minimum 2 characters
- RFC-compliant syntax checking

### Deep Search Algorithm
1. Start with the initial URL (depth 0)
2. Fetch page content and extract emails
3. Parse HTML to find internal links (`<a href="...">`)
4. Filter links (same origin only, skip anchors/javascript/mailto)
5. Add new links to queue with depth + 1
6. Continue until max depth or max pages reached
7. Track visited URLs to avoid duplicates

### Link Extraction
- Only follows same-origin links (internal pages)
- Skips: anchors (#), javascript:, mailto:, tel:
- Converts relative URLs to absolute
- Prevents revisiting pages

## File Structure

```
email-extractor/
├── email-extractor.html    # Main HTML structure
├── styles.css              # All styling and animations
├── script.js               # Email extraction and validation logic
└── README.md              # This file
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support

## Privacy & Security

- **100% Client-Side**: All processing happens in your browser
- **No Data Sent**: Nothing is uploaded to external servers
- **No Tracking**: No analytics or cookies
- **Private**: Your extracted emails never leave your device

## Limitations

1. **CORS Restrictions**: Cannot fetch most external URLs directly (use copy-paste method)
2. **JavaScript-Rendered Content**: Cannot process dynamic content loaded by JavaScript
3. **Authentication**: Cannot access pages behind login walls
4. **Rate Limiting**: Some websites may block rapid requests

## Future Enhancements

- [ ] Backend proxy option for CORS bypass
- [ ] Export to multiple formats (JSON, TXT, Excel)
- [ ] Domain-specific email filtering
- [ ] Duplicate detection across domains
- [ ] Integration with email verification APIs
- [ ] Chrome extension version
- [ ] Advanced pattern matching
- [ ] Email enrichment (find names, roles)

## License

Open source - feel free to modify and use for any purpose.

## Credits

Built with HTML5, CSS3, and vanilla JavaScript. No external dependencies required.
