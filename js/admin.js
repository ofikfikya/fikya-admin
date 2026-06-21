const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2AQEhvZTYJjnoTkk1JhHhMdfLinKonWYN0JAyXWnswP0QExe-RdiFZXGr1g87Tx1DuQ/exec'; // Ganti dengan URL Anda
const ADMIN_KEY  = '280526'; // Ganti dengan password pilihan Anda

async function loadComments() {
    const list = document.getElementById('comment-list');
    list.innerHTML = '<p>Memuat data...</p>';

    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}?action=getComments&mode=pending&adminKey=${ADMIN_KEY}&callback=renderComments`;
    script.onerror = () => {
        list.innerHTML = '<p>Gagal memuat komentar. Periksa koneksi atau SCRIPT_URL.</p>';
    };
    document.body.appendChild(script);
}

function renderComments(response) {
    const list = document.getElementById('comment-list');

    if (response.status !== 'ok' || response.comments.length === 0) {
        list.innerHTML = '<p>Tidak ada komentar pending.</p>';
        return;
    }

    list.innerHTML = response.comments.map(c => `
        <div class="comment-card" id="row-${c.rowIndex}">
            <div class="comment-info">
                <strong>${c.nama}</strong>
                <small>${c.postId}</small>
                <p>${c.komentar}</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-approve" onclick="updateStatus(${c.rowIndex}, 'approved')">Approve</button>
                <button class="btn btn-delete"  onclick="updateStatus(${c.rowIndex}, 'deleted')">Hapus</button>
            </div>
        </div>
    `).join('');
}

async function updateStatus(rowIndex, status) {
    const card = document.getElementById(`row-${rowIndex}`);
    if (!card) return;

    // Tandai sedang diproses — jangan hapus dulu sebelum fetch selesai
    card.style.opacity       = '0.5';
    card.style.pointerEvents = 'none';

    const formData = new URLSearchParams();
    formData.append('action',   'updateStatus');
    formData.append('rowIndex', rowIndex);
    formData.append('status',   status);
    formData.append('adminKey', ADMIN_KEY);

    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: formData });
    } catch (err) {
        // Jika fetch gagal total (misal offline), kembalikan tampilan normal
        card.style.opacity       = '1';
        card.style.pointerEvents = 'auto';
        alert('Gagal menghubungi server. Coba lagi.');
        return;
    }

    // Hapus dari DOM hanya setelah fetch selesai tanpa error jaringan
    card.remove();
}

loadComments();
