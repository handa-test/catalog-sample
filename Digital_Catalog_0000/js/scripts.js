/* ===========================================================
   scripts.js  デジタルカタログ ビューア 挙動
   依存: jQuery, turn.js
   =========================================================== */

(function () {
  "use strict";

  // ---------------------------------------------
  // 定数（A4縦相当の論理サイズ。画像はobject-fitで収める）
  // ---------------------------------------------
  var PAGE_W = 595;  // 単ページ幅
  var PAGE_H = 842;  // 単ページ高さ
  var DOUBLE_W = PAGE_W * 2; // 見開き幅

  // ---------------------------------------------
  // 参照要素
  // ---------------------------------------------
  var $win = $(window);
  var $doc = $(document);

  var $flipbook = $("#flipbook");
  var $viewer = $(".viewer-wrapper");

  var $btnPrev = $("#prev-page-button");
  var $btnNext = $("#next-page-button");
  var $btnToc = $("#toc-button");
  var $tocPanel = $("#toc-panel");
  var $tocClose = $("#toc-close");
  var $tocList = $("#toc-list");

  var $thumbSidebar = $("#thumbnail-sidebar");
  var $thumbToggle = $("#thumbnail-button");
  var $thumbClose = $("#close-thumbnail-sidebar");
  var $thumbContainer = $("#thumbnail-container");

  var $progress = $("#progress");
  var $progressBar = $("#progress-bar");
  var $pageIndicator = $("#page-indicator");
  var $pageCurrent = $("#current-page");
  var $pageTotal = $("#total-pages");

  var $btnZoomIn = $("#zoom-in");
  var $btnZoomOut = $("#zoom-out");
  var $btnFullscreen = $("#fullscreen-button");

  var $loading = $("#loading-overlay");

  var $cta = $("#cta-button");

  // ---------------------------------------------
  // 状態変数
  // ---------------------------------------------
  var totalPages = 0;
  var direction = ($flipbook.data("direction") || "ltr").toLowerCase(); // 'ltr' | 'rtl'
  var initialPage = getPageFromHash() || 1;

  var currentScale = 1;
  var minScale = 1;
  var maxScale = 3;
  var scaleStep = 0.15;

  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var offsetX = 0;
  var offsetY = 0;

  // ---------------------------------------------
  // 初期実行
  // ---------------------------------------------
  $(function () {
    // CTAの動的化（data属性優先）
    applyCTA();

    // 画像の読み込みとページ数取得
    totalPages = $flipbook.children(".page").length;
    $pageTotal.text(totalPages);

    // まずはturn.jsを初期化
    initTurn();

    // サムネイル生成
    buildThumbnails();

    // 目次生成（altからタイトルを拾い、無ければ p.X）
    buildTOC();

    // ハッシュ監視（#p=）
    bindHashChange();

    // 操作UIのイベント
    bindControls();

    // リサイズ対応
    $win.on("resize", handleResize);

    // 読み込みオーバーレイ解除（ready内でも解除するが、二重呼びでも問題なし）
    hideLoading();
  });

  // ---------------------------------------------
  // turn.js 初期化
  // ---------------------------------------------
  function initTurn() {
    var displayMode = getDisplayMode();
    // Base transform/原点を揃える（CSSと一致）
    var flipEl = $flipbook.get(0);
    if (flipEl) {
      flipEl.style.transformOrigin = "left top";
      flipEl.style.transform = "translate(0px, 0px) scale(1)";
    }

    // 既に初期化済みの場合は破棄
    if ($flipbook.data("turn")) {
      $flipbook.turn("destroy").remove();
      // 破棄したのでDOMを戻す（#flipbook再作成）
      var $new = $('<div id="flipbook" class="flipbook" data-direction="' + direction + '"></div>');
      $viewer.prepend($new);
      // 旧ページ群を移し替え（初期化時破棄しているので、再構築が必要ならここでDOMを生成）
      // 今回は破棄前にcloneせずdestroyしているため、通常はdestroy前にcloneを取る。
      // ただし通常運用ではdestroyは呼ばれない想定。
      $flipbook = $("#flipbook");
      // 何らかの理由でdestroyを通る場合は、呼び出し元でinit前にdestroyしない運用にするか、
      // ここでindex.htmlからページDOMを再挿入する処理を別途用意してください。
    }

    // 念のためサイズ確定（フルスクリーンでなければ論理サイズ固定）
    applyResponsiveSize(displayMode);

    // turn.js オプション
    $flipbook.turn({
      display: displayMode, // 'single' | 'double'
      width: (displayMode === "single") ? PAGE_W : DOUBLE_W,
      height: PAGE_H,
      elevation: 50,
      gradients: true,
      acceleration: true,
      autoCenter: false, // 原点はCSS管理
      direction: (direction === "rtl") ? "rtl" : "ltr", // 'rtl'対応
      page: clampPage(initialPage, 1, totalPages),
      pages: totalPages,
      when: {
        ready: function () {
          // ズーム・パンを初期化
          resetZoomAndPan();
          // 進捗・ページ表示更新
          var p = $flipbook.turn("page");
          updateUIOnTurn(p);
          // ハッシュ反映
          updateUrlHash(p);
          // ローディング非表示
          hideLoading();
        },
        turned: function (event, page) {
          // ページが切り替わったら毎回リセット（ズーム位置ズレ防止）
          resetZoomAndPan();
          updateUIOnTurn(page);
          updateUrlHash(page);
        }
      }
    });
  }

  // ---------------------------------------------
  // 表示モード（縦向き=単ページ / 横向き=見開き）
  // ---------------------------------------------
  function getDisplayMode() {
    var w = window.innerWidth;
    var isPortrait = window.matchMedia("(orientation: portrait)").matches || window.innerHeight > window.innerWidth;
    return (w < 1024 || isPortrait) ? "single" : "double";
  }

  function applyResponsiveSize(mode) {
    var display = mode || getDisplayMode();
    if (!$flipbook.data("turn")) return;
    $flipbook.turn("display", display);
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
      $flipbook.turn("size", (display === "single") ? PAGE_W : DOUBLE_W, PAGE_H);
    }
  }

  function handleResize() {
    applyResponsiveSize();
    // サムネイルのアクティブ追従
    var p = $flipbook.turn("page");
    highlightActiveThumb(p);
    scrollThumbIntoView(p);
    // ズームとパンの座標も原点に戻す方が視覚的ブレが少ない
    resetZoomAndPan();
  }

  // ---------------------------------------------
  // URLハッシュ (#p=) 連携
  // ---------------------------------------------
  function getPageFromHash() {
    var hash = window.location.hash || "";
    var m = hash.match(/[#&]p=(\d+)/i);
    if (m) {
      var n = parseInt(m[1], 10);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  function updateUrlHash(page) {
    var newHash = "#p=" + page;
    if (window.location.hash !== newHash) {
      history.replaceState(null, "", newHash);
    }
  }

  function bindHashChange() {
    $win.on("hashchange", function () {
      var p = getPageFromHash();
      if (p != null && $flipbook.data("turn")) {
        p = clampPage(p, 1, totalPages);
        if ($flipbook.turn("page") !== p) {
          $flipbook.turn("page", p);
        }
      }
    });
  }

  // ---------------------------------------------
  // UI / 操作イベント
  // ---------------------------------------------
  function bindControls() {
    // ページ操作
    $btnPrev.on("click", function () {
      if (!$flipbook.data("turn")) return;
      $flipbook.turn("previous");
    });
    $btnNext.on("click", function () {
      if (!$flipbook.data("turn")) return;
      $flipbook.turn("next");
    });

    // キーボード（左右・Home/End）
    $doc.on("keydown", function (e) {
      if (!$flipbook.data("turn")) return;

      // 入力系にフォーカスがあるときは無効化
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        $flipbook.turn("previous");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        $flipbook.turn("next");
      } else if (e.key === "Home") {
        e.preventDefault();
        $flipbook.turn("page", 1);
      } else if (e.key === "End") {
        e.preventDefault();
        $flipbook.turn("page", totalPages);
      }
    });

    // 目次
    $btnToc.on("click", function () {
      $tocPanel.toggleClass("hidden", false);
    });
    $tocClose.on("click", function () {
      $tocPanel.addClass("hidden");
    });

    // サムネイル
    $thumbToggle.on("click", function () {
      var willOpen = !$thumbSidebar.hasClass("visible");
      $thumbSidebar.toggleClass("visible", willOpen);
      $thumbToggle.attr("aria-expanded", willOpen ? "true" : "false");

      if (willOpen) {
        // 現在ページを中央へ
        var p = $flipbook.turn("page");
        highlightActiveThumb(p);
        scrollThumbIntoView(p);
      }
    });
    $thumbClose.on("click", function () {
      $thumbSidebar.removeClass("visible");
      $thumbToggle.attr("aria-expanded", "false");
    });

    // ズーム
    $btnZoomIn.on("click", function () { zoomBy(scaleStep); });
    $btnZoomOut.on("click", function () { zoomBy(-scaleStep); });

    // 全画面
    $btnFullscreen.on("click", toggleFullscreen);

    // ドラッグでパン（ズーム中のみ）
    $flipbook.on("mousedown", function (e) {
      if (currentScale <= 1) return;
      isDragging = true;
      dragStartX = e.clientX - offsetX;
      dragStartY = e.clientY - offsetY;
      $flipbook.addClass("grabbing");
    });
    $doc.on("mousemove", function (e) {
      if (!isDragging) return;
      offsetX = e.clientX - dragStartX;
      offsetY = e.clientY - dragStartY;
      applyTransform();
    });
    $doc.on("mouseup", function () {
      if (!isDragging) return;
      isDragging = false;
      $flipbook.removeClass("grabbing");
    });

    // ホイールでズーム（Ctrl/Meta+ホイールで拡大縮小）
    $flipbook.on("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var delta = (e.originalEvent.deltaY || 0) > 0 ? -scaleStep : scaleStep;
      zoomBy(delta);
    }, { passive: false });
  }

  // ---------------------------------------------
  // 目次（TOC）生成：各ページ画像のaltを使う。無ければ "p.X"
  // ---------------------------------------------
  function buildTOC() {
    if (!$tocList.length) return;
    $tocList.empty();

    var $pages = $flipbook.children(".page");
    $pages.each(function (i, el) {
      var pageNo = i + 1;
      var $img = $(el).find("img").first();
      var title = ($img.attr("alt") || "").trim();
      if (!title) title = "p." + pageNo;

      var $li = $('<li><span class="toc-title"></span><span class="toc-page"></span></li>');
      $li.find(".toc-title").text(title);
      $li.find(".toc-page").text("p." + pageNo);
      $li.on("click", function () {
        $flipbook.turn("page", pageNo);
        $tocPanel.addClass("hidden");
      });
      $tocList.append($li);
    });
  }

  // ---------------------------------------------
  // サムネイル生成：各ページ画像の縮小版を作成
  // ---------------------------------------------
  function buildThumbnails() {
    if (!$thumbContainer.length) return;
    $thumbContainer.empty();

    var $pages = $flipbook.children(".page");
    $pages.each(function (i, el) {
      var pageNo = i + 1;
      var $img = $(el).find("img").first();
      var src = $img.attr("src");

      var $item = $('<div class="thumbnail-item" tabindex="0" data-page="' + pageNo + '"></div>');
      var $badge = $('<div class="page-no-badge"></div>').text(pageNo);
      var $thumbImg = $('<img alt="サムネイル p.' + pageNo + '">').attr("src", src);

      $item.append($thumbImg).append($badge);
      $item.on("click keypress", function (ev) {
        if (ev.type === "click" || (ev.type === "keypress" && (ev.key === "Enter" || ev.key === " "))) {
          $flipbook.turn("page", pageNo);
        }
      });

      $thumbContainer.append($item);
    });
  }

  function highlightActiveThumb(page) {
    $thumbContainer.find(".thumbnail-item").removeClass("active");
    $thumbContainer.find('.thumbnail-item[data-page="' + page + '"]').addClass("active");
  }

  function scrollThumbIntoView(page) {
    var $active = $thumbContainer.find('.thumbnail-item[data-page="' + page + '"]');
    if (!$active.length) return;

    var container = $thumbContainer.get(0);
    var box = $active.get(0).getBoundingClientRect();
    var cont = container.getBoundingClientRect();

    var visibleTop = container.scrollTop;
    var visibleBottom = visibleTop + $thumbContainer.height();
    var targetTop = $active.position().top + visibleTop;
    var targetBottom = targetTop + $active.outerHeight(true);

    if (targetTop < visibleTop || targetBottom > visibleBottom) {
      var center = targetTop - ($thumbContainer.height() / 2) + ($active.outerHeight(true) / 2);
      $thumbContainer.stop().animate({ scrollTop: center }, 250);
    }
  }

  // ---------------------------------------------
  // ページ切替後のUI同期
  // ---------------------------------------------
  function updateUIOnTurn(page) {
    // ページ番号
    $pageCurrent.text(page);

    // 進捗バー
    var ratio = (totalPages > 1) ? (page - 1) / (totalPages - 1) : 0;
    $progressBar.css("width", (ratio * 100).toFixed(1) + "%");

    // 前後ボタンの有効・無効
    var atFirst = page <= 1;
    var atLast = page >= totalPages;
    $btnPrev.prop("disabled", atFirst);
    $btnNext.prop("disabled", atLast);

    // サムネイルのアクティブ表示
    highlightActiveThumb(page);
    if ($thumbSidebar.hasClass("visible")) {
      scrollThumbIntoView(page);
    }
  }

  // ---------------------------------------------
  // CTA（data属性を優先）
  // ---------------------------------------------
  function applyCTA() {
    if (!$cta.length) return;
    var txt = $cta.data("ctaText");
    var url = $cta.data("ctaUrl");
    if (txt && typeof txt === "string") $cta.text(txt);
    if (url && typeof url === "string") $cta.attr("href", url);
  }

  // ---------------------------------------------
  // ズーム・パン
  // ---------------------------------------------
  function applyTransform() {
    var el = $flipbook.get(0);
    if (!el) return;
    el.style.transformOrigin = "left top";
    el.style.transform = "translate(" + offsetX + "px, " + offsetY + "px) scale(" + currentScale + ")";
  }

  function resetZoomAndPan() {
    currentScale = 1;
    offsetX = 0;
    offsetY = 0;
    applyTransform();
  }

  function zoomBy(delta) {
    var newScale = clamp(currentScale + delta, minScale, maxScale);
    if (newScale === currentScale) return;
    currentScale = newScale;

    // 原点ズーム：必要なら中心ズームへ改良可能
    applyTransform();
  }

  // ---------------------------------------------
  // 全画面
  // ---------------------------------------------
  function toggleFullscreen() {
    var el = document.documentElement;
    if (!document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    }
    // 全画面切替後にレイアウト再適用
    setTimeout(function () {
      applyResponsiveSize();
      resetZoomAndPan();
    }, 100);
  }

  // ---------------------------------------------
  // ユーティリティ
  // ---------------------------------------------
  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }
  function clampPage(p, min, max) {
    if (typeof p !== "number") p = parseInt(p, 10);
    if (isNaN(p)) p = min;
    return clamp(p, min, max);
  }

  function showLoading() {
    $loading.removeClass("hidden");
  }
  function hideLoading() {
    $loading.addClass("hidden");
  }

})();
