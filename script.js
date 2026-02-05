// QuickEmail Extractor - Professional Version 2.1 (Hardened & Fixed)
class EmailExtractor {
    constructor() {
        this.WORKER_URL = 'https://email-extractor-worker.quick3830.workers.dev';

        this.emails = new Set();
        this.emailData = new Map();
        this.currentFilter = 'all';
        this.isProcessing = false;

        this.init();
    }

    /* ================= INIT ================= */

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateStats();
        this.testWorker();
    }

    cacheElements() {
        this.urlInput = document.getElementById('urlInput');
        this.textInput = document.getElementById('textInput');
        this.followLinks = document.getElementById('followLinks');
        this.maxDepth = document.getElementById('maxDepth');
        this.maxPages = document.getElementById('maxPages');

        this.extractBtn = document.getElementById('extractBtn');
        this.deepSearchBtn = document.getElementById('deepSearchBtn');
        this.extractTextBtn = document.getElementById('extractTextBtn');
        this.validateBtn = document.getElementById('validateBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');

        this.statusMessage = document.getElementById('statusMessage');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressStats = document.getElementById('progressStats');
        this.progressDetails = document.getElementById('progressDetails');
        this.resultsSection = document.getElementById('resultsSection');
        this.emailsList = document.getElementById('emailsList');
        this.saveMenu = document.getElementById('saveMenu');

        this.totalCount = document.getElementById('totalCount');
        this.validCount = document.getElementById('validCount');
        this.invalidCount = document.getElementById('invalidCount');

        this.filterTabs = document.querySelectorAll('.filter-tab');
    }

    bindEvents() {
        this.extractBtn.onclick = () => this.extractFromUrl();
        this.deepSearchBtn.onclick = () => this.deepSearch();
        this.extractTextBtn.onclick = () => this.extractFromText();
        this.validateBtn.onclick = () => this.validateAllEmails();
        this.copyBtn.onclick = () => this.copyValidEmails();
        this.clearBtn.onclick = () => this.clearResults();

        this.filterTabs.forEach(tab =>
            tab.onclick = () => this.filterEmails(tab.dataset.filter)
        );
    }

    /* ================= WORKER ================= */

    async testWorker() {
        try {
            const res = await fetch(this.WORKER_URL);
            if (!res.ok) throw new Error();
            console.log('☁️ Cloudflare Worker reachable');
        } catch {
            console.warn('⚠️ Worker not reachable');
        }
    }

    async fetchUrlContent(url) {
        const res = await fetch(`${this.WORKER_URL}/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!res.ok) {
            throw new Error(`Worker error (${res.status})`);
        }

        const data = await res.json();
        if (!data.success || !data.content) {
            throw new Error('Worker returned empty content');
        }

        return data.content;
    }

    /* ================= EXTRACTION ================= */

    extractFromText() {
        const text = this.textInput.value.trim();
        if (!text) return this.showStatus('Paste text first', 'error');

        const count = this.processText(text);
        this.finalizeExtraction(count);
    }

    async extractFromUrl() {
        const url = this.urlInput.value.trim();
        if (!this.isValidUrl(url)) return this.showStatus('Invalid URL', 'error');

        this.isProcessing = true;
        this.showStatus('Fetching page…', 'loading');

        try {
            const html = await this.fetchUrlContent(url);
            const count = this.processText(html);
            this.finalizeExtraction(count);
        } catch (e) {
            this.showStatus(e.message, 'error');
        }

        this.isProcessing = false;
    }

    async deepSearch() {
        const startUrl = this.urlInput.value.trim();
        if (!this.isValidUrl(startUrl)) return this.showStatus('Invalid URL', 'error');

        const maxDepth = +this.maxDepth.value || 2;
        const maxPages = +this.maxPages.value || 10;
        const followLinks = this.followLinks.checked;

        const visited = new Set();
        const queue = [{ url: startUrl, depth: 0 }];
        const base = new URL(startUrl).origin;

        this.clearProgress();
        this.showProgress();

        while (queue.length && visited.size < maxPages) {
            const { url, depth } = queue.shift();
            if (visited.has(url) || depth > maxDepth) continue;

            visited.add(url);
            this.updateProgress(visited.size, maxPages, url);

            try {
                const html = await this.fetchUrlContent(url);
                this.processText(html, false);

                if (followLinks && depth < maxDepth) {
                    this.extractLinks(html, base).forEach(link => {
                        if (!visited.has(link)) {
                            queue.push({ url: link, depth: depth + 1 });
                        }
                    });
                }
            } catch {}
            await new Promise(r => setTimeout(r, 400));
        }

        this.renderEmails();
        this.updateStats();
        this.showStatus(`Deep search complete (${this.emails.size} emails)`, 'success');
    }

    /* ================= CORE LOGIC ================= */

    processText(raw, render = true) {
        const clean = this.normalizeText(raw);
        const regex = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
        const matches = clean.match(regex) || [];

        let added = 0;
        for (const email of matches) {
            const e = email.toLowerCase();
            if (!this.emails.has(e)) {
                this.emails.add(e);
                this.emailData.set(e, { email: e, valid: null, status: 'unchecked' });
                added++;
            }
        }

        if (render && added) {
            this.renderEmails();
            this.updateStats();
        }

        return added;
    }

    normalizeText(html) {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/&#64;|\(at\)|\[at\]/gi, '@')
            .replace(/\(dot\)|\[dot\]/gi, '.')
            .replace(/&nbsp;|&lt;|&gt;|&amp;/gi, ' ')
            .replace(/<[^>]+>/g, ' ');
    }

    extractLinks(html, origin) {
        const links = new Set();
        const regex = /href=["']([^"'#]+)["']/gi;
        let m;
        while ((m = regex.exec(html))) {
            try {
                const u = new URL(m[1], origin);
                if (u.origin === origin) links.add(u.href);
            } catch {}
        }
        return links;
    }

    /* ================= VALIDATION ================= */

    validateAllEmails() {
        this.emailData.forEach((v, k) => {
            const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k);
            this.emailData.set(k, { ...v, valid, status: valid ? 'valid' : 'invalid' });
        });
        this.renderEmails();
        this.updateStats();
        this.showStatus('Validation complete', 'success');
    }

    getValidEmails() {
        return [...this.emailData.values()].filter(e => e.valid).map(e => e.email);
    }

    /* ================= UI ================= */

    renderEmails() {
        this.emailsList.innerHTML = '';
        this.resultsSection.classList.toggle('visible', this.emails.size > 0);

        [...this.emailData.values()].forEach(d => {
            if (
                this.currentFilter !== 'all' &&
                (this.currentFilter === 'valid') !== d.valid &&
                this.currentFilter !== 'unchecked'
            ) return;

            const div = document.createElement('div');
            div.className = `email-item ${d.status}`;
            div.textContent = d.email;
            div.onclick = () => navigator.clipboard.writeText(d.email);
            this.emailsList.appendChild(div);
        });
    }

    filterEmails(f) {
        this.currentFilter = f;
        this.filterTabs.forEach(t => t.classList.toggle('active', t.dataset.filter === f));
        this.renderEmails();
    }

    updateStats() {
        const v = [...this.emailData.values()];
        this.totalCount.textContent = v.length;
        this.validCount.textContent = v.filter(e => e.valid).length;
        this.invalidCount.textContent = v.filter(e => e.valid === false).length;
    }

    /* ================= HELPERS ================= */

    isValidUrl(u) {
        try {
            return ['http:', 'https:'].includes(new URL(u).protocol);
        } catch {
            return false;
        }
    }

    showStatus(msg, type = 'info') {
        this.statusMessage.textContent = msg;
        this.statusMessage.className = `status-message visible ${type}`;
        if (type !== 'loading') setTimeout(() => this.statusMessage.classList.remove('visible'), 4000);
    }

    showProgress() { this.progressSection.classList.add('visible'); }
    clearProgress() {
        this.progressFill.style.width = '0%';
        this.progressDetails.innerHTML = '';
    }
    updateProgress(c, t, u) {
        this.progressFill.style.width = `${(c / t) * 100}%`;
        this.progressDetails.innerHTML += `<div>Scanning: ${u}</div>`;
    }

    finalizeExtraction(count) {
        if (count) {
            this.showStatus(`Found ${count} new emails`, 'success');
        } else {
            this.showStatus('No emails found', 'error');
        }
    }

    clearResults() {
        this.emails.clear();
        this.emailData.clear();
        this.renderEmails();
        this.updateStats();
        this.showStatus('Cleared', 'success');
    }

    copyValidEmails() {
        const e = this.getValidEmails();
        if (!e.length) return this.showStatus('No valid emails', 'error');
        navigator.clipboard.writeText(e.join('\n'));
        this.showStatus(`Copied ${e.length} emails`, 'success');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 QuickEmail Extractor v2.1 ready');
    new EmailExtractor();
});
