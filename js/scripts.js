
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
    var totalPages = 14;
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

    // ベースのA4アスペクト比を定義 (単ページと見開きページ)
    const A4_ASPECT_RATIO_SINGLE = 595 / 842; // 幅 / 高さ
    const A4_ASPECT_RATIO_DOUBLE = 1190 / 842; // 幅 / 高さ

    // フリップブックのサイズを動的に計算する関数
    function calculateFlipbookSize() {
        var w = $(window).width();
        var h = $(window).height();
        var newDisplay;
        let targetWidth, targetHeight;

        if (w < 768) { // モバイル用サイズ計算
            newDisplay = 'single';
            // 上部のCTAボタンと下部のコントロール群のための余白を考慮
            const topSpace = 60; // CTAボタンの高さ+マージン (約15px top + パディング)
            const bottomSpace = 150; // 下部コントロールの総高さ+マージン (サイドナビ120px + 30pxバッファ)

            const availableHeight = h - topSpace - bottomSpace;
            // **修正点**: viewer-wrapperのモバイル用パディング(左右5pxずつ)を正確に考慮
            const viewerWrapperMobilePadding = 5; 
            const availableWidth = w - (viewerWrapperMobilePadding * 2);

            // 利用可能な幅に基づいて高さを計算し、A4単ページのアスペクト比を維持
            targetWidth = availableWidth;
            targetHeight = targetWidth / A4_ASPECT_RATIO_SINGLE;

            // もし計算された高さが利用可能な高さを超える場合、高さを基準に再計算
            if (targetHeight > availableHeight) {
                targetHeight = availableHeight;
                targetWidth = targetHeight * A4_ASPECT_RATIO_SINGLE;
            }

            // 最小サイズを保証（画面が極端に狭い/短い場合）
            const minMobileWidth = 280;
            const minMobileHeight = minMobileWidth / A4_ASPECT_RATIO_SINGLE;
            if (targetWidth < minMobileWidth) {
                targetWidth = minMobileWidth;
                targetHeight = minMobileHeight;
            }

        } else { // PC用サイズ計算 (見開きページ)
            newDisplay = 'double';
            // PCの基準サイズ
            targetWidth = 1190;
            targetHeight = 842;

            // ウィンドウサイズが最適なデスクトップサイズより小さい場合、アスペクト比を維持してスケールダウン
            const padding = 40; // viewer-wrapperの左右20pxずつのパディング
            const controlHeight = 100; // 上部CTAと下部コントロールの推定高さ
            const maxContentWidth = w - padding;
            const maxContentHeight = h - controlHeight - padding;

            const currentAspectRatio = targetWidth / targetHeight; // 見開きページのアスペクト比

            let scaleFactor = 1;
            if (targetWidth > maxContentWidth) {
                scaleFactor = maxContentWidth / targetWidth;
            }
            if (targetHeight * scaleFactor > maxContentHeight) {
                scaleFactor = Math.min(scaleFactor, maxContentHeight / targetHeight);
            }

            targetWidth = targetWidth * scaleFactor;
            targetHeight = targetHeight * scaleFactor;

            // 最小デスクトップサイズを保証
            const minDesktopWidth = 600;
            const minDesktopHeight = minDesktopWidth / A4_ASPECT_RATIO_DOUBLE;
            if (targetWidth < minDesktopWidth) {
                targetWidth = minDesktopWidth;
                targetHeight = minDesktopHeight;
            }
        }
        return { width: targetWidth, height: targetHeight, display: newDisplay };
    }

    // turn.js初期化
    var initialSize = calculateFlipbookSize();
    flipbook.turn({
        width: initialSize.width,
        height: initialSize.height,
        autoCenter: true,
        display: initialSize.display,
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
        var newSize = calculateFlipbookSize();
        flipbook.turn('display', newSize.display);
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
            flipbook.turn('size', newSize.width, newSize.height);
        }
        updateProgressBar(flipbook.turn('page'));
        resetZoomAndPan();
        updateThumbnailActiveState(flipbook.turn('page'));
    });

    updateNavigationButtons();
});
