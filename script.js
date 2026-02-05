/**
 * Lite 1.6 Email Extractor - Client Script
 * Professional email extraction tool with Cloudflare Worker integration
 */

class EmailExtractor {
    constructor() {
        // IMPORTANT: Update this URL to your Cloudflare Worker
        this.WORKER_URL = 'https://email-extractor-worker.quick3830.workers.dev';
        
        this.emails = new Set();
        this.emailData = new Map();
        this.currentFilter = 'all';
        this.isProcessing = false;
        
        this.init();
    }

    /* ================= INITIALIZATION ================= */

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateStats();
        this.testWorkerConnection();
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
        this.copyAllBtn = document.getElementById('copyAllBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Display elements
        this.statusMessage = document.getElementById('statusMessage');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressDetails = document.getElementById('progressDetails');
        this.resultsSection = document.getElementById('resultsSection');
        this.emailsList = document.getElementById('emailsList');
        
        // Stats elements
        this.totalCount = document.getElementById('totalCount');
        this.validCount = document.getElementById('validCount');
        this.invalidCount = document.getElementById('invalidCount');
        
        // Filter and output options
        this.filterTabs = document.querySelectorAll('.filter-tab');
        this.separator = document.getElementById('separator');
        this.sortAlpha = document.getElementById('sortAlpha');
        this.removeDuplicates = document.getElementById('removeDuplicates');
        
        // Worker status
        this.workerStatus = document.getElementById('workerStatus');
    }

    bindEvents() {
        // Main extraction buttons
        this.extractBtn.onclick = () => this.extractFromUrl();
        this.deepSearchBtn.onclick = () => this.deepSearch();
        this.extractTextBtn.onclick = () => this.extractFromText();
        
        // Results actions
        this.validateBtn.onclick = () => this.validateAllEmails();
        this.copyBtn.onclick = () => this.copyValidEmails();
        this.copyAllBtn.onclick = () => this.copyAllEmails();
        this.exportBtn.onclick = () => this.exportEmails();
        this.clearBtn.onclick = () => this.clearResults();
        
        // Filter tabs
        this.filterTabs.forEach(tab => {
            tab.onclick = () => this.filterEmails(tab.dataset.filter);
        });
        
        // Character counter
        this.textInput.addEventListener('input', () => {
            const charCount = document.getElementById('charCount');
            if (charCount) {
                charCount.textContent = this.textInput.value.length.toLocaleString();
            }
        });
        
        // Output preview updates
        if (this.separator) {
            this.separator.addEventListener('change', () => this.updateOutputPreview());
        }
        if (this.sortAlpha) {
            this.sortAlpha.addEventListener('change', () => this.updateOutputPreview());
        }
    }

    /* ================= WORKER INTEGRATION ================= */

    async testWorkerConnection() {
        try {
            const response = await fetch(`${this.WORKER_URL}/health`, {
                method: 'GET'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Worker connected:', data);
                this.workerStatus.textContent = 'Cloudflare Worker Connected';
            } else {
                throw new Error('Worker not responding');
            }
        } catch (error) {
            console.error('❌ Worker connection failed:', error);
            this.workerStatus.textContent = 'Worker Offline - Update WORKER_URL in script.js';
            this.workerStatus.parentElement.querySelector('.status-dot').style.background = 'var(--error)';
        }
    }

    async fetchUrlContent(url) {
        const response = await fetch(`${this.WORKER_URL}/fetch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Worker error (${response.status})`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Extraction failed');
        }

        return {
            emails: data.emails || [],
            count: data.count || 0
        };
    }

    /* ================= EXTRACTION FUNCTIONS ================= */

    extractFromText() {
        const text = this.textInput.value.trim();
        
        if (!text) {
            this.showStatus('Please paste some text first', 'error');
            return;
        }

        this.isProcessing = true;
        this.showStatus('Extracting emails from text...', 'loading');

        setTimeout(() => {
            const count = this.processText(text);
            this.finalizeExtraction(count);
            this.isProcessing = false;
        }, 300);
    }

    async extractFromUrl() {
        const url = this.urlInput.value.trim();
        
        if (!this.isValidUrl(url)) {
            this.showStatus('Please enter a valid URL', 'error');
            return;
        }

        this.isProcessing = true;
        this.showStatus('Fetching page and extracting emails...', 'loading');
        this.extractBtn.disabled = true;

        try {
            const result = await this.fetchUrlContent(url);
            const count = this.addEmailsFromArray(result.emails);
            this.finalizeExtraction(count);
        } catch (error) {
            console.error('Extraction error:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.extractBtn.disabled = false;
            this.isProcessing = false;
        }
    }

    async deepSearch() {
        const startUrl = this.urlInput.value.trim();
        
        if (!this.isValidUrl(startUrl)) {
            this.showStatus('Please enter a valid URL', 'error');
            return;
        }

        const maxDepth = parseInt(this.maxDepth.value) || 2;
        const maxPages = parseInt(this.maxPages.value) || 10;
        const followLinks = this.followLinks.checked;

        this.isProcessing = true;
        this.showProgress();
        this.clearProgress();
        this.showStatus('Starting deep search...', 'loading');
        this.deepSearchBtn.disabled = true;
        this.extractBtn.disabled = true;

        const visited = new Set();
        const queue = [{ url: startUrl, depth: 0 }];
        const baseOrigin = new URL(startUrl).origin;
        let totalEmails = 0;

        try {
            this.addProgressDetail(`🔍 Starting deep search from: ${startUrl}`, 'info');
            this.addProgressDetail(`⚙️ Max depth: ${maxDepth}, Max pages: ${maxPages}`, 'info');

            while (queue.length > 0 && visited.size < maxPages) {
                const { url, depth } = queue.shift();
                
                if (visited.has(url) || depth > maxDepth) {
                    continue;
                }

                visited.add(url);
                this.updateProgress(visited.size, maxPages);

                try {
                    this.addProgressDetail(`[${visited.size}/${maxPages}] Scanning: ${this.truncateUrl(url)}`, 'info');
                    
                    const result = await this.fetchUrlContent(url);
                    const count = this.addEmailsFromArray(result.emails, false);
                    totalEmails += count;
                    
                    if (count > 0) {
                        this.addProgressDetail(`  ✓ Found ${count} new email${count !== 1 ? 's' : ''}`, 'success');
                    } else {
                        this.addProgressDetail(`  ○ No new emails`, 'info');
                    }

                    // Note: Link following requires HTML content from worker
                    // Current worker returns emails only, so deep search is limited
                    
                } catch (error) {
                    this.addProgressDetail(`  ✗ Error: ${error.message}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            this.renderEmails();
            this.updateStats();
            this.addProgressDetail(`\n✓ Deep search complete!`, 'success');
            this.addProgressDetail(`📊 Pages scanned: ${visited.size}`, 'info');
            this.addProgressDetail(`📧 Total emails found: ${this.emails.size}`, 'info');
            this.showStatus(`Deep search complete! Found ${this.emails.size} total emails`, 'success');

        } catch (error) {
            console.error('Deep search error:', error);
            this.showStatus(`Deep search error: ${error.message}`, 'error');
        } finally {
            this.deepSearchBtn.disabled = false;
            this.extractBtn.disabled = false;
            this.isProcessing = false;
        }
    }

    /* ================= DATA PROCESSING ================= */

    processText(rawText) {
        const normalizedText = this.normalizeText(rawText);
        const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi;
        const matches = normalizedText.match(emailRegex) || [];

        let added = 0;
        
        for (const email of matches) {
            const normalizedEmail = email.toLowerCase();
            
            if (!this.emails.has(normalizedEmail) && this.isBasicEmailValid(normalizedEmail)) {
                this.emails.add(normalizedEmail);
                this.emailData.set(normalizedEmail, {
                    email: normalizedEmail,
                    valid: null,
                    status: 'unchecked'
                });
                added++;
            }
        }

        if (added > 0) {
            this.renderEmails();
            this.updateStats();
        }

        return added;
    }

    addEmailsFromArray(emailArray, shouldRender = true) {
        let added = 0;
        
        for (const email of emailArray) {
            const normalizedEmail = email.toLowerCase();
            
            if (!this.emails.has(normalizedEmail)) {
                this.emails.add(normalizedEmail);
                this.emailData.set(normalizedEmail, {
                    email: normalizedEmail,
                    valid: null,
                    status: 'unchecked'
                });
                added++;
            }
        }

        if (shouldRender && added > 0) {
            this.renderEmails();
            this.updateStats();
        }

        return added;
    }

    normalizeText(text) {
        return text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/&#64;|\(at\)|\[at\]/gi, '@')
            .replace(/\(dot\)|\[dot\]/gi, '.')
            .replace(/&nbsp;|&lt;|&gt;|&amp;/gi, ' ')
            .replace(/<[^>]+>/g, ' ');
    }

    isBasicEmailValid(email) {
        const parts = email.split('@');
        return parts.length === 2 && 
               parts[0].length > 0 && 
               parts[1].includes('.') && 
               parts[1].length > 3;
    }

    /* ================= VALIDATION ================= */

    validateAllEmails() {
        if (this.emails.size === 0) {
            this.showStatus('No emails to validate', 'error');
            return;
        }

        this.showStatus('Validating emails...', 'loading');
        this.validateBtn.disabled = true;

        setTimeout(() => {
            this.emailData.forEach((data, email) => {
                const isValid = this.validateEmail(email);
                this.emailData.set(email, {
                    ...data,
                    valid: isValid,
                    status: isValid ? 'valid' : 'invalid'
                });
            });

            this.renderEmails();
            this.updateStats();

            const validCount = this.getValidEmails().length;
            const invalidCount = this.emails.size - validCount;
            
            this.showStatus(`Validation complete: ${validCount} valid, ${invalidCount} invalid`, 'success');
            this.validateBtn.disabled = false;
        }, 500);
    }

    validateEmail(email) {
        // RFC 5322 compliant regex
        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!regex.test(email)) return false;

        const [localPart, domain] = email.split('@');
        
        // Local part validation
        if (localPart.length > 64) return false;
        if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
        if (localPart.includes('..')) return false;
        
        // Domain validation
        if (domain.length > 255) return false;
        if (domain.startsWith('-') || domain.endsWith('-')) return false;
        
        const domainParts = domain.split('.');
        if (domainParts.length < 2) return false;
        
        const tld = domainParts[domainParts.length - 1];
        if (tld.length < 2) return false;
        if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;
        
        return true;
    }

    getValidEmails() {
        return Array.from(this.emailData.values())
            .filter(data => data.valid === true)
            .map(data => data.email);
    }

    /* ================= UI RENDERING ================= */

    renderEmails() {
        this.emailsList.innerHTML = '';
        
        const emailsToShow = Array.from(this.emailData.values()).filter(data => {
            if (this.currentFilter === 'all') return true;
            if (this.currentFilter === 'valid') return data.valid === true;
            if (this.currentFilter === 'invalid') return data.valid === false;
            if (this.currentFilter === 'unchecked') return data.status === 'unchecked';
            return true;
        });

        if (emailsToShow.length === 0) {
            this.emailsList.innerHTML = `
                <div class="empty-state">
                    <p>No emails match this filter</p>
                </div>
            `;
            return;
        }

        emailsToShow.forEach(data => {
            const emailItem = document.createElement('div');
            emailItem.className = `email-item ${data.status}`;
            emailItem.textContent = data.email;
            emailItem.title = 'Click to copy';
            
            emailItem.onclick = () => {
                navigator.clipboard.writeText(data.email).then(() => {
                    this.showStatus(`Copied: ${data.email}`, 'success');
                }).catch(() => {
                    this.showStatus('Failed to copy email', 'error');
                });
            };
            
            this.emailsList.appendChild(emailItem);
        });

        this.updateOutputPreview();
    }

    filterEmails(filter) {
        this.currentFilter = filter;
        
        this.filterTabs.forEach(tab => {
            const isActive = tab.dataset.filter === filter;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive.toString());
        });

        this.renderEmails();
    }

    updateStats() {
        const allEmails = Array.from(this.emailData.values());
        const total = allEmails.length;
        const valid = allEmails.filter(e => e.valid === true).length;
        const invalid = allEmails.filter(e => e.valid === false).length;

        this.totalCount.textContent = total;
        this.validCount.textContent = valid;
        this.invalidCount.textContent = invalid;
    }

    updateOutputPreview() {
        const previewSection = document.getElementById('outputPreviewSection');
        const preview = document.getElementById('outputPreview');
        
        if (!previewSection || !preview) return;
        
        let emails = this.getValidEmails();
        
        if (emails.length === 0) {
            previewSection.classList.add('hidden');
            return;
        }
        
        previewSection.classList.remove('hidden');
        
        // Apply sorting
        if (this.sortAlpha && this.sortAlpha.checked) {
            emails = emails.sort();
        }
        
        // Get separator
        const separatorMap = {
            'newline': '\n',
            'comma': ', ',
            'semicolon': '; ',
            'pipe': ' | ',
            'space': ' ',
            'tab': '\t'
        };
        const separator = separatorMap[this.separator.value] || '\n';
        
        // Show preview (limited to 50 emails)
        const previewEmails = emails.slice(0, 50);
        const hasMore = emails.length > 50;
        
        preview.textContent = previewEmails.join(separator);
        if (hasMore) {
            preview.textContent += `\n\n... and ${emails.length - 50} more`;
        }
    }

    /* ================= PROGRESS UI ================= */

    showProgress() {
        this.progressSection.classList.add('visible');
    }

    clearProgress() {
        this.progressFill.style.width = '0%';
        this.progressDetails.innerHTML = '';
    }

    updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        this.progressFill.style.width = `${percentage}%`;
        
        const progressBar = this.progressSection.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.setAttribute('aria-valuenow', percentage.toString());
        }
    }

    addProgressDetail(message, type = 'info') {
        const detail = document.createElement('div');
        detail.className = `progress-detail ${type}`;
        detail.textContent = message;
        this.progressDetails.appendChild(detail);
        this.progressDetails.scrollTop = this.progressDetails.scrollHeight;
    }

    /* ================= EXPORT FUNCTIONS ================= */

    copyValidEmails() {
        let emails = this.getValidEmails();
        
        if (emails.length === 0) {
            this.showStatus('No valid emails to copy', 'error');
            return;
        }
        
        if (this.sortAlpha && this.sortAlpha.checked) {
            emails = emails.sort();
        }
        
        const separatorMap = {
            'newline': '\n',
            'comma': ', ',
            'semicolon': '; ',
            'pipe': ' | ',
            'space': ' ',
            'tab': '\t'
        };
        const separator = separatorMap[this.separator.value] || '\n';
        
        navigator.clipboard.writeText(emails.join(separator)).then(() => {
            this.showStatus(`Copied ${emails.length} valid email${emails.length !== 1 ? 's' : ''}`, 'success');
        }).catch(() => {
            this.showStatus('Failed to copy emails', 'error');
        });
    }

    copyAllEmails() {
        let emails = Array.from(this.emails);
        
        if (emails.length === 0) {
            this.showStatus('No emails to copy', 'error');
            return;
        }
        
        if (this.sortAlpha && this.sortAlpha.checked) {
            emails = emails.sort();
        }
        
        const separatorMap = {
            'newline': '\n',
            'comma': ', ',
            'semicolon': '; ',
            'pipe': ' | ',
            'space': ' ',
            'tab': '\t'
        };
        const separator = separatorMap[this.separator.value] || '\n';
        
        navigator.clipboard.writeText(emails.join(separator)).then(() => {
            this.showStatus(`Copied ${emails.length} email${emails.length !== 1 ? 's' : ''}`, 'success');
        }).catch(() => {
            this.showStatus('Failed to copy emails', 'error');
        });
    }

    exportEmails() {
        let emails = this.getValidEmails();
        
        if (emails.length === 0) {
            this.showStatus('No valid emails to export', 'error');
            return;
        }
        
        if (this.sortAlpha && this.sortAlpha.checked) {
            emails = emails.sort();
        }
        
        const separatorMap = {
            'newline': '\n',
            'comma': ', ',
            'semicolon': '; ',
            'pipe': ' | ',
            'space': ' ',
            'tab': '\t'
        };
        const separator = separatorMap[this.separator.value] || '\n';
        
        const content = emails.join(separator);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `emails-${date}.txt`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showStatus(`Exported ${emails.length} email${emails.length !== 1 ? 's' : ''}`, 'success');
    }

    clearResults() {
        if (this.emails.size === 0) {
            this.showStatus('No results to clear', 'error');
            return;
        }

        if (confirm(`Clear all ${this.emails.size} extracted emails?`)) {
            this.emails.clear();
            this.emailData.clear();
            this.currentFilter = 'all';
            
            this.filterTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.filter === 'all');
                tab.setAttribute('aria-selected', (tab.dataset.filter === 'all').toString());
            });
            
            this.renderEmails();
            this.updateStats();
            this.clearProgress();
            this.showStatus('Results cleared', 'success');
        }
    }

    /* ================= UTILITY FUNCTIONS ================= */

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    truncateUrl(url) {
        if (url.length <= 60) return url;
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname.substring(0, 30) + '...';
        } catch {
            return url.substring(0, 57) + '...';
        }
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message visible ${type}`;
        
        if (type !== 'loading') {
            setTimeout(() => {
                this.statusMessage.classList.remove('visible');
            }, 4000);
        }
    }

    finalizeExtraction(count) {
        if (count > 0) {
            this.showStatus(`Found ${count} new email${count !== 1 ? 's' : ''} (${this.emails.size} total)`, 'success');
        } else {
            this.showStatus('No new emails found', 'error');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Lite 1.6 Email Extractor ready');
    new EmailExtractor();
});
