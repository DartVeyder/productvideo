<?php
/**
 * AJAX-контролер для завантаження відео-файлів з адмін-панелі
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once _PS_MODULE_DIR_ . 'productvideo/productvideo.php';

class AdminProductVideoUploadController extends ModuleAdminController
{
    public function __construct()
    {
        parent::__construct();
        $this->ajax = true;
    }

    public function ajaxProcessUpload()
    {
        if (!isset($_FILES['video_file']) || empty($_FILES['video_file']['name'])) {
            die(json_encode(array('success' => false, 'message' => 'No file uploaded')));
        }

        $file = $_FILES['video_file'];
        $allowedExtensions = array('mp4', 'webm', 'ogg');
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors = array(
                UPLOAD_ERR_INI_SIZE   => 'Файл занадто великий (ліміт сервера: ' . ini_get('upload_max_filesize') . ')',
                UPLOAD_ERR_FORM_SIZE  => 'Файл занадто великий (ліміт форми)',
                UPLOAD_ERR_PARTIAL    => 'Файл завантажено лише частково',
                UPLOAD_ERR_NO_FILE    => 'Файл не було завантажено',
                UPLOAD_ERR_NO_TMP_DIR => 'Відсутня тимчасова папка',
                UPLOAD_ERR_CANT_WRITE => 'Помилка запису на диск',
            );
            $msg = isset($errors[$file['error']]) ? $errors[$file['error']] : 'Помилка #' . $file['error'];
            die(json_encode(array('success' => false, 'message' => $msg)));
        }

        if (!in_array($extension, $allowedExtensions)) {
            die(json_encode(array('success' => false, 'message' => 'Невірний формат. Дозволено: MP4, WebM, OGG')));
        }

        $idProduct = (int) Tools::getValue('id_product', 0);
        $newFileName = 'video_' . ($idProduct > 0 ? $idProduct : 'tmp') . '_' . time() . '.' . $extension;

        $uploadDir = _PS_MODULE_DIR_ . 'productvideo/uploads';
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }

        // Створюємо index.php для безпеки
        $indexFile = $uploadDir . '/index.php';
        if (!file_exists($indexFile)) {
            @file_put_contents($indexFile, "<?php\nheader('Location: ../../../');\nexit;\n");
        }

        $destination = $uploadDir . '/' . $newFileName;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            die(json_encode(array('success' => false, 'message' => 'Помилка збереження файлу. Перевірте права доступу.')));
        }

        $relativePath = 'modules/productvideo/uploads/' . $newFileName;
        $fullPath = $this->context->link->getBaseLink() . $relativePath;

        die(json_encode(array(
            'success'   => true,
            'message'   => 'OK',
            'path'      => $relativePath,
            'full_path' => $fullPath,
            'filename'  => $newFileName,
        )));
    }
}
