$(function() {
    // 基本設定
    const totalPages = $('#flipbook .page').length;
    const $flipbook = $('#flipbook');
    const $prevButton = $('#prev-page-button');
    const $nextButton = $('#next-page-button');
    const $showNavBtn = $('#show-nav-btn');
    const $navPanel = $('#nav-panel');
    const $zoomInBtn = $('#zoom-in-btn');
    const $zoomOutBtn = $('#zoom-out-btn');
    const $zoomLevel = $('#zoom-level');
    const $pageIndicator = $('#page-indicator');
    const $thumbArrowBtn = $('#thumb-sidebar-arrow');
    const $thumbSidebar = $('#thumb-sidebar');
    const $thumbSidebarClose = $('#thumb-sidebar-close');
    const $thumbSidebarList = $('#thumb-sidebar-list');

    let currentScale = 1.0;
    const minScale = 1.0;
    const maxScale = 3.0;
    const scaleStep = 0.2;

    // --- レスポンシブ用：ページ表示モードを自動判定
    function getDisplayMode() {
        const w = window.innerWidth, h = window.innerHeight;
        if (w < 700) return 'single'; // スマホ
        if (w >= 700 && w <= 1199) {
            return w > h ? 'double' : 'single'; // タブレット：横なら見開き、縦なら1枚
        }
        return 'double'; // PC
    }

    // --- 表示モード＆ズーム初期化
    function updateDisplayMode() {
        $flipbook.turn('display', getDisplayMode());
        setZoom(1.0);
    }
    $(window).on('resize orientationchange', updateDisplayMode);

    // --- 冊子本体（Turn.js）初期化
    $flipbook.turn({
        width: 2000,
        height: 2000,
        autoCenter: false,
        display: getDisplayMode(),
        pages: totalPages,
        elevation: 50,
        when: {
            turned: function(e, page) {
                updatePageIndicator(page);
                highlightThumb(page);
                resetZoom();
            }
        }
    });

    // --- ページ番号表示
    function updatePageIndicator(page) {
        $pageIndicator.text(`${page} / ${totalPages}`);
    }
    updatePageIndicator(1);

    // --- ページ送り
    $prevButton.on('click', () => $flipbook.turn('previous'));
    $nextButton.on('click', () => $flipbook.turn('next'));

    // --- ナビパネル開閉
    $showNavBtn.on('click', () => $navPanel.removeClass('hidden'));
    $('#hide-nav-btn').on('click', () => $navPanel.addClass('hidden'));

    // --- ズーム制御
    function setZoom(newScale) {
        currentScale = Math.min(Math.max(newScale, minScale), maxScale);
        $flipbook.css('transform', `scale(${currentScale})`);
        $zoomLevel.text(`${Math.round(currentScale * 100)}%`);
    }
    setZoom(1.0);
    $zoomInBtn.on('click', () => setZoom(currentScale + scaleStep));
    $zoomOutBtn.on('click', () => setZoom(currentScale - scaleStep));
    $flipbook.on('dblclick', function() {
        if (currentScale === minScale) setZoom(maxScale);
        else setZoom(minScale);
    });

    // --- サムネイルサイドバー生成
    function generateThumbSidebar() {
        $thumbSidebarList.empty();
        // 表紙
        $thumbSidebarList.append(`
            <div class="thumbnail-row">
                <div class="thumbnail-item cover" data-page="1">
                    <img src="images_png/catalog-01.png" alt="表紙">
                    <span class="page-label">表紙</span>
                </div>
            </div>
        `);
        // 中身（見開きページ単位で追加）
        for (let i = 2; i <= totalPages - 2; i += 2) {
            if (i + 1 <= totalPages - 1) {
                $thumbSidebarList.append(`
                    <div class="thumbnail-row">
                        <div class="thumbnail-item spread" data-page="${i}">
                            <img src="images_png/catalog-${String(i).padStart(2, '0')}.png" alt="p${i}">
                            <img src="images_png/catalog-${String(i+1).padStart(2, '0')}.png" alt="p${i+1}">
                            <span class="page-label">${i}-${i+1}</span>
                        </div>
                    </div>
                `);
            }
        }
        // 裏表紙
        $thumbSidebarList.append(`
            <div class="thumbnail-row">
                <div class="thumbnail-item cover" data-page="${totalPages}">
                    <img src="images_png/catalog-${String(totalPages).padStart(2, '0')}.png" alt="裏表紙">
                    <span class="page-label">裏表紙</span>
                </div>
            </div>
        `);
    }
    generateThumbSidebar();

    // --- サイドバー開閉
    $thumbArrowBtn.on('click', () => $thumbSidebar.addClass('visible'));
    $thumbSidebarClose.on('click', () => $thumbSidebar.removeClass('visible'));

    // --- サムネイルクリックでページジャンプ
    $thumbSidebarList.on('click', '.thumbnail-item', function() {
        let page = parseInt($(this).attr('data-page'), 10);
        $flipbook.turn('page', page);
        $thumbSidebar.removeClass('visible');
    });

    // --- サムネイルハイライト
    function highlightThumb(page) {
        $('.thumbnail-item').removeClass('active');
        if (page === 1 || page === totalPages) {
            $(`.thumbnail-item[data-page="${page}"]`).addClass('active');
        } else if (page % 2 === 0 && page < totalPages) {
            $(`.thumbnail-item[data-page="${page}"]`).addClass('active');
        } else if ((page - 1) % 2 === 0 && page < totalPages) {
            $(`.thumbnail-item[data-page="${page-1}"]`).addClass('active');
        }
    }
    highlightThumb(1);

    // --- resizeでページ表示＋ズームをリセット
    $(window).on('resize', function() {
        $flipbook.turn('display', getDisplayMode());
        setZoom(1.0);
    });

    function resetZoom() { setZoom(1.0); }

    // --- 初期化
    $navPanel.addClass('hidden');
    $thumbSidebar.removeClass('visible');
    setZoom(1.0);

    // --- ESCでサイドバー・ナビパネル閉じる
    $(document).on('keydown', function(e){
        if (e.key === "Escape") {
            $navPanel.addClass('hidden');
            $thumbSidebar.removeClass('visible');
        }
    });
});

// --- サイドバー開閉グローバル関数
function openThumbSidebar() {
    $('#thumb-sidebar').addClass('visible').removeClass('hidden');
}
function closeThumbSidebar() {
    $('#thumb-sidebar').removeClass('visible').addClass('hidden');
}

// --- サイドバー：外部クリックで自動閉じ
$(document).on('click touchstart', function(e){
    if ($('#thumb-sidebar').hasClass('visible')) {
        if (
            !$(e.target).closest('#thumb-sidebar').length &&
            !$(e.target).is('#thumb-sidebar-arrow')
        ) {
            closeThumbSidebar();
        }
    }
});
