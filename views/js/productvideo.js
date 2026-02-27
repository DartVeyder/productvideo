/**
 * Product Video Module — Front-end JS
 * productvideo v1.0.0
 *
 * 1. Каталог (category / search / etc.) — заміна cover-зображень на <video>
 *    з hover-play або autoplay та IntersectionObserver lazy-load.
 * 2. Сторінка товару — додавання відео як першого слайду.
 *
 * Налаштування передаються через глобальну змінну productVideoSettings:
 *   - autoplay:    1 = autoplay, 0 = hover-only
 *   - aspectRatio: CSS aspect-ratio (напр. "3 / 4")
 *   - maxWidth:    max-width у px (0 = без ліміту)
 *   - maxHeight:   max-height у px (0 = без ліміту)
 */

(function () {
    'use strict';

    /* ===================================
     *  Налаштування (з fallback)
     * =================================== */

    function getSettings() {
        var defaults = {
            autoplay: 1,
            aspectRatio: '',
            maxWidth: 0,
            maxHeight: 0
        };

        if (typeof productVideoSettings !== 'undefined' && productVideoSettings) {
            return {
                autoplay: productVideoSettings.autoplay !== undefined ? parseInt(productVideoSettings.autoplay, 10) : defaults.autoplay,
                aspectRatio: productVideoSettings.aspectRatio || '',
                maxWidth: productVideoSettings.maxWidth !== undefined ? parseInt(productVideoSettings.maxWidth, 10) : defaults.maxWidth,
                maxHeight: productVideoSettings.maxHeight !== undefined ? parseInt(productVideoSettings.maxHeight, 10) : defaults.maxHeight
            };
        }

        return defaults;
    }

    /**
     * Застосовує розмірні налаштування до відео-обгортки
     */
    function applyDimensionStyles(wrapper, settings) {
        if (settings.aspectRatio) {
            wrapper.style.aspectRatio = settings.aspectRatio;
        }

        if (settings.maxWidth > 0) {
            wrapper.style.maxWidth = settings.maxWidth + 'px';
        }
        if (settings.maxHeight > 0) {
            wrapper.style.maxHeight = settings.maxHeight + 'px';
        }
    }

    /* ===================================
     *  Утиліти
     * =================================== */

    /**
     * Створює <video> елемент із потрібними атрибутами
     */
    function createVideoElement(src, poster) {
        var video = document.createElement('video');
        video.className = 'product-video';
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('preload', 'none'); // lazy — src буде встановлено IO
        video.muted = true; // programmatic muted (Safari)

        if (poster) {
            video.setAttribute('poster', poster);
        }

        // data-src для lazy-load
        video.setAttribute('data-src', src);

        return video;
    }

    /* ===================================
     *  1. КАТАЛОГ — product miniatures
     * =================================== */

    function initCatalogVideos() {
        // Перевіряємо наявність глобальної змінної
        if (typeof productVideos === 'undefined' || !productVideos) {
            return;
        }

        var settings = getSettings();
        var isAutoplay = settings.autoplay === 1;

        var miniatures = document.querySelectorAll('.js-product-miniature, .product-miniature');

        miniatures.forEach(function (card) {
            var productId = card.getAttribute('data-id-product');

            if (!productId || !productVideos[productId]) {
                return;
            }

            var videoUrl = productVideos[productId];

            // Знаходимо контейнер зображення
            var imgContainer = card.querySelector('.thumbnail-container .product-thumbnail, .thumbnail-container a img, .thumbnail-container img');

            if (!imgContainer) {
                return;
            }

            // Зберігаємо poster з поточного зображення
            var posterUrl = '';
            if (imgContainer.tagName === 'IMG') {
                posterUrl = imgContainer.src;
            } else {
                var img = imgContainer.querySelector('img');
                if (img) {
                    posterUrl = img.src;
                }
            }

            // Створюємо обгортку
            var wrapper = document.createElement('div');
            wrapper.className = 'product-video-wrapper' + (isAutoplay ? '' : ' is-paused');

            var video = createVideoElement(videoUrl, posterUrl);

            // Іконка плей (тільки для hover-mode)
            if (!isAutoplay) {
                var playIcon = document.createElement('div');
                playIcon.className = 'product-video-play-icon';
                wrapper.appendChild(playIcon);
            }

            wrapper.appendChild(video);

            // Застосовуємо розмірні налаштування
            applyDimensionStyles(wrapper, settings);

            // --- Знаходимо посилання на товар ---
            var parent = imgContainer.parentNode;
            var productLink = '';

            // 1) imgContainer сам є <a>
            if (imgContainer.tagName === 'A') {
                productLink = imgContainer.getAttribute('href');
            }
            // 2) Батько є <a>
            if (!productLink && parent && parent.tagName === 'A') {
                productLink = parent.getAttribute('href');
            }
            // 3) Будь-яке посилання на картці
            if (!productLink) {
                var linkEl = card.querySelector('a[href]');
                if (linkEl) {
                    productLink = linkEl.getAttribute('href');
                }
            }

            // --- Створюємо <a> з відео ---
            var linkWrap = document.createElement('a');
            linkWrap.href = productLink || '#';
            linkWrap.style.display = 'block';
            linkWrap.appendChild(wrapper);

            // --- Вставляємо замість зображення ---
            if (imgContainer.tagName === 'A') {
                // imgContainer сам <a> — замінюємо його
                parent.replaceChild(linkWrap, imgContainer);
            } else if (parent && parent.tagName === 'A') {
                // imgContainer (<img>) всередині <a> — замінюємо вміст батьківського <a>
                var grandParent = parent.parentNode;
                grandParent.replaceChild(linkWrap, parent);
            } else {
                parent.replaceChild(linkWrap, imgContainer);
            }

            // pointer-events: none на відео, щоб кліки йшли на <a>
            video.style.pointerEvents = 'none';

            // Hover-play (тільки якщо autoplay вимкнено)
            if (!isAutoplay) {
                setupHoverPlay(wrapper, video);
            }
        });

        // Lazy-load через IntersectionObserver
        setupLazyLoad(isAutoplay);
    }

    /**
     * Hover-play: старт на mouseenter, пауза на mouseleave
     */
    function setupHoverPlay(wrapper, video) {
        wrapper.addEventListener('mouseenter', function () {
            wrapper.classList.remove('is-paused');
            if (video.src || video.currentSrc) {
                video.play().catch(function () { /* ignore autoplay block */ });
            }
        });

        wrapper.addEventListener('mouseleave', function () {
            wrapper.classList.add('is-paused');
            video.pause();
        });

        // На мобільних — автовідтворення (без hover)
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            wrapper.classList.remove('is-paused');
        }
    }

    /**
     * IntersectionObserver: встановлює src і запускає відео при потраплянні у viewport
     */
    function setupLazyLoad(isAutoplay) {
        var videos = document.querySelectorAll('.product-video[data-src]');

        if (!videos.length) {
            return;
        }

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var video = entry.target;
                        var src = video.getAttribute('data-src');

                        if (src && !video.src) {
                            video.src = src;
                            video.removeAttribute('data-src');
                            video.load();

                            // Autoplay mode або мобільний пристрій
                            if (isAutoplay || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
                                video.setAttribute('autoplay', '');
                                video.play().catch(function () { /* ignore */ });
                            }
                        }

                        observer.unobserve(video);
                    }
                });
            }, {
                rootMargin: '200px 0px',
                threshold: 0.01
            });

            videos.forEach(function (video) {
                observer.observe(video);
            });
        } else {
            // Фоллбек для старих браузерів
            videos.forEach(function (video) {
                video.src = video.getAttribute('data-src');
                video.removeAttribute('data-src');
                video.load();

                if (isAutoplay) {
                    video.setAttribute('autoplay', '');
                    video.play().catch(function () { /* ignore */ });
                }
            });
        }
    }

    /* ===================================
     *  2. СТОРІНКА ТОВАРУ
     * =================================== */

    function initProductPageVideo() {
        if (typeof productPageVideo === 'undefined' || !productPageVideo || !productPageVideo.videoUrl) {
            return;
        }

        var settings = getSettings();
        var videoUrl = productPageVideo.videoUrl;

        // --- Спроба 1: Класична тема / Leo Theme — .images-container .product-cover ---
        var coverContainer = document.querySelector('.images-container .product-cover');

        if (coverContainer) {
            insertVideoInCover(coverContainer, videoUrl, settings);
            return;
        }

        // --- Спроба 2: Swiper-based slider ---
        var swiperWrapper = document.querySelector('.product-images .swiper-wrapper');

        if (swiperWrapper) {
            insertVideoAsFirstSlide(swiperWrapper, videoUrl, settings);
            return;
        }

        // --- Спроба 3: Generic ---
        var productImages = document.querySelector('.product-images, .product-cover-thumbnails, #product-images-large');

        if (productImages) {
            insertVideoBeforeFirst(productImages, videoUrl, settings);
        }
    }

    /**
     * Вставляє відео у .product-cover (classic theme)
     */
    function insertVideoInCover(coverContainer, videoUrl, settings) {
        var coverImg = coverContainer.querySelector('img');
        var posterUrl = coverImg ? coverImg.src : '';

        var wrapper = document.createElement('div');
        wrapper.className = 'product-page-video-wrapper';

        var video = document.createElement('video');
        video.className = 'product-video';
        video.src = videoUrl;
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.muted = true;

        if (settings.autoplay === 1) {
            video.setAttribute('autoplay', '');
        }

        if (posterUrl) {
            video.setAttribute('poster', posterUrl);
        }

        wrapper.appendChild(video);

        // Застосовуємо розмірні налаштування
        applyDimensionStyles(wrapper, settings);

        coverContainer.insertBefore(wrapper, coverContainer.firstChild);

        if (coverImg) {
            coverImg.style.display = 'none';
        }

        // Блокуємо zoom → fullscreen
        wrapper.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();

            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.msRequestFullscreen) {
                video.msRequestFullscreen();
            }
        });

        var zoomLayer = coverContainer.querySelector('.layer, .js-qv-mask, .zoomContainer');
        if (zoomLayer) {
            zoomLayer.style.display = 'none';
        }

        // Запускаємо відео, якщо autoplay вимкнено — за hover
        if (settings.autoplay !== 1) {
            video.pause();
            wrapper.classList.add('is-paused');

            var playIcon = document.createElement('div');
            playIcon.className = 'product-video-play-icon';
            wrapper.appendChild(playIcon);

            wrapper.addEventListener('mouseenter', function () {
                wrapper.classList.remove('is-paused');
                video.play().catch(function () { });
            });
            wrapper.addEventListener('mouseleave', function () {
                wrapper.classList.add('is-paused');
                video.pause();
            });
        }
    }

    /**
     * Вставляє відео як перший слайд у Swiper
     */
    function insertVideoAsFirstSlide(swiperWrapper, videoUrl, settings) {
        var slide = document.createElement('div');
        slide.className = 'swiper-slide product-page-video-wrapper';

        var video = document.createElement('video');
        video.className = 'product-video';
        video.src = videoUrl;
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.muted = true;

        if (settings.autoplay === 1) {
            video.setAttribute('autoplay', '');
        }

        slide.appendChild(video);
        applyDimensionStyles(slide, settings);

        swiperWrapper.insertBefore(slide, swiperWrapper.firstChild);

        var swiperEl = swiperWrapper.closest('.swiper-container, .swiper');
        if (swiperEl && swiperEl.swiper) {
            swiperEl.swiper.update();
            swiperEl.swiper.slideTo(0, 0);
        }
    }

    /**
     * Generic — вставляє відео перед першим елементом
     */
    function insertVideoBeforeFirst(container, videoUrl, settings) {
        var wrapper = document.createElement('div');
        wrapper.className = 'product-page-video-wrapper';

        var video = document.createElement('video');
        video.className = 'product-video';
        video.src = videoUrl;
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.muted = true;

        if (settings.autoplay === 1) {
            video.setAttribute('autoplay', '');
        }

        wrapper.appendChild(video);
        applyDimensionStyles(wrapper, settings);

        container.insertBefore(wrapper, container.firstChild);
    }

    /* ===================================
     *  Ініціалізація
     * =================================== */

    document.addEventListener('DOMContentLoaded', function () {
        initCatalogVideos();
        initProductPageVideo();
    });

})();
