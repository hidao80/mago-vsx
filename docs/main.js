(function () {
  "use strict";

  var LANGUAGES = ["en", "ja", "zh", "es", "ru"];
  var STORAGE_KEY = "mago-vsx-lang";

  var META = {
    en: {
      title: "Mago for VS Code — PHP Static Analysis, Right in Your Editor",
      description: "Bring Mago's lint, analyze, format, and baseline workflows straight into VS Code. Real-time diagnostics, format-on-save, and baseline support for gradually improving legacy PHP codebases."
    },
    ja: {
      title: "Mago for VS Code — エディタ内でPHP静的解析",
      description: "MagoのLint・解析・フォーマット・ベースライン機能をVS Codeに統合。リアルタイム診断、保存時フォーマット、レガシーPHPコードベースを段階的に改善するベースライン対応。"
    },
    zh: {
      title: "Mago for VS Code — 在编辑器中进行 PHP 静态分析",
      description: "将 Mago 的 lint、分析、格式化和基线工作流直接引入 VS Code。实时诊断、保存时格式化，并支持基线以逐步改善遗留 PHP 代码库。"
    },
    es: {
      title: "Mago for VS Code — Análisis estático de PHP en tu editor",
      description: "Lleva los flujos de lint, análisis, formato y baseline de Mago directamente a VS Code. Diagnósticos en tiempo real, formato al guardar y soporte de baseline para mejorar gradualmente bases de código PHP heredadas."
    },
    ru: {
      title: "Mago for VS Code — статический анализ PHP прямо в редакторе",
      description: "Интегрируйте lint, анализ, форматирование и baseline-функции Mago прямо в VS Code. Диагностика в реальном времени, форматирование при сохранении и поддержка baseline для постепенного улучшения устаревшей кодовой базы PHP."
    }
  };

  function detectLanguage() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.indexOf(stored) !== -1) return stored;
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGUAGES.indexOf(nav) !== -1 ? nav : "en";
  }

  function applyMeta(lang) {
    var m = META[lang] || META.en;
    document.title = m.title;
    var descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", m.description);
  }

  var ml = new MultilanguageJS({ languages: LANGUAGES, defaultLanguage: "en" });

  function setLanguage(lang) {
    if (LANGUAGES.indexOf(lang) === -1) lang = "en";
    ml.setLanguage(lang);
    applyMeta(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    var select = document.getElementById("lang-select");
    if (select) select.value = lang;
  }

  document.addEventListener("DOMContentLoaded", function () {
    setLanguage(detectLanguage());

    var select = document.getElementById("lang-select");
    if (select) {
      select.addEventListener("change", function (e) {
        setLanguage(e.target.value);
      });
    }

    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.parentElement.querySelector("code");
        if (!code) return;
        navigator.clipboard.writeText(code.textContent).then(function () {
          btn.classList.add("copied");
          setTimeout(function () {
            btn.classList.remove("copied");
          }, 1500);
        });
      });
    });
  });
})();
