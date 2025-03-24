// ==UserScript==
// @name         Disable Page Zoom
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Prevent page zooming by setting viewport meta tag
// @author       Grok
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 创建或获取viewport meta标签
    let viewport = document.querySelector('meta[name="viewport"]');
    
    if (!viewport) {
        // 如果页面没有viewport标签，则创建一个
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
    }
    
    // 设置viewport属性，禁止缩放
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
})();
