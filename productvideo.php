<?php
/**
 * Product Video Module
 *
 * Додає можливість прикріплювати MP4 відео до товарів
 * та відображати їх у каталозі й на сторінці товару.
 * Підтримує як URL, так і завантаження файлу.
 *
 * @author Custom
 * @version 1.1.0
 * @license MIT
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class ProductVideo extends Module
{
    /** Ключі конфігурації */
    const CONF_AUTOPLAY       = 'PRODUCTVIDEO_AUTOPLAY';
    const CONF_ASPECT_WIDTH   = 'PRODUCTVIDEO_ASPECT_W';
    const CONF_ASPECT_HEIGHT  = 'PRODUCTVIDEO_ASPECT_H';
    const CONF_MAX_WIDTH      = 'PRODUCTVIDEO_MAX_WIDTH';
    const CONF_MAX_HEIGHT     = 'PRODUCTVIDEO_MAX_HEIGHT';

    /** Директорія для завантажених відео */
    const UPLOAD_DIR = 'uploads';

    public function __construct()
    {
        $this->name = 'productvideo';
        $this->tab = 'front_office_features';
        $this->version = '1.1.0';
        $this->author = 'Custom';
        $this->need_instance = 0;
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('Product Video');
        $this->description = $this->l('Додає можливість прикріплювати MP4 відео до товарів та відображати їх у каталозі й на сторінці товару.');
        $this->ps_versions_compliancy = array('min' => '1.7.0.0', 'max' => _PS_VERSION_);
    }

    /* ===========================
     *  INSTALL / UNINSTALL
     * =========================== */

    public function install()
    {
        // Створюємо директорію для завантажень
        $uploadPath = $this->getUploadPath();
        if (!is_dir($uploadPath)) {
            mkdir($uploadPath, 0755, true);
        }

        // Захист від прямого перегляду через .htaccess (опціонально)
        $indexFile = $uploadPath . '/index.php';
        if (!file_exists($indexFile)) {
            file_put_contents($indexFile, "<?php\nheader('Expires: Mon, 26 Jul 1997 05:00:00 GMT');\nheader('Last-Modified: '.gmdate('D, d M Y H:i:s').' GMT');\n\nheader('Cache-Control: no-store, no-cache, must-revalidate');\nheader('Cache-Control: post-check=0, pre-check=0', false);\nheader('Pragma: no-cache');\n\nheader('Location: ../../../');\nexit;\n");
        }

        // Реєструємо адмін-контролер для AJAX завантаження
        $this->installTab();

        return parent::install()
            && $this->executeSqlFile('install')
            && $this->registerHook('displayAdminProductsMainStepLeftColumnMiddle')
            && $this->registerHook('actionProductUpdate')
            && $this->registerHook('displayHeader')
            && $this->registerHook('actionFrontControllerSetMedia')
            && Configuration::updateValue(self::CONF_AUTOPLAY, 1)
            && Configuration::updateValue(self::CONF_ASPECT_WIDTH, 0)
            && Configuration::updateValue(self::CONF_ASPECT_HEIGHT, 0)
            && Configuration::updateValue(self::CONF_MAX_WIDTH, 0)
            && Configuration::updateValue(self::CONF_MAX_HEIGHT, 0);
    }

    public function uninstall()
    {
        $this->uninstallTab();

        return $this->executeSqlFile('uninstall')
            && Configuration::deleteByName(self::CONF_AUTOPLAY)
            && Configuration::deleteByName(self::CONF_ASPECT_WIDTH)
            && Configuration::deleteByName(self::CONF_ASPECT_HEIGHT)
            && Configuration::deleteByName(self::CONF_MAX_WIDTH)
            && Configuration::deleteByName(self::CONF_MAX_HEIGHT)
            && parent::uninstall();
    }

    /**
     * Шлях до директорії завантажень
     */
    private function getUploadPath()
    {
        return dirname(__FILE__) . '/' . self::UPLOAD_DIR;
    }

    /**
     * Публічний URL до директорії завантажень
     */
    private function getUploadUrl()
    {
        return $this->_path . self::UPLOAD_DIR . '/';
    }

    /**
     * Реєструє прихований admin-контролер для AJAX-завантаження
     */
    private function installTab()
    {
        $tabId = (int) Tab::getIdFromClassName('AdminProductVideoUpload');
        if ($tabId) {
            return true; // вже існує
        }

        $tab = new Tab();
        $tab->class_name = 'AdminProductVideoUpload';
        $tab->module = $this->name;
        $tab->id_parent = -1; // прихований (не в меню)
        $tab->active = 1;
        foreach (Language::getLanguages(false) as $lang) {
            $tab->name[$lang['id_lang']] = 'Product Video Upload';
        }
        return $tab->add();
    }

    /**
     * Видаляє admin-контролер
     */
    private function uninstallTab()
    {
        $tabId = (int) Tab::getIdFromClassName('AdminProductVideoUpload');
        if ($tabId) {
            $tab = new Tab($tabId);
            return $tab->delete();
        }
        return true;
    }

    /**
     * Виконує SQL-файл з директорії sql/
     */
    private function executeSqlFile($filename)
    {
        $filePath = dirname(__FILE__) . '/sql/' . $filename . '.sql';

        if (!file_exists($filePath)) {
            return false;
        }

        $sql = file_get_contents($filePath);
        $sql = str_replace('PREFIX_', _DB_PREFIX_, $sql);
        $sql = str_replace('ENGINE_TYPE', _MYSQL_ENGINE_, $sql);

        $queries = preg_split('/;\s*[\r\n]+/', $sql);

        foreach ($queries as $query) {
            $query = trim($query);
            if (!empty($query)) {
                if (!Db::getInstance()->execute($query)) {
                    return false;
                }
            }
        }

        return true;
    }

    /* ===========================
     *  CONFIGURATION PAGE
     * =========================== */

    public function getContent()
    {
        $output = '';

        if (Tools::isSubmit('submitProductVideoSettings')) {
            Configuration::updateValue(self::CONF_AUTOPLAY, (int) Tools::getValue(self::CONF_AUTOPLAY));
            Configuration::updateValue(self::CONF_ASPECT_WIDTH, (int) Tools::getValue(self::CONF_ASPECT_WIDTH));
            Configuration::updateValue(self::CONF_ASPECT_HEIGHT, (int) Tools::getValue(self::CONF_ASPECT_HEIGHT));
            Configuration::updateValue(self::CONF_MAX_WIDTH, (int) Tools::getValue(self::CONF_MAX_WIDTH));
            Configuration::updateValue(self::CONF_MAX_HEIGHT, (int) Tools::getValue(self::CONF_MAX_HEIGHT));

            $output .= $this->displayConfirmation($this->l('Налаштування збережено.'));
        }

        if (Tools::isSubmit('submitProductVideo')) {
            $id_product = (int) Tools::getValue('id_product');
            $video_url = trim(Tools::getValue('video_url'));

            if (!$id_product || !Product::existsInDatabase($id_product, 'product')) {
                $output .= $this->displayError($this->l('Невірний ID товару або товар не існує.'));
            } else {
                $exists = Db::getInstance()->getValue('SELECT id_product FROM `' . _DB_PREFIX_ . 'product_video` WHERE id_product = ' . $id_product);
                if ($exists) {
                    if (empty($video_url)) {
                        Db::getInstance()->delete('product_video', 'id_product = ' . $id_product);
                    } else {
                        Db::getInstance()->update('product_video', array('video_url' => pSQL($video_url)), 'id_product = ' . $id_product);
                    }
                } else {
                    if (!empty($video_url)) {
                        Db::getInstance()->insert('product_video', array('id_product' => $id_product, 'video_url' => pSQL($video_url)));
                    }
                }
                $output .= $this->displayConfirmation($this->l('Відео товару збережено.'));
            }
        }

        if (Tools::isSubmit('deleteproduct_video')) {
            $id_product = (int) Tools::getValue('id_product');
            if ($id_product) {
                Db::getInstance()->delete('product_video', 'id_product = ' . $id_product);
                $output .= $this->displayConfirmation($this->l('Відео товару успішно видалено.'));
            }
        }

        if (Tools::isSubmit('updateproduct_video') || Tools::isSubmit('addproduct_video')) {
            return $output . $this->renderVideoForm();
        }

        return $output . $this->renderConfigForm() . $this->renderVideoList();
    }

    /**
     * Генерує форму налаштувань через HelperForm
     */
    private function renderConfigForm()
    {
        $fields_form = array(
            'form' => array(
                'legend' => array(
                    'title' => $this->l('Налаштування Product Video'),
                    'icon'  => 'icon-cogs',
                ),
                'input' => array(
                    array(
                        'type'    => 'switch',
                        'label'   => $this->l('Автовідтворення'),
                        'name'    => self::CONF_AUTOPLAY,
                        'desc'    => $this->l('Увімкнути — відео програється автоматично. Вимкнути — відео програється тільки при наведенні курсору (hover).'),
                        'is_bool' => true,
                        'values'  => array(
                            array('id' => 'autoplay_on',  'value' => 1, 'label' => $this->l('Так')),
                            array('id' => 'autoplay_off', 'value' => 0, 'label' => $this->l('Ні')),
                        ),
                    ),
                    array(
                        'type'  => 'text',
                        'label' => $this->l('Пропорція — ширина'),
                        'name'  => self::CONF_ASPECT_WIDTH,
                        'desc'  => $this->l('Ширина пропорції відео (3 для 3:4, 16 для 16:9, 1 для 1:1). 0 = авто — адаптується до розміру контейнера.'),
                        'class' => 'fixed-width-sm',
                    ),
                    array(
                        'type'  => 'text',
                        'label' => $this->l('Пропорція — висота'),
                        'name'  => self::CONF_ASPECT_HEIGHT,
                        'desc'  => $this->l('Висота пропорції відео (4 для 3:4, 9 для 16:9, 1 для 1:1). 0 = авто — адаптується до розміру контейнера.'),
                        'class' => 'fixed-width-sm',
                    ),
                    array(
                        'type'  => 'text',
                        'label' => $this->l('Макс. ширина (px)'),
                        'name'  => self::CONF_MAX_WIDTH,
                        'desc'  => $this->l('Максимальна ширина відео-контейнера в пікселях. 0 = без обмеження.'),
                        'class' => 'fixed-width-sm',
                    ),
                    array(
                        'type'  => 'text',
                        'label' => $this->l('Макс. висота (px)'),
                        'name'  => self::CONF_MAX_HEIGHT,
                        'desc'  => $this->l('Максимальна висота відео-контейнера в пікселях. 0 = без обмеження.'),
                        'class' => 'fixed-width-sm',
                    ),
                ),
                'submit' => array(
                    'title' => $this->l('Зберегти'),
                ),
            ),
        );

        $helper = new HelperForm();
        $helper->module = $this;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action = 'submitProductVideoSettings';
        $helper->default_form_language = (int) Configuration::get('PS_LANG_DEFAULT');
        $helper->allow_employee_form_lang = true;

        $helper->fields_value = array(
            self::CONF_AUTOPLAY      => Configuration::get(self::CONF_AUTOPLAY),
            self::CONF_ASPECT_WIDTH  => Configuration::get(self::CONF_ASPECT_WIDTH),
            self::CONF_ASPECT_HEIGHT => Configuration::get(self::CONF_ASPECT_HEIGHT),
            self::CONF_MAX_WIDTH     => Configuration::get(self::CONF_MAX_WIDTH),
            self::CONF_MAX_HEIGHT    => Configuration::get(self::CONF_MAX_HEIGHT),
        );

        return $helper->generateForm(array($fields_form));
    }

    /**
     * Повертає масив поточних налаштувань для передачі у фронтенд
     */
    private function getSettings()
    {
        $aspectW = (int) Configuration::get(self::CONF_ASPECT_WIDTH);
        $aspectH = (int) Configuration::get(self::CONF_ASPECT_HEIGHT);

        return array(
            'autoplay'    => (int) Configuration::get(self::CONF_AUTOPLAY),
            'aspectRatio' => ($aspectW > 0 && $aspectH > 0) ? $aspectW . ' / ' . $aspectH : '',
            'maxWidth'    => (int) Configuration::get(self::CONF_MAX_WIDTH),
            'maxHeight'   => (int) Configuration::get(self::CONF_MAX_HEIGHT),
        );
    }

    /* ===========================
     *  ADMIN HOOKS
     * =========================== */

    /**
     * Відображає поля Video URL / Upload у формі редагування товару (BO)
     */
    public function hookDisplayAdminProductsMainStepLeftColumnMiddle($params)
    {
        $idProduct = (int) $params['id_product'];
        $videoUrl = $this->getVideoUrl($idProduct);

        // Визначаємо, чи це завантажений файл
        $isUploadedFile = false;
        $uploadedFileName = '';

        if (!empty($videoUrl) && strpos($videoUrl, 'modules/' . $this->name . '/' . self::UPLOAD_DIR . '/') !== false) {
            $isUploadedFile = true;
            $uploadedFileName = basename($videoUrl);
        }

        // Створюємо повний URL для попереднього перегляду
        $fullVideoUrl = $videoUrl;
        if (!empty($fullVideoUrl) && strpos($fullVideoUrl, 'http') !== 0) {
            $fullVideoUrl = $this->context->link->getBaseLink() . $fullVideoUrl;
        }

        // URL для AJAX-завантаження
        $uploadUrl = $this->context->link->getAdminLink('AdminProductVideoUpload');

        $this->context->smarty->assign(array(
            'video_url'          => $videoUrl,
            'full_video_url'     => $fullVideoUrl,
            'id_product'         => $idProduct,
            'is_uploaded_file'   => $isUploadedFile,
            'uploaded_file_name' => $uploadedFileName,
            'module_name'        => $this->name,
            'upload_url'         => $uploadUrl,
        ));

        return $this->display(__FILE__, 'views/templates/hook/admin-product-video.tpl');
    }

    /**
     * Зберігає Video URL / завантажений файл при збереженні товару
     */
    public function hookActionProductUpdate($params)
    {
        $idProduct = (int) $params['id_product'];
        $deleteVideo = (int) Tools::getValue('product_video_delete', 0);

        // --- Видалення відео ---
        if ($deleteVideo) {
            $this->deleteUploadedVideo($idProduct);
            Db::getInstance()->delete('product_video', 'id_product = ' . $idProduct);
            return;
        }

        // Беремо лише значення з hidden-поля (заповнюється AJAX-завантаженням)
        $videoUrl = trim(Tools::getValue('product_video_current', ''));

        // --- Збереження в БД ---
        if (empty($videoUrl)) {
            // Нічого не задано — не чіпаємо
            return;
        }

        $exists = Db::getInstance()->getValue(
            'SELECT id_product FROM `' . _DB_PREFIX_ . 'product_video` WHERE id_product = ' . $idProduct
        );

        if ($exists) {
            Db::getInstance()->update('product_video', array(
                'video_url' => pSQL($videoUrl),
            ), 'id_product = ' . $idProduct);
        } else {
            Db::getInstance()->insert('product_video', array(
                'id_product' => $idProduct,
                'video_url' => pSQL($videoUrl),
            ));
        }
    }

    /**
     * Видаляє завантажений файл відео з диску
     */
    private function deleteUploadedVideo($idProduct)
    {
        $currentUrl = $this->getVideoUrl($idProduct);

        if (!empty($currentUrl) && strpos($currentUrl, 'modules/' . $this->name . '/' . self::UPLOAD_DIR . '/') !== false) {
            $filePath = _PS_ROOT_DIR_ . '/' . $currentUrl;
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
    }

    /* ===========================
     *  FRONT-END HOOKS
     * =========================== */

    /**
     * Підключає CSS/JS на фронті
     */
    public function hookActionFrontControllerSetMedia()
    {
        $this->context->controller->registerStylesheet(
            'module-productvideo-css',
            'modules/' . $this->name . '/views/css/productvideo.css',
            array('media' => 'all', 'priority' => 200)
        );

        $this->context->controller->registerJavascript(
            'module-productvideo-js',
            'modules/' . $this->name . '/views/js/productvideo.js',
            array('position' => 'bottom', 'priority' => 200)
        );
    }

    /**
     * displayHeader — передає дані про відео та налаштування у Smarty
     */
    public function hookDisplayHeader()
    {
        $controllerName = Tools::getValue('controller');
        $settings = $this->getSettings();

        // Сторінка каталогу / категорії
        if (in_array($controllerName, array('category', 'search', 'bestsales', 'newproducts', 'pricesdrop', 'manufacturer', 'supplier'))) {
            $videos = $this->getAllVideos();
            $this->context->smarty->assign(array(
                'product_videos_json'    => json_encode($videos),
                'product_video_settings' => json_encode($settings),
            ));

            return $this->display(__FILE__, 'views/templates/hook/product-video-vars.tpl');
        }

        // Сторінка товару
        if ($controllerName === 'product') {
            $idProduct = (int) Tools::getValue('id_product');
            $videoUrl = $this->getVideoUrl($idProduct);

            if (!empty($videoUrl)) {
                // Якщо це відносний шлях (завантажений файл) — формуємо повний URL
                if (strpos($videoUrl, 'http') !== 0) {
                    $videoUrl = $this->context->link->getBaseLink() . $videoUrl;
                }

                $this->context->smarty->assign(array(
                    'product_video_url'      => $videoUrl,
                    'product_video_id'       => $idProduct,
                    'product_video_settings' => json_encode($settings),
                ));

                return $this->display(__FILE__, 'views/templates/hook/product-page-video.tpl');
            }
        }

        return '';
    }

    /* ===========================
     *  HELPERS
     * =========================== */

    /**
     * Отримує video_url для конкретного товару
     */
    private function getVideoUrl($idProduct)
    {
        return Db::getInstance()->getValue(
            'SELECT video_url FROM `' . _DB_PREFIX_ . 'product_video` WHERE id_product = ' . (int) $idProduct
        );
    }

    /**
     * Отримує всі video_url у вигляді масиву [id_product => video_url]
     * Для відносних шляхів автоматично додає базовий URL
     */
    private function getAllVideos()
    {
        $rows = Db::getInstance()->executeS(
            'SELECT id_product, video_url FROM `' . _DB_PREFIX_ . 'product_video` WHERE video_url != ""'
        );

        $baseUrl = $this->context->link->getBaseLink();
        $result = array();

        if (is_array($rows)) {
            foreach ($rows as $row) {
                $url = $row['video_url'];

                // Якщо відносний шлях — додаємо базовий URL
                if (strpos($url, 'http') !== 0) {
                    $url = $baseUrl . $url;
                }

                $result[$row['id_product']] = $url;
            }
        }

        return $result;
    }

    private function renderVideoList()
    {
        $fields_list = array(
            'id_product' => array(
                'title' => $this->l('ID Товару'),
                'type' => 'text',
                'search' => false,
            ),
            'name' => array(
                'title' => $this->l('Назва Товару'),
                'type' => 'text',
                'search' => false,
            ),
            'video_url' => array(
                'title' => $this->l('Відео URL'),
                'type' => 'text',
                'search' => false,
            ),
        );

        $helper = new HelperList();
        $helper->shopLinkType = '';
        $helper->simple_header = false;
        $helper->identifier = 'id_product';
        $helper->actions = array('edit', 'delete');
        $helper->show_toolbar = true;
        
        $helper->title = $this->l('Товари з відео');
        $helper->table = 'product_video';
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        
        $helper->toolbar_btn['new'] = array(
            'href' => $helper->currentIndex . '&addproduct_video&token=' . $helper->token,
            'desc' => $this->l('Додати нове відео')
        );

        $sql = 'SELECT pv.id_product, pl.name, pv.video_url '
             . 'FROM `' . _DB_PREFIX_ . 'product_video` pv '
             . 'LEFT JOIN `' . _DB_PREFIX_ . 'product_lang` pl '
             . 'ON (pv.id_product = pl.id_product AND pl.id_lang = ' . (int)$this->context->language->id . ' AND pl.id_shop = ' . (int)$this->context->shop->id . ') '
             . 'ORDER BY pv.id_product DESC';
             
        $list = Db::getInstance()->executeS($sql);

        if (!$list) {
            $list = array();
        }

        return $helper->generateList($list, $fields_list);
    }

    private function renderVideoForm()
    {
        $id_product = (int) Tools::getValue('id_product', 0);
        $video_url = '';
        
        if ($id_product) {
            $video_url = Db::getInstance()->getValue('SELECT video_url FROM `' . _DB_PREFIX_ . 'product_video` WHERE id_product = ' . $id_product);
        }

        $fields_form = array(
            'form' => array(
                'legend' => array(
                    'title' => $id_product ? $this->l('Редагувати відео товару') : $this->l('Додати відео товару'),
                    'icon'  => 'icon-video-camera',
                ),
                'input' => array(
                    array(
                        'type'  => 'text',
                        'label' => $this->l('ID Товару'),
                        'name'  => 'id_product',
                        'required' => true,
                        'desc'  => $this->l('Введіть ID товару, до якого хочете прив\'язати відео.'),
                    ),
                    array(
                        'type'  => 'text',
                        'label' => $this->l('Відео URL або Файл'),
                        'name'  => 'video_url',
                        'desc'  => $this->l('URL на відео Youtube/Vimeo/mp4 або відносний шлях до завантаженого файлу (наприклад: modules/productvideo/uploads/video.mp4).'),
                        'required' => true,
                    ),
                ),
                'submit' => array(
                    'title' => $this->l('Зберегти'),
                ),
                'buttons' => array(
                    array(
                        'href' => AdminController::$currentIndex . '&configure=' . $this->name . '&token=' . Tools::getAdminTokenLite('AdminModules'),
                        'title' => $this->l('Назад до списку'),
                        'icon' => 'process-icon-back'
                    )
                )
            ),
        );

        $helper = new HelperForm();
        $helper->module = $this;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action = 'submitProductVideo';
        $helper->default_form_language = (int) Configuration::get('PS_LANG_DEFAULT');
        $helper->allow_employee_form_lang = true;

        $helper->fields_value = array(
            'id_product' => $id_product ? $id_product : '',
            'video_url'  => $video_url,
        );
        
        if ($id_product) {
             $fields_form['form']['input'][0]['readonly'] = true;
        }

        return $helper->generateForm(array($fields_form));
    }
}
