import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import i18n from "./i18n";
import App from "./App.vue";
import "./style.css";
import "element-plus/dist/index.css";

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");

// 限制最大的系統字體縮放，避免 Tailwind 版面完全跑版
function clampRootFontSize() {
  const html = document.documentElement;
  html.style.fontSize = ''; // 清除之前的 inline style 以取得真實設定
  const computedSize = window.getComputedStyle(html).fontSize;
  const sizePx = parseFloat(computedSize);
  
  // 預設是 16px。這裡限制最大放大到 20px (約 125%)
  // 這樣字體可以變大，但排版不至於破裂
  if (sizePx > 20) {
    html.style.fontSize = '20px';
  }
}

window.addEventListener('resize', clampRootFontSize);
// 監聽可能改變系統字體的事件 (例如從 iOS Safari 切換回來)
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') clampRootFontSize();
});
clampRootFontSize();
