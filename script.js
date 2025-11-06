let BACKEND_URL="https://bot-hosting-production.up.railway.app",currentSessionId=null,statusCheckInterval=null,connectionMonitorInterval=null,wsConnection=null,pageStartTime=Date.now();function setButtonsEnabled(e){document.getElementById("qrBtn").disabled=!e,document.getElementById("pairingBtn").disabled=!e}function copyPairingCode(){var e=document.getElementById("pairingCode");let t=document.querySelector(".copy-icon-btn");if(e){var e=e.textContent,o=document.createElement("textarea");o.value=e,document.body.appendChild(o),o.select(),o.setSelectionRange(0,99999);try{var n=document.execCommand("copy");document.body.removeChild(o),n?(t.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>`,t.classList.add("copied"),t.style.color="#28a745",setTimeout(()=>{t.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>`,t.classList.remove("copied"),t.style.color="#6c757d"},2e3),showStatus("Kode berhasil disalin!","success")):showStatus("Gagal menyalin kode","error")}catch(e){document.body.removeChild(o),console.error("Failed to copy: ",e),showStatus("Gagal menyalin kode","error")}}}async function startAuth(e){var t=document.getElementById("phone").value.trim();if(t)if(t.startsWith("62")){setButtonsEnabled(!1),document.getElementById("auth-area").innerHTML=`<div class="loading-overlay">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${"pairing"===e?"Meminta kode pairing...":"Membuat QR code..."}</p>
            </div>
        </div>`,showStatus('<div class="loader"></div> '+("pairing"===e?"Meminta kode pairing dari WhatsApp...":"Membuat QR code..."),"connecting");try{var o=await fetch(BACKEND_URL+"/start-auth",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({phoneNumber:t,method:e})});if(!o.ok)throw new Error("HTTP error! status: "+o.status);var n=await o.json();connectWebSocket(currentSessionId=n.sessionId),statusCheckInterval&&clearInterval(statusCheckInterval),statusCheckInterval=setInterval(()=>{checkConnectionStatus(currentSessionId)},1e4),setTimeout(()=>{statusCheckInterval&&clearInterval(statusCheckInterval);var e=document.getElementById("status");e.textContent.includes("berhasil")||e.textContent.includes("connected")||(showStatus("Waktu habis! Coba lagi","error"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Authentication timeout</p>')},6e4)}catch(e){console.error("Error:",e),showStatus("Gagal terhubung ke server. Coba lagi","error"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>'}}else showStatus("Nomor harus diawali dengan 62 (Indonesia)","error");else showStatus("Masukkan nomor WhatsApp terlebih dahulu!","error")}async function checkConnectionStatus(e){try{(await(await fetch(BACKEND_URL+"/status/"+e)).json()).connected&&(showStatus("Bot berhasil terhubung!","success"),statusCheckInterval&&clearInterval(statusCheckInterval),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Bot berhasil terhubung</p>',loadConnectedBots())}catch(e){console.error("Status check error:",e)}}async function updateFooterStats(){try{var e=await(await fetch(BACKEND_URL+"/server-info")).json(),t=Math.floor(e.uptime/86400),o=Math.floor(e.uptime%86400/3600),n=0<t?t+`d ${o}h`:o+"h";document.getElementById("total-bots").textContent=document.querySelectorAll(".bot-item:not(.disconnected)").length,document.getElementById("uptime").textContent=n,document.getElementById("memory").textContent=e.memory.used+"MB"}catch(e){console.error("Error fetching server info:",e),document.getElementById("uptime").textContent="N/A",document.getElementById("memory").textContent="N/A"}}async function loadConnectedBots(){try{var e=await fetch(BACKEND_URL+"/connected-bots");if(!e.ok)throw new Error("HTTP error! status: "+e.status);var t=await e.json(),o=document.getElementById("bot-list");0<t.length?o.innerHTML=t.map(e=>`<div class="bot-item ${e.connected?"":"disconnected"}">
                    <div class="bot-info">
                        <div class="bot-avatar ${e.connected?"":"disconnected"}">
                            ${e.phoneNumber?e.phoneNumber.slice(-2):"B"}
                        </div>
                        <div class="bot-details">
                            <h4>${e.phoneNumber||"Unknown Number"}</h4>
                            <div class="phone-number">${e.phoneNumber||e.sessionId}</div>
                            <div class="connection-time">
                                ${e.connected?"Connected "+new Date(e.connectionTime).toLocaleTimeString():"Disconnected"}
                            </div>
                        </div>
                    </div>
                    <div class="bot-status-container">
                        <div class="bot-status ${e.connected?"":"offline"}">
                            <div class="status-dot ${e.connected?"":"offline"}"></div>
                            ${e.connected?"Online":"Offline"}
                        </div>
                        <div class="bot-actions">
                            <button class="stop-btn" onclick="stopBot('${e.phoneNumber}')" ${e.connected?"":"disabled"}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                                Stop
                            </button>
                        </div>
                    </div>
                </div>`).join(""):o.innerHTML=`<div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <h3>No Bots Connected</h3>
                    <p>Setup your first WhatsApp bot using the form below</p>
                </div>`,updateFooterStats()}catch(e){console.error("Error loading bots:",e),document.getElementById("bot-list").innerHTML=`<div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <h3>Connection Error</h3>
                <p>Failed to load connected bots</p>
            </div>`}}async function stopBot(e){if(confirm(`Stop bot ${e}?`))try{showStatus('<div class="loader loader-small"></div> Stopping bot...',"connecting");var t=await fetch(BACKEND_URL+"/stop-bot",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({phoneNumber:e})});if(!t.ok)throw new Error("HTTP error! status: "+t.status);var o=await t.json();o.success?(showStatus(`Bot ${e} berhasil di-stop`,"success"),loadConnectedBots()):showStatus("Gagal stop bot: "+o.error,"error")}catch(e){console.error("Error stopping bot:",e),showStatus("Gagal stop bot","error")}}async function stopAllBots(){if(confirm("Stop semua bot yang terhubung?"))try{showStatus('<div class="loader"></div> Stopping all bots...',"connecting");var e=await fetch(BACKEND_URL+"/stop-all-connections",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"}});if(!e.ok)throw new Error("HTTP error! status: "+e.status);var t=await e.json();t.success?(showStatus(`Semua bot berhasil di-stop (${t.stoppedSessions.length} sessions)`,"success"),loadConnectedBots()):showStatus("Gagal stop semua bot: "+t.error,"error")}catch(e){console.error("Error stopping all bots:",e),showStatus("Gagal stop semua bot","error")}}async function loadStorageSessions(){try{showStatus('<div class="loader"></div> Loading sessions...',"connecting");var e=await fetch(BACKEND_URL+"/storage/sessions");if(!e.ok)throw new Error("HTTP error! status: "+e.status);var t=await e.json();if(t.success){var o=t.sessions;let e="Total sessions: "+o.length;var n=o.filter(e=>e.connected).length;0<n&&(e+=` (${n} connected)`),showStatus(e,"success")}else showStatus("Gagal load sessions","error")}catch(e){console.error("Error loading sessions:",e),showStatus("Gagal load sessions","error")}}async function loadStorageInfo(){try{var e,t=await fetch(BACKEND_URL+"/storage/active-sessions");t.ok&&(e=await t.json()).success&&(document.getElementById("storage-info").textContent=e.sessions.length+" active sessions in storage")}catch(e){console.error("Error loading storage info:",e)}}function startConnectionMonitoring(){connectionMonitorInterval=setInterval(async()=>{if(currentSessionId)try{(await(await fetch(BACKEND_URL+"/status/"+currentSessionId)).json()).connected||(showStatus("Bot disconnected!","disconnected"),loadConnectedBots())}catch(e){console.error("Connection monitor error:",e),showStatus("Connection lost!","error")}loadConnectedBots(),loadStorageInfo(),updateFooterStats()},1e4),updateFooterStats()}function showStatus(e,t){let o=document.getElementById("status");o.innerHTML=e,o.className="status-"+t,"success"===t&&setTimeout(()=>{"status-success"===o.className&&(o.innerHTML='<p style="color: #999; font-size: 14px;">Ready to connect</p>',o.className="")},5e3)}function connectWebSocket(e){e=("https:"===window.location.protocol?"wss:":"ws:")+`//${BACKEND_URL.replace(/^https?:\/\//,"")}/ws?sessionId=`+e,e=new WebSocket(e);return(wsConnection=e).onopen=()=>{console.log("WebSocket connected"),showStatus("Real-time monitoring active","success")},e.onmessage=e=>{try{var t,o=JSON.parse(e.data);switch(console.log("WebSocket message:",o),o.status){case"connecting":showStatus('<div class="loader"></div> Menghubungkan ke WhatsApp...',"connecting");break;case"requesting_pairing":showStatus('<div class="loader"></div> Meminta kode pairing dari WhatsApp...',"connecting");break;case"pairing_code_ready":document.getElementById("auth-area").innerHTML=`<div>
                            <h3>Pairing Code</h3>
                            <div class="pairing-code-container">
                                <div class="pairing-code" id="pairingCode">${o.pairingCode}</div>
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
                        </div>`,showStatus("Kode pairing berhasil dibuat!","waiting");break;case"pairing_expired":showStatus("Kode pairing expired! Silakan coba lagi","error"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';break;case"pairing_failed":showStatus("Gagal pairing: "+o.message,"error"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';break;case"qr_generated":showStatus('<div class="loader"></div> QR code dibuat! Scan dalam 60 detik',"waiting");break;case"qr_ready":console.log("QR Data from backend:",o),o.qr&&"undefined"!==o.qr?(t=o.qr,console.log("QR Data length:",t.length),console.log("QR Data sample:",t.substring(0,50)),document.getElementById("auth-area").innerHTML=`<div class="qrcode-container">
            <h3>Scan QR Code</h3>
            <!-- QR dari backend -->
            <div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(t)}&format=png&margin=10" 
                     alt="WhatsApp QR"
                     style="border-radius: 8px; border: 2px solid #007bff;"
                     onerror="this.style.borderColor='#dc3545'; this.nextElementSibling.textContent='❌ QR gagal load'">
                <p style="font-size: 10px; color: #666;" id="qr-status">Loading QR...</p>
            </div>
            
            <p class="instructions">
                <strong>WhatsApp > Linked Devices > Link a Device > Scan QR Code</strong><br>
            </p>
            
            <div style="margin-top: 10px; font-size: 10px; color: #666; background: #f8f9fa; padding: 8px; border-radius: 6px;">
                <strong>Debug Info:</strong><br>
                QR Length: ${t.length} chars<br>
                First 30 chars: ${t.substring(0,30)}<br>
                Last 30 chars: ${t.substring(t.length-30)}<br>
                Contains 'undefined': ${t.includes("undefined")}
            </div>
        </div>`,showStatus("QR code siap untuk di-scan","waiting")):(document.getElementById("auth-area").innerHTML=`<div style="text-align: center; color: #dc3545;">
                <h3>❌ QR Code Error</h3>
                <p>QR data tidak valid dari server</p>
                <div style="background: #f8d7da; padding: 10px; border-radius: 8px; margin: 10px 0;">
                    <strong>Debug Info:</strong><br>
                    QR Data: ${JSON.stringify(o)}<br>
                </div>
                <button class="auth-btn qr-btn" onclick="startAuth('qr')" style="margin-top: 10px;">
                    Coba Lagi
                </button>
            </div>`,showStatus("Error: QR data tidak valid","error"),setButtonsEnabled(!0));break;case"waiting_qr":showStatus('<div class="loader"></div> Menunggu QR code dari WhatsApp...',"connecting");break;case"connected":showStatus("WhatsApp berhasil terhubung!","success"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Bot berhasil terhubung</p>',loadConnectedBots(),loadStorageInfo();break;case"reconnecting":showStatus('<div class="loader"></div> Koneksi terputus, menyambung ulang...',"reconnecting"),loadConnectedBots();break;case"disconnected":showStatus("WhatsApp terputus","disconnected"),loadConnectedBots();break;case"timeout":showStatus("Koneksi timeout! Silakan coba lagi","error"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';break;case"error":showStatus("Error: "+o.message,"error"),setButtonsEnabled(!0),document.getElementById("auth-area").innerHTML='<p style="color: #999; font-size: 14px;">Pilih metode autentikasi</p>';break;default:void 0!==o.connected&&(showStatus(o.connected?"WhatsApp terhubung":'<div class="loader"></div> WhatsApp terputus',o.connected?"success":"disconnected"),loadConnectedBots())}}catch(e){console.error("WebSocket message parse error:",e)}},e.onclose=()=>{console.log("WebSocket disconnected"),setTimeout(()=>{currentSessionId&&connectWebSocket(currentSessionId)},3e3)},e.onerror=e=>{console.error("WebSocket error:",e)},e}function cleanup(){statusCheckInterval&&(clearInterval(statusCheckInterval),statusCheckInterval=null),connectionMonitorInterval&&(clearInterval(connectionMonitorInterval),connectionMonitorInterval=null),wsConnection&&(wsConnection.close(),wsConnection=null),currentSessionId=null}document.addEventListener("DOMContentLoaded",function(){var e=document.getElementById("phone");e.addEventListener("input",function(e){let t=e.target.value;(t=t.replace(/\D/g,"")).startsWith("0")?t="62"+t.substring(1):t.startsWith("62")||t.startsWith("+62")&&(t="62"+t.substring(3)),t=t.substring(0,15),e.target.value=t}),e.addEventListener("paste",function(e){setTimeout(()=>{this.dispatchEvent(new Event("input"))},0)}),loadConnectedBots(),loadStorageInfo(),startConnectionMonitoring()}),window.addEventListener("beforeunload",cleanup),window.addEventListener("load",function(){setTimeout(function(){let e=document.getElementById("splash-loader"),t=document.getElementById("main-content");e.classList.add("fade-out"),setTimeout(function(){e.style.display="none",t.style.display="block"},500)},2e3)}),document.addEventListener("contextmenu",e=>e.preventDefault()),document.addEventListener("keydown",e=>{(123===e.keyCode||e.ctrlKey&&e.shiftKey&&73===e.keyCode)&&e.preventDefault()});