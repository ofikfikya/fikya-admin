const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2AQEhvZTYJjnoTkk1JhHhMdfLinKonWYN0JAyXWnswP0QExe-RdiFZXGr1g87Tx1DuQ/exec';
const ADMIN_KEY = '280526';

async function loadComments() {

    const list = document.getElementById('comment-list');

    list.innerHTML = '<p>Memuat data...</p>';

    const old = document.getElementById('jsonp-loader');

    if (old) old.remove();

    const script = document.createElement('script');

    script.id='jsonp-loader';

    script.src =
        `${SCRIPT_URL}?action=getComments`+
        `&mode=pending`+
        `&adminKey=${ADMIN_KEY}`+
        `&callback=renderComments`+
        `&_=${Date.now()}`;

    script.onerror=()=>{
        list.innerHTML =
            '<p>Gagal memuat komentar.</p>';
    };

    document.body.appendChild(script);
}

function renderComments(response){

    const list =
        document.getElementById(
            'comment-list'
        );

    if(
        response.status!=='ok' ||
        !response.comments ||
        response.comments.length===0
    ){
        list.innerHTML =
            '<p>Tidak ada komentar pending.</p>';
        return;
    }

    list.innerHTML =
        response.comments.map(c=>`

        <div
            class="comment-card"
            id="row-${c.rowIndex}"
        >

            <div class="comment-info">

                <strong>${c.nama}</strong>

                <small>${c.postId}</small>

                <p>${c.komentar}</p>

            </div>

            <div class="btn-group">

                <button
                    class="btn btn-approve"
                    onclick="updateStatus(${c.rowIndex},'approved')"
                >
                    Approve
                </button>

                <button
                    class="btn btn-delete"
                    onclick="updateStatus(${c.rowIndex},'deleted')"
                >
                    Hapus
                </button>

            </div>

        </div>

    `).join('');
}

async function updateStatus(
    rowIndex,
    status
){

    const formData =
        new URLSearchParams();

    formData.append(
        'action',
        'updateStatus'
    );

    formData.append(
        'rowIndex',
        rowIndex
    );

    formData.append(
        'status',
        status
    );

    formData.append(
        'adminKey',
        ADMIN_KEY
    );

    await fetch(
        SCRIPT_URL,
        {
            method:'POST',
            mode:'no-cors',
            body:formData
        }
    );

    setTimeout(
        loadComments,
        1000
    );
}

loadComments();
