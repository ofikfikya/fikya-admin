const SCRIPT_URL = 'URL_WEB_APP_APPS_SCRIPT_ANDA'; // Ganti dengan URL Anda

async function loadComments() {
    const list = document.getElementById('comment-list');
    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}?action=getComments&postId=semua&callback=renderComments`;
    document.body.appendChild(script);
}

function renderComments(response) {
    const list = document.getElementById('comment-list');
    if (response.status !== 'ok' || response.comments.length === 0) {
        list.innerHTML = '<p>Tidak ada komentar pending.</p>';
        return;
    }
    list.innerHTML = response.comments.map(c => `
        <div class="comment-card" id="row-${c.timestamp.replace(/[: ]/g, '')}">
            <div class="comment-info">
                <strong>${c.nama}</strong><br><small>${c.timestamp}</small>
                <p>${c.komentar}</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-approve" onclick="updateStatus('${c.timestamp}', 'approved')">Approve</button>
                <button class="btn btn-delete" onclick="updateStatus('${c.timestamp}', 'deleted')">Hapus</button>
            </div>
        </div>
    `).join('');
}

async function updateStatus(timestamp, status) {
    const rowId = `row-${timestamp.replace(/[: ]/g, '')}`;
    document.getElementById(rowId).style.opacity = '0.5';
    
    const formData = new URLSearchParams();
    formData.append('action', 'updateStatus');
    formData.append('timestamp', timestamp);
    formData.append('status', status);

    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: formData });
    document.getElementById(rowId).remove();
}

loadComments();
