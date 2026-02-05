// QuickEmail Extractor - Professional Version 2.0
class EmailExtractor {
    constructor() {
        // IMPORTANT: Update this to your actual Cloudflare Worker URL
        this.WORKER_URL = 'https://email-extractor-worker.quick3830.workers.dev';
        
        this.emails = new Set();
        this.emailData = new Map();
        this.currentFilter = 'all';
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateStats();
        this.checkWorkerConfiguration();
    }

    cacheElements() {
        // Input elements
        this.urlInput = document.getElementById('urlInput');
        this.textInput = document.getElementById('textInput');
        this.followLinks = document.getElementById('followLinks');
        this.maxDepth = document.getElementById('maxDepth');
        this.maxPages = document.getElementById('maxPages');
        
        // Button elements
        this.extractBtn = document.getElementById('extractBtn');
        this.deepSearchBtn = document.getElementById('deepSearchBtn');
        this.extractTextBtn = document.getElementById('extractTextBtn');
        this.validateBtn = document.getElementById('validateBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Display elements
        this.statusMessage = document.getElementById('statusMessage');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressStats = document.getElementById('progressStats');
        this.progressDetails = document.getElementById('progressDetails');
        this.resultsSection = document.getElementById('resultsSection');
        this.emailsList = document.getElementById('emailsList');
        this.saveMenu = document.getElementById('saveMenu');
        
        // Stats elements
        this.totalCount = document.getElementById('totalCount');
        this.validCount = document.getElementById('validCount');
        this.invalidCount = document.getElementById('invalidCount');
        
        // Filter tabs
        this.filterTabs = document.querySelectorAll('.filter-tab');
    }

    bindEvents() {
        // Main action buttons
        this.extractBtn.addEventListener('click', () => this.extractFromUrl());
        this.deepSearchBtn.addEventListener('click', () => this.deepSearch());
        this.extractTextBtn.addEventListener('click', () => this.extractFromText());
        
        // Results actions
        this.validateBtn.addEventListener('click', () => this.validateAllEmails());
        this.copyBtn.addEventListener('click', () => this.copyValidEmails());
        this.clearBtn.addEventListener('click', () => this.clearResults());
        
        // Save dropdown
        this.saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSaveMenu();
        });

        const formatButtons = this.saveMenu.querySelectorAll('.dropdown-item');
        formatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = btn.dataset.format;
                this.saveValidEmails(format);
                this.closeSaveMenu();
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.saveBtn.contains(e.target)) {
                this.closeSaveMenu();
            }
        });
        
        // Filter tabs
        this.filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => this.filterEmails(e.target.dataset.filter));
        });

        // Enter key support
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) this.extractFromUrl();
        });
        
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey && !this.isProcessing) this.extractFromText();
        });
    }

    checkWorkerConfiguration() {
        if (this.WORKER_URL.includes('YOUR-SUBDOMAIN')) {
            console.warn('⚠️ Worker URL not configured. Please update WORKER_URL in script.js');
            const banner = document.getElementById('configBanner');
            if (banner) banner.style.display = 'flex';
        }
    }

    toggleSaveMenu() {
        const wrapper = this.saveBtn.parentElement;
        wrapper.classList.toggle('active');
    }

    closeSaveMenu() {
        const wrapper = this.saveBtn.parentElement;
        wrapper.classList.remove('active');
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = 'status-message visible ' + type;
        
        if (type !== 'loading') {
            setTimeout(() => {
                this.statusMessage.classList.remove('visible');
            }, 5000);
        }
    }

    hideStatus() {
        this.statusMessage.classList.remove('visible');
    }

    showProgress() {
        this.progressSection.classList.add('visible');
    }

    hideProgress() {
        this.progressSection.classList.remove('visible');
    }

    updateProgress(current, total, url = '') {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        this.progressFill.style.width = percentage + '%';
        this.progressStats.textContent = `${current} / ${total} pages`;
        
        if (url) {
            this.addProgressItem(`Scanning: ${this.truncateUrl(url)}`, 'info');
        }
    }

    addProgressItem(message, type = 'info') {
        const item = document.createElement('div');
        item.className = `progress-item ${type}`;
        item.textContent = message;
        this.progressDetails.appendChild(item);
        this.progressDetails.scrollTop = this.progressDetails.scrollHeight;
    }

    clearProgress() {
        this.progressFill.style.width = '0%';
        this.progressStats.textContent = '0 / 0 pages';
        this.progressDetails.innerHTML = '';
    }

    async extractFromUrl() {
        const url = this.urlInput.value.trim();
        
        if (!url) {
            this.showStatus('Please enter a URL', 'error');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showStatus('Please enter a valid URL (starting with http:// or https://)', 'error');
            return;
        }

        if (this.isProcessing) {
            this.showStatus('Already processing a request. Please wait...', 'error');
            return;
        }

        this.isProcessing = true;
        this.showStatus('Fetching webpage via Cloudflare Worker...', 'loading');
        this.extractBtn.disabled = true;
        this.deepSearchBtn.disabled = true;

        try {
            const html = await this.fetchUrlContent(url);
            
            if (html) {
                const count = this.processText(html);
                if (count > 0) {
                    this.showStatus(`Successfully extracted ${count} new email${count !== 1 ? 's' : ''} (${this.emails.size} total unique)`, 'success');
                    this.renderEmails();
                    this.updateStats();
                } else {
                    this.showStatus('No new email addresses found on this page', 'error');
                }
            } else {
                throw new Error('Unable to fetch content');
            }
            
        } catch (error) {
            console.error('Error fetching URL:', error);
            this.showStatus('Unable to fetch URL: ' + error.message, 'error');
        } finally {
            this.extractBtn.disabled = false;
            this.deepSearchBtn.disabled = false;
            this.isProcessing = false;
        }
    }

    async deepSearch() {
        const url = this.urlInput.value.trim();
        
        if (!url) {
            this.showStatus('Please enter a URL', 'error');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showStatus('Please enter a valid URL', 'error');
            return;
        }

        if (this.isProcessing) {
            this.showStatus('Already processing a request. Please wait...', 'error');
            return;
        }

        const followLinks = this.followLinks.checked;
        const maxDepth = parseInt(this.maxDepth.value) || 2;
        const maxPages = parseInt(this.maxPages.value) || 10;

        this.isProcessing = true;
        this.showStatus('Starting deep search via Cloudflare Worker...', 'loading');
        this.showProgress();
        this.clearProgress();
        this.deepSearchBtn.disabled = true;
        this.extractBtn.disabled = true;

        try {
            await this.performDeepSearch(url, followLinks, maxDepth, maxPages);
            
            if (this.emails.size > 0) {
                this.showStatus(`Deep search complete! Found ${this.emails.size} unique emails`, 'success');
            } else {
                this.showStatus('Deep search complete but no emails were found', 'error');
            }
        } catch (error) {
            console.error('Deep search error:', error);
            this.showStatus('Deep search encountered an error: ' + error.message, 'error');
        } finally {
            this.deepSearchBtn.disabled = false;
            this.extractBtn.disabled = false;
            this.isProcessing = false;
        }
    }

    async performDeepSearch(startUrl, followLinks, maxDepth, maxPages) {
        const visited = new Set();
        const toVisit = [{ url: startUrl, depth: 0 }];
        const failed = new Set();
        let pagesScanned = 0;
        let pagesSuccessful = 0;
        const baseUrl = new URL(startUrl);
        
        this.addProgressItem(`🔍 Starting deep search from: ${startUrl}`, 'info');
        this.addProgressItem(`⚙️ Settings - Max depth: ${maxDepth}, Max pages: ${maxPages}`, 'info');
        this.addProgressItem(`☁️ Using Cloudflare Worker for fetching...`, 'info');
        this.addProgressItem('', 'info');

        while (toVisit.length > 0 && pagesScanned < maxPages) {
            const { url, depth } = toVisit.shift();
            
            if (visited.has(url) || depth > maxDepth || failed.has(url)) {
                continue;
            }

            visited.add(url);
            pagesScanned++;
            
            this.updateProgress(pagesScanned, Math.min(maxPages, toVisit.length + pagesScanned + 1), url);

            try {
                const text = await this.fetchUrlContent(url);
                
                if (text) {
                    pagesSuccessful++;
                    const emailsBefore = this.emails.size;
                    this.processText(text, false);
                    const newEmails = this.emails.size - emailsBefore;
                    
                    if (newEmails > 0) {
                        this.addProgressItem(`  ✓ Page ${pagesScanned}: Found ${newEmails} new email${newEmails > 1 ? 's' : ''}`, 'success');
                    } else {
                        this.addProgressItem(`  ○ Page ${pagesScanned}: No new emails`, 'info');
                    }

                    // Extract and queue new links if following links
                    if (followLinks && depth < maxDepth) {
                        const links = this.extractLinks(text, baseUrl.origin);
                        let addedLinks = 0;
                        
                        for (const link of links) {
                            if (!visited.has(link) && !failed.has(link) && 
                                toVisit.length + pagesScanned < maxPages) {
                                if (!toVisit.some(item => item.url === link)) {
                                    toVisit.push({ url: link, depth: depth + 1 });
                                    addedLinks++;
                                }
                            }
                        }
                        
                        if (addedLinks > 0) {
                            this.addProgressItem(`    → Queued ${addedLinks} internal link${addedLinks > 1 ? 's' : ''} for depth ${depth + 1}`, 'info');
                        }
                    }
                } else {
                    failed.add(url);
                    this.addProgressItem(`  ✗ Page ${pagesScanned}: Unable to fetch`, 'error');
                }
                
                // Delay between requests to avoid overwhelming servers
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                failed.add(url);
                this.addProgressItem(`  ✗ Page ${pagesScanned}: ${error.message}`, 'error');
                console.error('Error processing URL:', error);
            }
        }

        // Render all collected emails
        if (this.emails.size > 0) {
            this.renderEmails();
            this.updateStats();
        }
        
        this.addProgressItem('', 'info');
        this.addProgressItem(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        this.addProgressItem(`✓ Deep Search Complete`, 'success');
        this.addProgressItem(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        this.addProgressItem(`📊 Pages attempted: ${pagesScanned}`, 'info');
        this.addProgressItem(`✓ Pages successful: ${pagesSuccessful}`, pagesSuccessful > 0 ? 'success' : 'error');
        this.addProgressItem(`✗ Pages failed: ${failed.size}`, failed.size > 0 ? 'error' : 'info');
        this.addProgressItem(`📧 Unique emails found: ${this.emails.size}`, this.emails.size > 0 ? 'success' : 'info');
    }

    truncateUrl(url) {
        if (url.length <= 70) return url;
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname.length > 40 ? urlObj.pathname.substring(0, 37) + '...' : urlObj.pathname;
            return urlObj.hostname + path;
        } catch {
            return url.substring(0, 67) + '...';
        }
    }

    async fetchUrlContent(url) {
        try {
            const response = await fetch(`${this.WORKER_URL}/fetch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.content) {
                console.log(`✓ Fetched ${(data.contentLength / 1024).toFixed(1)} KB from ${url}`);
                return data.content;
            } else {
                throw new Error(data.message || 'Failed to fetch content');
            }

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Worker connection failed. Check if WORKER_URL is configured correctly.');
            }
            throw error;
        }
    }

    extractLinks(html, baseOrigin) {
        const links = new Set();
        const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
        let match;

        while ((match = linkRegex.exec(html)) !== null) {
            try {
                let link = match[1];
                
                // Skip anchors, javascript, mailto, tel
                if (link.startsWith('#') || link.startsWith('javascript:') || 
                    link.startsWith('mailto:') || link.startsWith('tel:')) {
                    continue;
                }

                // Convert relative URLs to absolute
                if (link.startsWith('/')) {
                    link = baseOrigin + link;
                } else if (!link.startsWith('http')) {
                    link = baseOrigin + '/' + link;
                }

                const linkUrl = new URL(link);
                
                // Only include same-origin links
                if (linkUrl.origin === baseOrigin) {
                    links.add(linkUrl.href);
                }
            } catch (e) {
                // Invalid URL, skip
            }
        }

        return Array.from(links);
    }

    extractFromText() {
        const text = this.textInput.value.trim();
        
        if (!text) {
            this.showStatus('Please paste some text', 'error');
            return;
        }

        if (this.isProcessing) {
            this.showStatus('Already processing a request. Please wait...', 'error');
            return;
        }

        this.isProcessing = true;
        this.showStatus('Extracting emails from text...', 'loading');
        this.extractTextBtn.disabled = true;

        setTimeout(() => {
            const count = this.processText(text);
            if (count > 0) {
                this.showStatus(`Successfully extracted ${count} new email${count !== 1 ? 's' : ''} (${this.emails.size} total unique)`, 'success');
                this.renderEmails();
                this.updateStats();
            } else {
                this.showStatus('No new email addresses found in the text', 'error');
            }
            this.extractTextBtn.disabled = false;
            this.isProcessing = false;
        }, 300);
    }

    processText(text, shouldRender = true) {
        // Enhanced email regex following RFC 5322
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const matches = text.match(emailRegex);

        if (matches) {
            const previousCount = this.emails.size;
            
            matches.forEach(email => {
                const normalizedEmail = email.toLowerCase();
                // Basic validation before adding
                if (this.isEmailFormatValid(normalizedEmail) && !this.emails.has(normalizedEmail)) {
                    this.emails.add(normalizedEmail);
                    this.emailData.set(normalizedEmail, {
                        email: normalizedEmail,
                        status: 'unchecked',
                        valid: null
                    });
                }
            });

            const newEmails = this.emails.size - previousCount;
            
            if (newEmails > 0 && shouldRender) {
                this.renderEmails();
                this.updateStats();
            }
            
            return newEmails;
        } else {
            return 0;
        }
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    isEmailFormatValid(email) {
        // Quick format check before adding
        const parts = email.split('@');
        if (parts.length !== 2) return false;
        if (parts[0].length === 0 || parts[1].length === 0) return false;
        if (!parts[1].includes('.')) return false;
        return true;
    }

    validateEmail(email) {
        // RFC 5322 compliant email validation
        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!regex.test(email)) {
            return false;
        }

        const [localPart, domain] = email.split('@');
        
        // Local part validation
        if (localPart.length > 64) return false;
        if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
        if (localPart.includes('..')) return false;
        
        // Domain validation
        if (domain.length > 255) return false;
        if (domain.startsWith('-') || domain.endsWith('-')) return false;
        if (domain.startsWith('.') || domain.endsWith('.')) return false;
        
        const parts = domain.split('.');
        if (parts.length < 2) return false;
        
        const tld = parts[parts.length - 1];
        if (tld.length < 2) return false;
        
        // Check for valid TLD characters
        if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;
        
        return true;
    }

    validateAllEmails() {
        if (this.emails.size === 0) {
            this.showStatus('No emails to validate', 'error');
            return;
        }

        this.showStatus('Validating all emails...', 'loading');
        this.validateBtn.disabled = true;

        let validatedCount = 0;

        this.emailData.forEach((data, email) => {
            const isValid = this.validateEmail(email);
            this.emailData.set(email, {
                ...data,
                status: isValid ? 'valid' : 'invalid',
                valid: isValid
            });
            validatedCount++;
        });

        setTimeout(() => {
            this.renderEmails();
            this.updateStats();
            const validCount = Array.from(this.emailData.values()).filter(d => d.valid === true).length;
            this.showStatus(`Validated ${validatedCount} emails (${validCount} valid, ${validatedCount - validCount} invalid)`, 'success');
            this.validateBtn.disabled = false;
        }, 500);
    }

    getValidEmails() {
        return Array.from(this.emailData.values())
            .filter(data => data.valid === true)
            .map(data => data.email);
    }

    copyValidEmails() {
        const validEmails = this.getValidEmails();
        
        if (validEmails.length === 0) {
            this.showStatus('No valid emails to copy. Validate emails first.', 'error');
            return;
        }

        const emailText = validEmails.join('\n');
        
        navigator.clipboard.writeText(emailText).then(() => {
            this.showStatus(`Copied ${validEmails.length} valid email${validEmails.length !== 1 ? 's' : ''} to clipboard`, 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = emailText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showStatus(`Copied ${validEmails.length} valid email${validEmails.length !== 1 ? 's' : ''} to clipboard`, 'success');
            } catch (err) {
                this.showStatus('Failed to copy to clipboard', 'error');
            }
            
            document.body.removeChild(textArea);
        });
    }

    saveValidEmails(format) {
        const validEmails = this.getValidEmails();
        
        if (validEmails.length === 0) {
            this.showStatus('No valid emails to save. Validate emails first.', 'error');
            return;
        }

        let content, mimeType, extension;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        
        switch(format) {
            case 'txt':
                content = this.generateTxtFile(validEmails);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            
            case 'csv':
                content = this.generateCsvFile(validEmails);
                mimeType = 'text/csv';
                extension = 'csv';
                break;
            
            case 'json':
                content = this.generateJsonFile(validEmails);
                mimeType = 'application/json';
                extension = 'json';
                break;
            
            case 'html':
                content = this.generateHtmlFile(validEmails);
                mimeType = 'text/html';
                extension = 'html';
                break;
            
            default:
                return;
        }

        this.downloadFile(content, `valid-emails-${timestamp}.${extension}`, mimeType);
        this.showStatus(`Saved ${validEmails.length} valid email${validEmails.length !== 1 ? 's' : ''} as ${extension.toUpperCase()}`, 'success');
    }

    generateTxtFile(emails) {
        let content = `Valid Email Addresses\n`;
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Total: ${emails.length}\n`;
        content += `${'='.repeat(50)}\n\n`;
        content += emails.join('\n');
        return content;
    }

    generateCsvFile(emails) {
        let csv = 'Email Address,Status,Domain,Validated At\n';
        const timestamp = new Date().toLocaleString();
        emails.forEach(email => {
            const domain = email.split('@')[1];
            csv += `${email},Valid,${domain},${timestamp}\n`;
        });
        return csv;
    }

    generateJsonFile(emails) {
        const data = {
            metadata: {
                generated: new Date().toISOString(),
                total_emails: emails.length,
                status: 'valid',
                tool: 'QuickEmail Extractor v2.0',
                validator: 'RFC 5322 compliant'
            },
            emails: emails.map(email => ({
                address: email,
                status: 'valid',
                validated: true,
                domain: email.split('@')[1],
                local_part: email.split('@')[0]
            }))
        };
        return JSON.stringify(data, null, 2);
    }

    generateHtmlFile(emails) {
        const domains = [...new Set(emails.map(e => e.split('@')[1]))];
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Valid Email Addresses - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px 40px;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
        }
        .stat-box {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #6c757d;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .emails {
            padding: 40px;
        }
        .copy-all {
            display: inline-block;
            margin: 0 0 20px 0;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .copy-all:hover {
            background: #764ba2;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .email-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }
        .email-item {
            padding: 15px 20px;
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.95rem;
            color: #495057;
            transition: all 0.3s ease;
            cursor: pointer;
            word-break: break-all;
        }
        .email-item:hover {
            background: #e7f3ff;
            border-left-color: #764ba2;
            transform: translateX(5px);
        }
        .footer {
            padding: 30px 40px;
            background: #f8f9fa;
            text-align: center;
            color: #6c757d;
            font-size: 0.9rem;
            border-top: 2px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Valid Email Addresses</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="stats">
            <div class="stat-box">
                <div class="stat-value">${emails.length}</div>
                <div class="stat-label">Total Emails</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">✓</div>
                <div class="stat-label">All Validated</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${domains.length}</div>
                <div class="stat-label">Unique Domains</div>
            </div>
        </div>
        
        <div class="emails">
            <button class="copy-all" onclick="copyAllEmails()">📋 Copy All Emails</button>
            <div class="email-grid">
${emails.map(email => `                <div class="email-item" onclick="copyEmail('${email}')" title="Click to copy">${email}</div>`).join('\n')}
            </div>
        </div>
        
        <div class="footer">
            <p><strong>QuickEmail Extractor v2.0</strong></p>
            <p>Generated with QuickEmail Extractor • ${emails.length} valid email addresses</p>
            <p style="margin-top: 10px; font-size: 0.8rem;">RFC 5322 compliant validation</p>
        </div>
    </div>
    
    <script>
        function copyEmail(email) {
            navigator.clipboard.writeText(email).then(() => {
                alert('✓ Copied: ' + email);
            }).catch(() => {
                alert('Failed to copy email');
            });
        }
        
        function copyAllEmails() {
            const emails = Array.from(document.querySelectorAll('.email-item'))
                .map(el => el.textContent.trim());
            navigator.clipboard.writeText(emails.join('\\n')).then(() => {
                alert('✓ Copied all ' + emails.length + ' emails to clipboard!');
            }).catch(() => {
                alert('Failed to copy emails');
            });
        }
    </script>
</body>
</html>`;
        return html;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    clearResults() {
        if (this.emails.size === 0) {
            this.showStatus('No results to clear', 'error');
            return;
        }

        if (confirm(`Are you sure you want to clear all ${this.emails.size} extracted emails?`)) {
            this.emails.clear();
            this.emailData.clear();
            this.emailsList.innerHTML = '';
            this.resultsSection.classList.remove('visible');
            this.updateStats();
            this.hideStatus();
            this.hideProgress();
            this.clearProgress();
            this.currentFilter = 'all';
            
            // Reset filter tabs
            this.filterTabs.forEach(tab => {
                if (tab.dataset.filter === 'all') {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            this.showStatus('Results cleared successfully', 'success');
        }
    }

    filterEmails(filter) {
        this.currentFilter = filter;
        
        this.filterTabs.forEach(tab => {
            if (tab.dataset.filter === filter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        this.renderEmails();
    }

    renderEmails() {
        this.emailsList.innerHTML = '';
        
        if (this.emails.size === 0) {
            this.resultsSection.classList.remove('visible');
            return;
        }

        this.resultsSection.classList.add('visible');
        
        const emailsArray = Array.from(this.emailData.values());
        let filteredEmails = emailsArray;

        if (this.currentFilter === 'valid') {
            filteredEmails = emailsArray.filter(data => data.valid === true);
        } else if (this.currentFilter === 'invalid') {
            filteredEmails = emailsArray.filter(data => data.valid === false);
        } else if (this.currentFilter === 'unchecked') {
            filteredEmails = emailsArray.filter(data => data.valid === null);
        }

        if (filteredEmails.length === 0) {
            this.emailsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">No emails match this filter</div>
                </div>
            `;
            return;
        }

        filteredEmails.forEach((data, index) => {
            const emailItem = document.createElement('div');
            emailItem.className = `email-item ${data.status}`;
            emailItem.style.animationDelay = `${index * 0.03}s`;
            
            let statusIcon = '●';
            let statusText = 'Unchecked';
            
            if (data.status === 'valid') {
                statusIcon = '✓';
                statusText = 'Valid';
            } else if (data.status === 'invalid') {
                statusIcon = '✗';
                statusText = 'Invalid';
            }

            emailItem.innerHTML = `
                <span class="email-text">${data.email}</span>
                <span class="email-status">
                    <span class="status-icon">${statusIcon}</span>
                    <span>${statusText}</span>
                </span>
            `;

            // Click to copy functionality
            emailItem.addEventListener('click', () => {
                navigator.clipboard.writeText(data.email).then(() => {
                    this.showStatus(`Copied: ${data.email}`, 'success');
                }).catch(() => {
                    this.showStatus('Failed to copy email', 'error');
                });
            });

            this.emailsList.appendChild(emailItem);
        });
    }

    updateStats() {
        const total = this.emails.size;
        const valid = Array.from(this.emailData.values()).filter(d => d.valid === true).length;
        const invalid = Array.from(this.emailData.values()).filter(d => d.valid === false).length;

        this.animateCounter(this.totalCount, total);
        this.animateCounter(this.validCount, valid);
        this.animateCounter(this.invalidCount, invalid);
    }

    animateCounter(element, target) {
        const current = parseInt(element.textContent) || 0;
        
        if (current === target) return;
        
        const increment = target > current ? 1 : -1;
        const duration = 500;
        const steps = Math.abs(target - current);
        const stepDuration = steps > 0 ? duration / steps : 0;

        let count = current;
        const timer = setInterval(() => {
            count += increment;
            element.textContent = count;
            
            if (count === target) {
                clearInterval(timer);
            }
        }, Math.max(stepDuration, 20));
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 QuickEmail Extractor v2.0 initialized');
    new EmailExtractor();
});
