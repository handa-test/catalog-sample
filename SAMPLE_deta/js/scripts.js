
$(function() {
    var flipbook = $('#flipbook');
    var prevButton = $('#prev-page-button');
    var nextButton = $('#next-page-button');
    var zoomInButton = $('#zoom-in');
    var zoomOutButton = $('#zoom-out');
    var thumbnailButton = $('#thumbnail-button');
    var thumbnailSidebar = $('#thumbnail-sidebar');
    var closeThumbnailSidebarButton = $('#close-thumbnail-sidebar');
    var thumbnailContainer = $('#thumbnail-container');
    var loadingOverlay = $('#loading-overlay');
    var totalPages = 18;
    var direction = 'ltr';
    var initialPage = 1;

    // ズームとパンの変数
    let currentScale = 1.0;
    const minScale = 1.0;
    const maxScale = 3.0;
    const scaleStep = 0.2;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let lastMouseX, lastMouseY;
    let initialPinchDistance = 0;

    // URLハッシュからページを取得する関数
    function getPageFromHash() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        let page = parseInt(params.get('p'));
        if (isNaN(page) || page < 1 || page > totalPages) {
            page = 1;
        }
        return page;
    }
    initialPage = getPageFromHash();

    // turn.js初期化
    flipbook.turn({
        width: $(window).width() < 768 ? 595 : 1190,
        height: 842,
        autoCenter: true,
        display: $(window).width() < 768 ? 'single' : 'double',
        direction: direction,
        acceleration: true,
        gradients: true,
        elevation: 50,
        pages: totalPages,
        page: initialPage,
        when: {
            turned: function(event, page, view) {
                updateNavigationButtons();
                updatePageNumber(page);
                updateProgressBar(page);
                resetZoomAndPan();
                updateThumbnailActiveState(page);
                updateUrlHash(page);
            },
            ready: function(event, book) {
                loadingOverlay.addClass('hidden');
                setTimeout(() => { loadingOverlay.hide(); }, 500);
            }
        }
    });

    // ページ番号・プログレス・サムネイル初期化
    updatePageNumber(initialPage);
    updateProgressBar(initialPage);
    generateThumbnails();
    updateThumbnailActiveState(initialPage);

    // ナビゲーションボタン制御
    function updateNavigationButtons() {
        var currentPage = flipbook.turn('page');
        if (direction === 'rtl') {
            if (currentPage >= totalPages) prevButton.addClass('disabled'); else prevButton.removeClass('disabled');
            if (currentPage <= 1) nextButton.addClass('disabled'); else nextButton.removeClass('disabled');
        } else {
            if (currentPage <= 1) prevButton.addClass('disabled'); else prevButton.removeClass('disabled');
            if (currentPage >= totalPages) nextButton.addClass('disabled'); else nextButton.removeClass('disabled');
        }
    }

    function updatePageNumber(page) {
        $('#page-number-display').text(page + ' / ' + totalPages);
    }

    function updateProgressBar(page) {
        let progress = (page / totalPages) * 100;
        $('#page-progress-bar').css('width', progress + '%');
    }

    function updateUrlHash(page) {
        if (history.replaceState) {
            history.replaceState(null, null, `#p=${page}`);
        } else {
            window.location.hash = `p=${page}`;
        }
    }

    // ページ移動ボタン
    prevButton.on('click', function() {
        if (!$(this).hasClass('disabled') && currentScale === minScale) {
            if (direction === 'rtl') flipbook.turn('next');
            else flipbook.turn('previous');
        }
    });
    nextButton.on('click', function() {
        if (!$(this).hasClass('disabled') && currentScale === minScale) {
            if (direction === 'rtl') flipbook.turn('previous');
            else flipbook.turn('next');
        }
    });

    // キーボード操作
    $(document).keydown(function(e){
        if (currentScale === minScale) {
            if (e.keyCode == 37) {
                if (direction === 'rtl') {
                    if (!prevButton.hasClass('disabled')) flipbook.turn('next');
                } else {
                    if (!prevButton.hasClass('disabled')) flipbook.turn('previous');
                }
                e.preventDefault();
            } else if (e.keyCode == 39) {
                if (direction === 'rtl') {
                    if (!nextButton.hasClass('disabled')) flipbook.turn('previous');
                } else {
                    if (!nextButton.hasClass('disabled')) flipbook.turn('next');
                }
                e.preventDefault();
            }
        }
    });

    // ズームとパン
    function applyZoomAndPan() {
        flipbook.css({
            'transform': `scale(${currentScale}) translate(${offsetX / currentScale}px, ${offsetY / currentScale}px)`,
            'transform-origin': 'center center'
        });
        if (currentScale > minScale) {
            prevButton.addClass('disabled');
            nextButton.addClass('disabled');
        } else {
            updateNavigationButtons();
        }
    }

    function updateZoom(newScale) {
        currentScale = Math.min(Math.max(minScale, newScale), maxScale);
        if (currentScale === minScale) {
            offsetX = 0;
            offsetY = 0;
        }
        applyZoomAndPan();
    }

    function resetZoomAndPan() {
        currentScale = minScale;
        offsetX = 0;
        offsetY = 0;
        applyZoomAndPan();
    }

    zoomInButton.on('click', function() {
        updateZoom(currentScale + scaleStep);
    });
    zoomOutButton.on('click', function() {
        updateZoom(currentScale - scaleStep);
    });

    flipbook.on('dblclick', function(e) {
        if (currentScale === minScale) {
            const rect = flipbook[0].getBoundingClientRect();
            const clickX = e.clientX - rect.left - rect.width / 2;
            const clickY = e.clientY - rect.top - rect.height / 2;
            offsetX = -clickX * (maxScale - 1);
            offsetY = -clickY * (maxScale - 1);
            updateZoom(maxScale);
        } else {
            resetZoomAndPan();
        }
    });

    flipbook.on('mousedown touchstart', function(e) {
        if (currentScale > minScale) {
            isDragging = true;
            flipbook.addClass('grabbing');
            lastMouseX = e.clientX || e.originalEvent.touches[0].clientX;
            lastMouseY = e.clientY || e.originalEvent.touches[0].clientY;
            e.preventDefault();
        }
    });

    $(document).on('mousemove touchmove', function(e) {
        if (isDragging) {
            e.preventDefault();
            const clientX = e.clientX || e.originalEvent.touches[0].clientX;
            const clientY = e.clientY || e.originalEvent.touches[0].clientY;
            const dx = clientX - lastMouseX;
            const dy = clientY - lastMouseY;
            offsetX += dx;
            offsetY += dy;
            lastMouseX = clientX;
            lastMouseY = clientY;
            applyZoomAndPan();
        }
    });

    $(document).on('mouseup touchend', function() {
        isDragging = false;
        flipbook.removeClass('grabbing');
    });

    flipbook.on('touchstart', function(e) {
        if (e.originalEvent.touches.length === 2) {
            initialPinchDistance = getPinchDistance(e.originalEvent.touches);
            isDragging = false;
        }
    });
    flipbook.on('touchmove', function(e) {
        if (e.originalEvent.touches.length === 2 && initialPinchDistance > 0) {
            e.preventDefault();
            const currentPinchDistance = getPinchDistance(e.originalEvent.touches);
            const scaleFactor = currentPinchDistance / initialPinchDistance;
            updateZoom(currentScale * scaleFactor);
            initialPinchDistance = currentPinchDistance;
        }
    });
    function getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // サムネイル機能
    function generateThumbnails() {
        thumbnailContainer.empty();
        for (let i = 1; i <= totalPages; i++) {
            const thumbnailItem = $(`
                <div class="thumbnail-item" data-page="${i}">
                    <img src="images_png/catalog-${String(i).padStart(2, '0')}.png" alt="ページ${i}">
                    <span class="page-label">ページ${i}</span>
                </div>
            `);
            thumbnailContainer.append(thumbnailItem);
        }
    }

    function updateThumbnailActiveState(page) {
        $('.thumbnail-item').removeClass('active');
        $(`.thumbnail-item[data-page="${page}"]`).addClass('active');
        const activeThumbnail = $(`.thumbnail-item[data-page="${page}"]`);
        if (activeThumbnail.length) {
            const containerHeight = thumbnailContainer.height();
            const thumbnailTop = activeThumbnail.position().top + thumbnailContainer.scrollTop();
            const thumbnailHeight = activeThumbnail.outerHeight(true);
            if (thumbnailTop < thumbnailContainer.scrollTop() || thumbnailTop + thumbnailHeight > thumbnailContainer.scrollTop() + containerHeight) {
                thumbnailContainer.animate({
                    scrollTop: thumbnailTop - (containerHeight / 2) + (thumbnailHeight / 2)
                }, 300);
            }
        }
    }

    thumbnailButton.on('click', function() {
        thumbnailSidebar.toggleClass('visible hidden');
        updateThumbnailActiveState(flipbook.turn('page'));
    });

    closeThumbnailSidebarButton.on('click', function() {
        thumbnailSidebar.addClass('hidden').removeClass('visible');
    });

    thumbnailContainer.on('click', '.thumbnail-item', function() {
        const pageToTurn = parseInt($(this).attr('data-page'));
        if (flipbook.turn('page') !== pageToTurn) {
            flipbook.turn('page', pageToTurn);
        }
        thumbnailSidebar.addClass('hidden').removeClass('visible');
    });

    $(window).on('resize', function() {
        var w = $(window).width();
        var newDisplay = w < 768 ? 'single' : 'double';
        flipbook.turn('display', newDisplay);
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
            flipbook.turn('size', w < 768 ? 595 : 1190, 842);
        }
        updateProgressBar(flipbook.turn('page'));
        resetZoomAndPan();
        updateThumbnailActiveState(flipbook.turn('page'));
    });

    updateNavigationButtons();
});
