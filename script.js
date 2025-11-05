const BACKEND_URL = 'https://bot-hosting-production.up.railway.app';
let currentSessionId = null;
let statusCheckInterval = null;
let connectionMonitorInterval = null;
let wsConnection = null;

// Load connected bots on page load
// Auto-format phone number input - TARUH DI SINI (di luar semua function)
document.addEventListener('DOMContentLoaded', function() {
    // Auto-format untuk input nomor
    const phoneInput = document.getElementById('phone');
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value;
        
        // Remove all non-digit characters
        value = value.replace(/\D/g, '');
        
        // Remove leading zeros and ensure starts with 62
        if (value.startsWith('0')) {
            value = '62' + value.substring(1);
        } else if (value.startsWith('62')) {
            // Already starts with 62, do nothing
        } else if (value.startsWith('+62')) {
            value = '62' + value.substring(3);
        }
        
        // Limit to 15 digits max (62 + 13 digits)
        value = value.substring(0, 15);
        
        // Update input value
        e.target.value = value;
    });

    // Handle paste event
    phoneInput.addEventListener('paste', function(e) {
        // Let the input event handle the formatting
        setTimeout(() => {
            this.dispatchEvent(new Event('input'));
        }, 0);
    });

    // Load connected bots dan lainnya
    loadConnectedBots();
    loadStorageInfo();
    startConnectionMonitoring();
});

function setButtonsEnabled(enabled) {
    document.getElementById('qrBtn').disabled = !enabled;
    document.getElementById('pairingBtn').disabled = !enabled;
}

function copyPairingCode() {
    const pairingCodeElement = document.getElementById('pairingCode');
    const copyButton = document.querySelector('.copy-icon-btn');
    
    if (pairingCodeElement) {
        const code = pairingCodeElement.textContent;
        
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                copyButton.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                `;
                copyButton.classList.add('copied');
                copyButton.style.color = '#28a745';
                
                setTimeout(() => {
                    copyButton.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                    copyButton.classList.remove('copied');
                    copyButton.style.color = '#6c757d';
                }, 2000);
                
                showStatus('Kode berhasil disalin!', 'success');
            } else {
                showStatus('Gagal menyalin kode', 'error');
            }
        } catch (err) {
            document.body.removeChild(textArea);
            console.error('Failed to copy: ', err);
            showStatus('Gagal menyalin kode', 'error');
        }
    }
}

async function startAuth(method) {
    const phone = document.getElementById('phone').value.trim();
    
    if(!phone) {
        showStatus('Masukkan nomor WhatsApp terlebih dahulu!', 'error');
        return;
    }

    if(!phone.startsWith('62')) {
        showStatus('Nomor harus diawali dengan 62 (Indonesia)', 'error');
        return;
    }

    // Disable buttons during auth
    setButtonsEnabled(false);
    
    // Show loading state
    document.getElementById('auth-area').innerHTML = `
        <div class="loading-overlay">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${method === 'pairing' ? 'Meminta kode pairing...' : 'Membuat QR code...'}</p>
            </div>
        </div>
    `;
    
    showStatus(`<div class="loader"></div> ${method === 'pairing' ? 'Meminta kode pairing dari WhatsApp...' : 'Membuat QR code...'}`, 'connecting');

    try {
        const response = await fetch(`${BACKEND_URL}/start-auth`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                phoneNumber: phone, 
                method: method 
            })
        });

        if(!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentSessionId = data.sessionId;
        
        // Start WebSocket connection for real-time updates
        connectWebSocket(currentSessionId);
        
        // Start checking connection status (fallback if WebSocket fails)
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
        statusCheckInterval = setInterval(() => {
            checkConnectionStatus(currentSessionId);
        }, 5000);

        // Timeout after 60 seconds
        setTimeout(() => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
            const statusEl = document.getElementById('status');
            if (!statusEl.textContent.includes('berhasil') &&
                !statusEl.textContent.includes('connected')) {
                showStatus('Waktu habis! Coba lagi', 'error');
                setButtonsEnabled(true);
                document.getElementById('auth-area').innerHTML = 
                    '<p style="color: #999; font-size: 14px;">Authentication timeout</p>';
            }
        }, 60000);

    } catch(error) {
        console.error('Error:', error);
        showStatus('Gagal terhubung ke server. Coba lagi', 'error');
        setButtonsEnabled(true);
        document.getElementById('auth-area').innerHTML = 
            '<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';
    }
}

async function checkConnectionStatus(sessionId) {
    try {
        const response = await fetch(`${BACKEND_URL}/status/${sessionId}`);
        const data = await response.json();

        if (data.connected) {
            showStatus('Bot berhasil terhubung!', 'success');
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
            setButtonsEnabled(true);
            // Clear auth area
            document.getElementById('auth-area').innerHTML =
                '<p style="color: #999; font-size: 14px;">Bot berhasil terhubung</p>';
            // Reload connected bots list
            loadConnectedBots();
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

async function loadConnectedBots() {
    try {
        const response = await fetch(`${BACKEND_URL}/connected-bots`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const bots = await response.json();
        
        const botListElement = document.getElementById('bot-list');
        
        if (bots.length > 0) {
            botListElement.innerHTML = bots.map(bot => `
                <div class="bot-item ${bot.connected ? '' : 'disconnected'}">
                    <div class="bot-info">
                        <div class="bot-avatar ${bot.connected ? '' : 'disconnected'}">
                            ${bot.phoneNumber ? bot.phoneNumber.slice(-2) : 'B'}
                        </div>
                        <div class="bot-details">
                            <h4>${bot.phoneNumber || 'Unknown Number'}</h4>
                            <div class="phone-number">${bot.phoneNumber || bot.sessionId}</div>
                            <div class="connection-time">
                                ${bot.connected ? 
                                    `Connected ${new Date(bot.connectionTime).toLocaleTimeString()}` : 
                                    'Disconnected'
                                }
                            </div>
                        </div>
                    </div>
                    <div class="bot-status-container">
                        <div class="bot-status ${bot.connected ? '' : 'offline'}">
                            <div class="status-dot ${bot.connected ? '' : 'offline'}"></div>
                            ${bot.connected ? 'Online' : 'Offline'}
                        </div>
                        <div class="bot-actions">
                            <button class="stop-btn" onclick="stopBot('${bot.phoneNumber}')" ${!bot.connected ? 'disabled' : ''}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                                Stop
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            botListElement.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <h3>No Bots Connected</h3>
                    <p>Setup your first WhatsApp bot using the form below</p>
                </div>
            `;
        }
    } catch(error) {
        console.error('Error loading bots:', error);
        const botListElement = document.getElementById('bot-list');
        botListElement.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <h3>Connection Error</h3>
                <p>Failed to load connected bots</p>
            </div>
        `;
    }
}

async function stopBot(phoneNumber) {
    if (!confirm(`Stop bot ${phoneNumber}?`)) return;
    
    try {
        showStatus(`<div class="loader loader-small"></div> Stopping bot...`, 'connecting');
        
        const response = await fetch(`${BACKEND_URL}/stop-bot`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ phoneNumber })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            showStatus(`Bot ${phoneNumber} berhasil di-stop`, 'success');
            loadConnectedBots();
        } else {
            showStatus(`Gagal stop bot: ${data.error}`, 'error');
        }
    } catch(error) {
        console.error('Error stopping bot:', error);
        showStatus('Gagal stop bot', 'error');
    }
}

async function stopAllBots() {
    if (!confirm('Stop semua bot yang terhubung?')) return;
    
    try {
        showStatus(`<div class="loader"></div> Stopping all bots...`, 'connecting');
        
        const response = await fetch(`${BACKEND_URL}/stop-all-connections`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            showStatus(`Semua bot berhasil di-stop (${data.stoppedSessions.length} sessions)`, 'success');
            loadConnectedBots();
        } else {
            showStatus(`Gagal stop semua bot: ${data.error}`, 'error');
        }
    } catch(error) {
        console.error('Error stopping all bots:', error);
        showStatus('Gagal stop semua bot', 'error');
    }
}

async function loadStorageSessions() {
    try {
        showStatus(`<div class="loader"></div> Loading sessions...`, 'connecting');
        
        const response = await fetch(`${BACKEND_URL}/storage/sessions`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            const sessions = data.sessions;
            let message = `Total sessions: ${sessions.length}`;
            const connected = sessions.filter(s => s.connected).length;
            if (connected > 0) {
                message += ` (${connected} connected)`;
            }
            showStatus(message, 'success');
        } else {
            showStatus('Gagal load sessions', 'error');
        }
    } catch(error) {
        console.error('Error loading sessions:', error);
        showStatus('Gagal load sessions', 'error');
    }
}

async function loadStorageInfo() {
    try {
        const response = await fetch(`${BACKEND_URL}/storage/active-sessions`);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const infoEl = document.getElementById('storage-info');
                infoEl.textContent = `${data.sessions.length} active sessions in storage`;
            }
        }
    } catch(error) {
        console.error('Error loading storage info:', error);
    }
}

function startConnectionMonitoring() {
    // Monitor connection status every 10 seconds
    connectionMonitorInterval = setInterval(async () => {
        if (currentSessionId) {
            try {
                const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
                const data = await response.json();
                
                if (!data.connected) {
                    showStatus('Bot disconnected!', 'disconnected');
                    loadConnectedBots();
                }
            } catch (error) {
                console.error('Connection monitor error:', error);
                showStatus('Connection lost!', 'error');
            }
        }
        
        // Always refresh bot list
        loadConnectedBots();
        loadStorageInfo();
    }, 10000);
}

function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.innerHTML = message;
    statusEl.className = `status-${type}`;

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusEl.className === 'status-success') {
                statusEl.innerHTML = '<p style="color: #999; font-size: 14px;">Ready to connect</p>';
                statusEl.className = '';
            }
        }, 5000);
    }
}

function loadQRCodeLibrary(qrData) {
    if (typeof QRCode === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
        script.onload = () => generateQRCode(qrData);
        document.head.appendChild(script);
    } else {
        generateQRCode(qrData);
    }
}

function generateQRCode(qrData) {
    const qrcode = new QRCode(document.getElementById("qrcode"), {
        text: qrData,
        width: 200,
        height: 200,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// WebSocket connection for real-time updates
function connectWebSocket(sessionId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${BACKEND_URL.replace(/^https?:\/\//, '')}/ws?sessionId=${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsConnection = ws;

    ws.onopen = () => {
        console.log('WebSocket connected');
        showStatus('Real-time monitoring active', 'success');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data);
            
            switch (data.status) {
                case 'connecting':
                    showStatus('<div class="loader"></div> Menghubungkan ke WhatsApp...', 'connecting');
                    break;
                    
                case 'requesting_pairing':
                    showStatus('<div class="loader"></div> Meminta kode pairing dari WhatsApp...', 'connecting');
                    break;
                    
                case 'pairing_code_ready':
                    document.getElementById('auth-area').innerHTML = `
                        <div>
                            <h3>Pairing Code</h3>
                            <div class="pairing-code-container">
                                <div class="pairing-code" id="pairingCode">${data.pairingCode}</div>
                                <button class="copy-icon-btn" onclick="copyPairingCode()" title="Salin kode">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                            </div>
                            <p class="instructions">
                                WhatsApp > Linked Devices > Link a Device<br>
                                Masukkan kode di atas (expires in 60 detik)
                            </p>
                        </div>
                    `;
                    showStatus('Kode pairing berhasil dibuat!', 'waiting');
                    break;
                    
                case 'pairing_expired':
                    showStatus('Kode pairing expired! Silakan coba lagi', 'error');
                    setButtonsEnabled(true);
                    document.getElementById('auth-area').innerHTML = 
                        '<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';
                    break;
                    
                case 'pairing_failed':
                    showStatus(`Gagal pairing: ${data.message}`, 'error');
                    setButtonsEnabled(true);
                    document.getElementById('auth-area').innerHTML = 
                        '<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';
                    break;
                    
                case 'qr_generated':
                    showStatus('<div class="loader"></div> QR code dibuat! Scan dalam 60 detik', 'waiting');
                    break;
case 'qr_ready':
    const qrData = data.qr;
    console.log('QR Data:', qrData);
    
    // Fallback QR generators
    const qrGenerators = [
        `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&format=png&margin=10`,
        `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=200&margin=1`,
        `https://api.qr-code-generator.com/v1/create?access-token=YOUR_TOKEN&qr_code_text=${encodeURIComponent(qrData)}&image_format=PNG&image_width=200`
    ];
    
    let qrHtml = '';
    for (let i = 0; i < Math.min(2, qrGenerators.length); i++) {
        qrHtml += `<img src="${qrGenerators[i]}" 
                       alt="QR Code ${i+1}"
                       style="border-radius: 8px; max-width: 180px; margin: 5px; border: 1px solid #ddd;"
                       onerror="console.log('QR ${i+1} failed')">`;
    }
    
    document.getElementById('auth-area').innerHTML = 
        `<div class="qrcode-container">
            <h3>Scan QR Code</h3>
            <div style="text-align: center;">
                ${qrHtml}
            </div>
            <p class="instructions">
                <strong>WhatsApp > Linked Devices > Link a Device > Scan QR Code</strong><br>
                Jika QR tidak muncul, coba refresh halaman
            </p>
        </div>`;
    showStatus('QR code siap untuk di-scan', 'waiting');
    break;
                    
                case 'waiting_qr':
                    showStatus('<div class="loader"></div> Menunggu QR code dari WhatsApp...', 'connecting');
                    break;
                    
                case 'connected':
                    showStatus('WhatsApp berhasil terhubung!', 'success');
                    setButtonsEnabled(true);
                    document.getElementById('auth-area').innerHTML = 
                        '<p style="color: #999; font-size: 14px;">Bot berhasil terhubung</p>';
                    loadConnectedBots();
                    loadStorageInfo();
                    break;
                    
                case 'reconnecting':
                    showStatus('<div class="loader"></div> Koneksi terputus, menyambung ulang...', 'reconnecting');
                    loadConnectedBots();
                    break;
                    
                case 'disconnected':
                    showStatus('WhatsApp terputus', 'disconnected');
                    loadConnectedBots();
                    break;
                    
                case 'timeout':
                    showStatus('Koneksi timeout! Silakan coba lagi', 'error');
                    setButtonsEnabled(true);
                    document.getElementById('auth-area').innerHTML = 
                        '<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';
                    break;
                    
                case 'error':
                    showStatus(`Error: ${data.message}`, 'error');
                    setButtonsEnabled(true);
                    document.getElementById('auth-area').innerHTML = 
                        '<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';
                    break;
                    
                default:
                    if (data.connected !== undefined) {
                        const statusMessage = data.connected ? 
                            'WhatsApp terhubung' : 
                            '<div class="loader"></div> WhatsApp terputus';
                        showStatus(statusMessage, data.connected ? 'success' : 'disconnected');
                        loadConnectedBots();
                    }
            }
        } catch (error) {
            console.error('WebSocket message parse error:', error);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Try to reconnect after 3 seconds
        setTimeout(() => {
            if (currentSessionId) {
                connectWebSocket(currentSessionId);
            }
        }, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    return ws;
}

// Cleanup function
function cleanup() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
    currentSessionId = null;
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);
