{**
 * Відео на сторінці товару — інжектується через displayHeader
 * Дані: $product_video_url, $product_video_id, $product_video_settings
 *}

<script type="text/javascript">
    var productPageVideo = {
        idProduct: {$product_video_id|intval},
        videoUrl: "{$product_video_url|escape:'javascript':'UTF-8'}"
    };
    var productVideoSettings = {$product_video_settings nofilter};
</script>
