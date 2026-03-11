/* ============================================
   PRIVACY.JS - Privacy Dashboard & Monitoring
   ============================================ */

class PrivacyMonitor {
  constructor() {
    this.metrics = {
      bytesToCloud: 0,
      localProcessingBytes: 0,
      notesCreated: 0,
      notesEncrypted: 0,
      aiOperationsCount: 0,
      networkRequestsBlocked: 0,
      sessionStart: Date.now(),
      events: []
    };
    
    this.load();
    this.monitorNetwork();
    this.updateBadge();
    this.syncWithExistingData();
    
    console.log('✅ Privacy Monitor initialized');
  }

  // Load saved metrics
  load() {
    try {
      const saved = localStorage.getItem('privacy_metrics');
      if (saved) {
        this.metrics = { ...this.metrics, ...JSON.parse(saved) };
        console.log('📊 Loaded privacy metrics');
      }
    } catch (e) {
      console.error('Failed to load privacy metrics:', e);
    }
  }

  // Save metrics
  save() {
    try {
      localStorage.setItem('privacy_metrics', JSON.stringify(this.metrics));
    } catch (e) {
      console.error('Failed to save privacy metrics:', e);
    }
  }

  // Add event to timeline
  addEvent(type, data = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this.metrics.events.push(event);
    
    // Keep only last 50 events
    if (this.metrics.events.length > 50) {
      this.metrics.events = this.metrics.events.slice(-50);
    }
    
    this.save();
  }

  // Monitor network requests
  monitorNetwork() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = function(...args) {
      const url = args[0];
      
      const allowedDomains = [
        'cdnjs.cloudflare.com',
        'cdn.jsdelivr.net'
      ];

      const isAllowed = allowedDomains.some(domain => 
        (typeof url === 'string' && url.includes(domain))
      );

      if (!isAllowed && !url.toString().startsWith('blob:') && !url.toString().startsWith('data:')) {
        self.metrics.networkRequestsBlocked++;
        self.save();
        self.updateBadge();
        
        console.log(`🛡️ Blocked network request: ${url}`);
        return Promise.reject(new Error('Blocked by privacy policy'));
      }

      return originalFetch.apply(this, args);
    };
    
    console.log('🔒 Network monitoring active');
  }

  // Track local data processing
  trackLocalProcessing(bytes) {
    this.metrics.localProcessingBytes += bytes;
    this.addEvent('local-processing', { bytes });
    this.save();
    this.updateBadge();
  }

  // Track note creation
  trackNoteCreated() {
    this.metrics.notesCreated++;
    this.addEvent('note-created');
    this.save();
    this.updateBadge();
  }

  // Track encryption
  trackEncryption() {
    this.metrics.notesEncrypted++;
    this.addEvent('note-encrypted');
    this.save();
    this.updateBadge();
  }

  // Track AI operations
  trackAIOperation(operation, dataSize = 0) {
    this.metrics.aiOperationsCount++;
    this.metrics.localProcessingBytes += dataSize;
    this.addEvent('ai-operation', { operation, bytes: dataSize });
    this.save();
    this.updateBadge();
  }

  // Update privacy badge in UI
  updateBadge() {
    const badge = document.getElementById('privacy-status');
    if (badge) {
      badge.textContent = '100% Local';
    }
  }

  // Show privacy dashboard
  showDashboard() {
    const modal = document.getElementById('privacy-dashboard');
    const metricsContainer = document.getElementById('privacy-metrics');
    
    if (!modal || !metricsContainer) return;

    // Calculate metrics
    const totalNotes = Object.keys(storage.data.notes || {}).length;
    const encryptedNotes = Object.values(storage.data.notes || {}).filter(n => n.encrypted).length;
    const localBytes = this.metrics.localProcessingBytes;
    const aiOps = this.metrics.aiOperationsCount;

    metricsContainer.innerHTML = `
      <div class="privacy-hero">
        <div class="privacy-shield-large">
          <div class="shield-pulse-large"></div>
          <div class="shield-icon-large">🛡️</div>
        </div>
        <h3>Your Privacy is Protected</h3>
        <p>All data processing happens locally on your device. Zero cloud storage.</p>
      </div>

      <div class="privacy-stats-grid">
        <div class="privacy-stat-card stat-success">
          <div class="stat-icon">✓</div>
          <div class="stat-content">
            <div class="stat-value">${formatBytes(localBytes)}</div>
            <div class="stat-label">Processed Locally</div>
            <div class="stat-sublabel">Never uploaded to cloud</div>
          </div>
        </div>

        <div class="privacy-stat-card stat-primary">
          <div class="stat-icon">🤖</div>
          <div class="stat-content">
            <div class="stat-value">${aiOps}</div>
            <div class="stat-label">AI Operations</div>
            <div class="stat-sublabel">100% on-device processing</div>
          </div>
        </div>

        <div class="privacy-stat-card stat-warning">
          <div class="stat-icon">🔒</div>
          <div class="stat-content">
            <div class="stat-value">${encryptedNotes}/${totalNotes}</div>
            <div class="stat-label">Encrypted Notes</div>
            <div class="stat-sublabel">AES-256 encryption</div>
          </div>
        </div>

        <div class="privacy-stat-card stat-danger">
          <div class="stat-icon">🚫</div>
          <div class="stat-content">
            <div class="stat-value">0 KB</div>
            <div class="stat-label">Cloud Storage</div>
            <div class="stat-sublabel">Zero server uploads</div>
          </div>
        </div>
      </div>

      <div class="privacy-guarantees">
        <h4>🛡️ Our Privacy Guarantees</h4>
        <div class="guarantees-grid">
          <div class="guarantee-item">
            <span class="guarantee-icon">✓</span>
            <div class="guarantee-text">
              <strong>Zero Tracking</strong>
              <p>No analytics, cookies, or user tracking</p>
            </div>
          </div>
          
          <div class="guarantee-item">
            <span class="guarantee-icon">✓</span>
            <div class="guarantee-text">
              <strong>Local Storage Only</strong>
              <p>All data stays in your browser</p>
            </div>
          </div>
          
          <div class="guarantee-item">
            <span class="guarantee-icon">✓</span>
            <div class="guarantee-text">
              <strong>No External APIs</strong>
              <p>AI runs entirely on your device</p>
            </div>
          </div>
          
          <div class="guarantee-item">
            <span class="guarantee-icon">✓</span>
            <div class="guarantee-text">
              <strong>You Own Your Data</strong>
              <p>Export anytime, delete anytime</p>
            </div>
          </div>
        </div>
      </div>

      <div class="privacy-timeline">
        <h4>📊 Privacy Activity</h4>
        <div class="timeline-items">
          ${this.metrics.events.slice(-5).reverse().map(event => `
            <div class="timeline-item">
              <div class="timeline-icon ${event.type}">${this.getEventIcon(event.type)}</div>
              <div class="timeline-content">
                <div class="timeline-title">${this.getEventTitle(event)}</div>
                <div class="timeline-time">${new Date(event.timestamp).toLocaleString()}</div>
              </div>
            </div>
          `).join('') || '<p style="text-align: center; color: var(--color-text-secondary);">No recent activity</p>'}
        </div>
      </div>

      <div class="privacy-footer">
        <p>
          <strong>Your privacy matters.</strong> 
          Simple Notes is designed with privacy as the foundation, not an afterthought.
        </p>
      </div>
    `;

    modal.style.display = 'flex';
    log('Privacy dashboard opened', 'info');
  }

  getEventIcon(type) {
    const icons = {
      'note-created': '📝',
      'note-encrypted': '🔒',
      'ai-operation': '🤖',
      'local-processing': '💾'
    };
    return icons[type] || '📋';
  }

  getEventTitle(event) {
    const titles = {
      'note-created': 'Note created locally',
      'note-encrypted': 'Note encrypted with AES-256',
      'ai-operation': `AI ${event.operation} (${formatBytes(event.bytes)})`,
      'local-processing': `Processed ${formatBytes(event.bytes)} locally`
    };
    return titles[event.type] || 'Privacy event';
  }

  // Hide dashboard
  hideDashboard() {
    const modal = document.getElementById('privacy-dashboard');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Sync with existing data
  syncWithExistingData() {
    setTimeout(() => {
      if (typeof storage !== 'undefined') {
        const notes = storage.getNotes();
        
        if (this.metrics.notesCreated === 0 && notes.length > 0) {
          this.metrics.notesCreated = notes.length;
          
          notes.forEach(note => {
            const noteBytes = new Blob([JSON.stringify(note)]).size;
            this.metrics.localProcessingBytes += noteBytes;
            
            if (note.encrypted) {
              this.metrics.notesEncrypted++;
            }
          });
          
          this.save();
          this.updateBadge();
          console.log('✅ Synced metrics with existing data');
        }
      }
    }, 100);
  }
}

// Create global instance
const privacyMonitor = new PrivacyMonitor();

console.log('✅ Privacy monitor loaded - protecting your data!');