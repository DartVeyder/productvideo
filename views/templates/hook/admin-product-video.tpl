{**
 * Поля Video URL / Upload в адмін-панелі (Back Office)
 * Hook: displayAdminProductsMainStepLeftColumnMiddle
 *}

<div class="form-group" id="product-video-section">
    <h2>{l s='Product Video' mod='productvideo'}</h2>

    {* Hidden-поле з поточним значенням — завжди зберігає URL *}
    <input type="hidden" name="product_video_current" id="product_video_current"
           value="{$video_url|escape:'htmlall':'UTF-8'}" />

    {* --- Поточне відео (якщо є) --- *}
    <div id="product-video-current-info" {if !$video_url}style="display:none;"{/if}>
        <div class="alert alert-info" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <strong>{l s='Поточне відео:' mod='productvideo'}</strong>
            <span id="product-video-current-name">
                {if $is_uploaded_file}
                    <span class="label label-primary" style="font-size:12px;">
                        <i class="icon-file-video-o"></i> {$uploaded_file_name|escape:'htmlall':'UTF-8'}
                    </span>
                {else}
                    <a href="{$video_url|escape:'htmlall':'UTF-8'}" target="_blank" style="word-break:break-all;">
                        {$video_url|truncate:60:'...'|escape:'htmlall':'UTF-8'}
                    </a>
                {/if}
            </span>

            <label style="margin:0; font-weight:normal; cursor:pointer; color:#d9534f;">
                <input type="checkbox" name="product_video_delete" value="1" id="product_video_delete" />
                {l s='Видалити відео' mod='productvideo'}
            </label>
        </div>
    </div>

    {* --- URL поле --- *}
    <label class="form-control-label" for="product_video_url">
        {l s='Video URL (MP4)' mod='productvideo'}
    </label>
    <input
        type="text"
        id="product_video_url"
        name="product_video_url"
        class="form-control"
        value="{if !$is_uploaded_file}{$video_url|escape:'htmlall':'UTF-8'}{/if}"
        placeholder="https://example.com/video.mp4"
    />
    <small class="form-text text-muted" style="margin-bottom:15px; display:block;">
        {l s='Вставте пряме посилання на MP4-файл.' mod='productvideo'}
    </small>

    {* --- Роздільник --- *}
    <div style="text-align:center; margin:10px 0; color:#999; font-size:13px;">
        — {l s='або' mod='productvideo'} —
    </div>

    {* --- Завантаження файлу --- *}
    <label class="form-control-label" for="product_video_file">
        {l s='Завантажити відео-файл' mod='productvideo'}
    </label>
    <div style="display:flex; align-items:center; gap:10px;">
        <input
            type="file"
            id="product_video_file"
            class="form-control"
            accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg"
            style="flex:1;"
        />
        <span id="product-video-upload-status" style="display:none;"></span>
    </div>
    <small class="form-text text-muted">
        {l s='Формати: MP4, WebM, OGG. Рекомендований розмір — до 10 МБ.' mod='productvideo'}
    </small>

    {* --- Прогрес-бар --- *}
    <div id="product-video-progress" style="display:none; margin-top:8px;">
        <div style="background:#eee; border-radius:4px; overflow:hidden; height:6px;">
            <div id="product-video-progress-bar"
                 style="height:100%; background:#25b9d7; width:0%; transition:width 0.3s;"></div>
        </div>
        <small id="product-video-progress-text" style="color:#666;">0%</small>
    </div>
</div>

{* --- AJAX Upload JS --- *}
<script type="text/javascript">
(function() {
    var uploadUrl = '{$upload_url nofilter}';
    var fileInput = document.getElementById('product_video_file');
    var statusEl  = document.getElementById('product-video-upload-status');
    var progressWrap = document.getElementById('product-video-progress');
    var progressBar  = document.getElementById('product-video-progress-bar');
    var progressText = document.getElementById('product-video-progress-text');
    var currentInput = document.getElementById('product_video_current');
    var currentInfo  = document.getElementById('product-video-current-info');
    var currentName  = document.getElementById('product-video-current-name');

    if (!fileInput) return;

    fileInput.addEventListener('change', function() {
        if (!this.files || !this.files.length) return;

        var file = this.files[0];
        var formData = new FormData();
        formData.append('video_file', file);
        formData.append('ajax', '1');
        formData.append('action', 'upload');

        // Визначаємо id_product
        var idProduct = 0;
        var urlMatch = window.location.href.match(/id_product[=\/](\d+)/i);
        if (urlMatch) {
            idProduct = urlMatch[1];
        }
        formData.append('id_product', idProduct);

        // Показуємо прогрес
        progressWrap.style.display = 'block';
        statusEl.style.display = 'inline';
        statusEl.innerHTML = '<span style="color:#f0ad4e;">⏳ Завантаження...</span>';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        var xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                var pct = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = pct + '%';
                progressText.textContent = pct + '%';
            }
        });

        xhr.addEventListener('load', function() {
            try {
                var resp = JSON.parse(xhr.responseText);
                if (resp.success) {
                    // Зберігаємо шлях у hidden-полі
                    currentInput.value = resp.path;

                    // Оновлюємо UI
                    statusEl.innerHTML = '<span style="color:#72c279;">✓ ' + resp.filename + '</span>';
                    currentInfo.style.display = 'block';
                    currentName.innerHTML = '<span class="label label-success" style="font-size:12px;"><i class="icon-file-video-o"></i> ' + resp.filename + '</span>';

                    // Очищаємо URL-поле
                    document.getElementById('product_video_url').value = '';
                } else {
                    statusEl.innerHTML = '<span style="color:#d9534f;">✗ ' + resp.message + '</span>';
                }
            } catch(e) {
                statusEl.innerHTML = '<span style="color:#d9534f;">✗ Помилка відповіді сервера</span>';
            }

            setTimeout(function() { progressWrap.style.display = 'none'; }, 1500);
        });

        xhr.addEventListener('error', function() {
            statusEl.innerHTML = '<span style="color:#d9534f;">✗ Помилка мережі</span>';
            progressWrap.style.display = 'none';
        });

        xhr.open('POST', uploadUrl, true);
        xhr.send(formData);
    });
})();
</script>
