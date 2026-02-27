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
        var videoAdded = false;

        // --- Спроба 1: Класична тема / Leo Theme — .images-container .product-cover ---
        var coverContainer = document.querySelector('.images-container .product-cover');
        if (coverContainer) {
            insertVideoInCover(coverContainer, videoUrl, settings);
            videoAdded = true;
        }

        // --- Спроба 1.5: Slick Slider (mobile list-images-mobile) ---
        var slickSlider = document.querySelector('.list-images-mobile');
        if (slickSlider) {
            insertVideoInSlick(slickSlider, videoUrl, settings);
            videoAdded = true;
        }

        // --- Спроба 2: Swiper-based slider ---
        var swiperWrapper = document.querySelector('.product-images .swiper-wrapper');
        if (swiperWrapper) {
            insertVideoAsFirstSlide(swiperWrapper, videoUrl, settings);
            videoAdded = true;
        }

        // --- Спроба 3: Generic ---
        if (!videoAdded) {
            var productImages = document.querySelector('.product-images, .product-cover-thumbnails, #product-images-large, .images-container');
            if (productImages) {
                insertVideoBeforeFirst(productImages, videoUrl, settings);
            }
        }
    }

    /**
     * Вставляє відео як перший слайд у Slick Slider
     */
    function insertVideoInSlick(sliderEl, videoUrl, settings) {
        var slide = document.createElement('div');

        var wrapper = document.createElement('div');
        wrapper.className = 'product-page-video-wrapper text-center';
        wrapper.style.position = 'relative';

        var video = document.createElement('video');
        video.className = 'product-video';
        video.src = videoUrl;
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.muted = true;
        video.style.maxWidth = '100%';

        if (settings.autoplay === 1) {
            video.setAttribute('autoplay', '');
        }

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

            wrapper.addEventListener('click', function (e) {
                if (video.paused) {
                    wrapper.classList.remove('is-paused');
                    video.play().catch(function () { });
                } else {
                    wrapper.classList.add('is-paused');
                    video.pause();
                }
            });
        }

        wrapper.appendChild(video);
        applyDimensionStyles(wrapper, settings);

        slide.appendChild(wrapper);

        if (window.jQuery && window.jQuery(sliderEl).hasClass('slick-initialized')) {
            // Щоб уникнути дубльованого відео в самому слайдері
            var existingSlides = window.jQuery(sliderEl).find('.product-page-video-wrapper');
            if (existingSlides.length > 0) return;

            var slideHtml = '<div>' + wrapper.outerHTML + '</div>';
            window.jQuery(sliderEl).slick('slickAdd', slideHtml, 0, true);
            window.jQuery(sliderEl).slick('slickGoTo', 0, true);
        } else {
            var track = sliderEl.querySelector('.slick-track');
            if (track) {
                track.insertBefore(slide, track.firstChild);
            } else {
                sliderEl.insertBefore(slide, sliderEl.firstChild);
            }
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

        // --- Додаємо мініатюру відео ---
        var thumbGallery = document.querySelector('#thumb-gallery');
        if (!thumbGallery) {
            thumbGallery = document.querySelector('.product-images');
        }

        if (thumbGallery) {
            var isSlick = window.jQuery && window.jQuery(thumbGallery).hasClass('slick-initialized');

            if (!thumbGallery.querySelector('.product-video-thumbnail-container')) {
                var thumbInnerHtml = '<a href="javascript:void(0)" style="display:block; position:relative; overflow:hidden;">' +
                    '<video class="thumb product-video-thumb" src="' + videoUrl + '#t=0.1" preload="metadata" muted playsinline style="width:100%; height:auto; object-fit:cover; pointer-events:none;"></video>' +
                    '<div class="product-video-thumb-play" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:30px; height:30px; background:rgba(0,0,0,0.6); border-radius:50%; display:flex; align-items:center; justify-content:center; pointer-events:none;">' +
                    '<div style="width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 8px solid white; margin-left: 3px;"></div>' +
                    '</div></a>';

                if (isSlick) {
                    var slideHtml = '<div class="thumb-container product-video-thumbnail-container">' + thumbInnerHtml + '</div>';
                    window.jQuery(thumbGallery).slick('slickAdd', slideHtml, 0, true);
                    window.jQuery(thumbGallery).slick('slickGoTo', 0, true);
                } else {
                    var videoThumbDiv = document.createElement('div');
                    videoThumbDiv.className = 'thumb-container product-video-thumbnail-container';
                    videoThumbDiv.innerHTML = thumbInnerHtml;
                    var track = thumbGallery.querySelector('.slick-track') || thumbGallery;
                    var list = track.querySelector('ul') || track;
                    if (list.tagName === 'UL') {
                        var li = document.createElement('li');
                        li.className = 'thumb-container product-video-thumbnail-container';
                        li.innerHTML = thumbInnerHtml;
                        list.insertBefore(li, list.firstChild);
                    } else {
                        list.insertBefore(videoThumbDiv, list.firstChild);
                    }
                }

                if (!window.videoThumbEventsAdded) {
                    window.videoThumbEventsAdded = true;
                    if (window.jQuery) {
                        window.jQuery(document).on('click', '#thumb-gallery .thumb-container, .product-images .thumb-container, .product-images li, .product-thumb-images .slick-slide', function () {
                            var $this = window.jQuery(this);
                            var isVideo = $this.hasClass('product-video-thumbnail-container') || $this.find('.product-video-thumbnail-container').length > 0;

                            var $cover = window.jQuery('.images-container .product-cover');
                            var $videoWrapper = $cover.find('.product-page-video-wrapper');
                            var $img = $cover.find('img:not(.thumb)');
                            var vid = $videoWrapper.find('video')[0];

                            if (isVideo) {
                                $videoWrapper.show();
                                $img.hide();
                                if (vid && settings.autoplay === 1) vid.play();
                            } else {
                                $videoWrapper.hide();
                                $img.show();
                                if (vid) vid.pause();
                            }
                        });
                    } else {
                        document.addEventListener('click', function (e) {
                            var target = e.target.closest('#thumb-gallery .thumb-container, .product-images .thumb-container, .product-images li, .product-thumb-images .slick-slide');
                            if (target) {
                                var isVideo = target.classList.contains('product-video-thumbnail-container') || target.querySelector('.product-video-thumbnail-container');
                                var cover = document.querySelector('.images-container .product-cover');
                                if (!cover) return;
                                var videoWrapper = cover.querySelector('.product-page-video-wrapper');
                                var img = cover.querySelector('img:not(.thumb)');
                                var vid = videoWrapper ? videoWrapper.querySelector('video') : null;

                                if (videoWrapper && img) {
                                    if (isVideo) {
                                        videoWrapper.style.display = 'block';
                                        img.style.display = 'none';
                                        if (vid && settings.autoplay === 1) vid.play().catch(function () { });
                                    } else {
                                        videoWrapper.style.display = 'none';
                                        img.style.display = 'block';
                                        if (vid) vid.pause();
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
        // ---------------------------------

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

        // 1. Стандартний метод Prestashop 1.7+ (спрацьовує при зміні атрибутів)
        if (typeof prestashop !== 'undefined') {
            prestashop.on('updatedProduct', function () {
                reinitVideo();
            });
        }

        // 2. Fallback для кастомних тем (наприклад, Leo Theme), де updatedProduct може не працювати
        if (typeof window.jQuery !== 'undefined') {
            // Відслідковуємо всі AJAX-запити. Якщо це оновлення товару — перемальовуємо відео.
            window.jQuery(document).on('ajaxComplete', function (event, xhr, settings) {
                if (settings && settings.url && (settings.url.indexOf('Controller=product') > -1 || settings.url.indexOf('controller=product') > -1 || settings.url.indexOf('refresh') > -1)) {
                    // Даємо трохи часу для застосування змін у DOM
                    setTimeout(reinitVideo, 150);
                }
            });

            // 3. Прямий клік по кнопках кольору чи розміру (як додаткова підстраховка)
            window.jQuery(document).on('click', '.product-variants-item input, .product-variants-item select, .input-color', function () {
                setTimeout(reinitVideo, 600); // Чекаємо, поки пройде ajax-запит
            });
        }

        function reinitVideo() {
            var slickSlider = document.querySelector('.list-images-mobile');
            if (window.jQuery && slickSlider && window.jQuery(slickSlider).hasClass('slick-initialized')) {
                // Видаляємо всі слайди з відео (через API slick)
                var $slider = window.jQuery(slickSlider);
                var slideIndicesToRemove = [];
                $slider.find('.slick-slide').each(function (index, slide) {
                    if (window.jQuery(slide).find('.product-page-video-wrapper').length > 0) {
                        // slickRemove використовує індекс слайду (без урахування клонів)
                        var dataSlickIndex = window.jQuery(slide).attr('data-slick-index');
                        if (dataSlickIndex !== undefined && parseInt(dataSlickIndex) >= 0) {
                            slideIndicesToRemove.push(parseInt(dataSlickIndex));
                        }
                    }
                });

                // Видаляємо з кінця, щоб не збились індекси
                slideIndicesToRemove.sort(function (a, b) { return b - a });
                slideIndicesToRemove.forEach(function (idx) {
                    $slider.slick('slickRemove', idx);
                });
            }

            // Також видаляємо мініатюру відео (якщо вона є в #thumb-gallery)
            var thumbGallery = document.querySelector('#thumb-gallery');
            if (!thumbGallery) thumbGallery = document.querySelector('.product-images');
            if (window.jQuery && thumbGallery && window.jQuery(thumbGallery).hasClass('slick-initialized')) {
                var $t = window.jQuery(thumbGallery);
                var idxToRemove = -1;
                $t.find('.slick-slide').each(function (index, slide) {
                    if (window.jQuery(slide).find('.product-video-thumbnail-container').length > 0 || window.jQuery(slide).hasClass('product-video-thumbnail-container')) {
                        var dataIdx = window.jQuery(slide).attr('data-slick-index');
                        if (dataIdx !== undefined) idxToRemove = parseInt(dataIdx);
                    }
                });
                if (idxToRemove !== -1) {
                    $t.slick('slickRemove', idxToRemove);
                }
            } else if (thumbGallery) {
                var vth = thumbGallery.querySelector('.product-video-thumbnail-container');
                if (vth && vth.parentNode) vth.parentNode.removeChild(vth);
            }

            var existingVideos = document.querySelectorAll('.product-page-video-wrapper');
            existingVideos.forEach(function (el) {
                // Видаляємо саму обгортку або її батьківський div (якщо це слайд, який ми створили)
                var parent = el.parentNode;
                if (parent) {
                    parent.removeChild(el);
                    // Якщо батьківський елемент порожній div (який ми створили для slick), видалимо і його
                    if (parent.tagName === 'DIV' && parent.children.length === 0 && !parent.classList.contains('images-container') && !parent.classList.contains('product-cover')) {
                        if (parent.parentNode) {
                            parent.parentNode.removeChild(parent);
                        }
                    }
                }
            });
            initProductPageVideo();
        }
    });


})();
