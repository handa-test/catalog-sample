$(function() {
    // 設定
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

    // サイドバーサムネイル用
    const $thumbArrowBtn = $('#thumb-sidebar-arrow');
    const $thumbSidebar = $('#thumb-sidebar');
    const $thumbSidebarClose = $('#thumb-sidebar-close');
    const $thumbSidebarList = $('#thumb-sidebar-list');

    let currentScale = 1.0;
    const minScale = 1.0;
    const maxScale = 3.0;
    const scaleStep = 0.2;

    // turn.js初期化
function getDisplayMode() {
    return window.innerWidth < 700 ? 'single' : 'double';
}
function getFlipSize() {
    if (getDisplayMode() === 'single') {
        return [595, 842]; // 単ページ画像サイズに合わせる
    } else {
        return [1190, 842]; // 見開き時（単ページ×2横幅）
    }
}
    $flipbook.turn({
        width: getFlipSize()[0],
        height: getFlipSize()[1],
        autoCenter: false, // 常に中央表示
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

    function updatePageIndicator(page) {
        $pageIndicator.text(`${page} / ${totalPages}`);
    }
    updatePageIndicator(1);

    // ページ送り
    $prevButton.on('click', () => $flipbook.turn('previous'));
    $nextButton.on('click', () => $flipbook.turn('next'));

    // ナビパネル
    $showNavBtn.on('click', () => $navPanel.removeClass('hidden'));
    $('#hide-nav-btn').on('click', () => $navPanel.addClass('hidden'));

    // ズーム
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

    // ▼▼ サイドバー型サムネイル ▼▼
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
        // 見開き
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

    // 開閉処理
    $thumbArrowBtn.on('click', function() {
        $thumbSidebar.addClass('visible');
    });
    $thumbSidebarClose.on('click', function() {
        $thumbSidebar.removeClass('visible');
    });
    
    
    
    // サムネイルクリックでページジャンプ
    $thumbSidebarList.on('click', '.thumbnail-item', function() {
        let page = parseInt($(this).attr('data-page'), 10);
        $flipbook.turn('page', page);
        $thumbSidebar.removeClass('visible');
    });

    // サムネイルハイライト
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

    // リサイズで再調整
    $(window).on('resize', function() {
        $flipbook.turn('display', getDisplayMode());
        $flipbook.turn('size', ...getFlipSize());
        setZoom(1.0);
    });

    function resetZoom() { setZoom(1.0); }

    // 初期化
    $navPanel.addClass('hidden');
    $thumbSidebar.removeClass('visible');
    setZoom(1.0);

    // ESCでサイドバー・ナビパネル閉じる
    $(document).on('keydown', function(e){
        if (e.key === "Escape") {
            $navPanel.addClass('hidden');
            $thumbSidebar.removeClass('visible');
        }
    });
});
// サイドバー開閉をグローバル関数で実装
function openThumbSidebar() {
    $('#thumb-sidebar').addClass('visible').removeClass('hidden');
}
function closeThumbSidebar() {
    $('#thumb-sidebar').removeClass('visible').addClass('hidden');
}
$(document).on('click', function(e) {
    // サイドバー以外の場所をクリックしたら閉じる
    if ($('#thumb-sidebar').hasClass('visible')) {
        if (
            !$(e.target).closest('#thumb-sidebar').length &&
            !$(e.target).is('#thumb-sidebar-arrow')
        ) {
            closeThumbSidebar();
        }
    }
});

$(document).on('click touchstart', function(e){
    // サイドバー可視化時、サイドバー以外をタップしたら閉じる
    if ($('#thumb-sidebar').hasClass('visible')) {
        if (
            !$(e.target).closest('#thumb-sidebar').length &&
            !$(e.target).is('#thumb-sidebar-arrow')
        ) {
            closeThumbSidebar();
        }
    }
});
