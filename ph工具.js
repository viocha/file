// ==UserScript==
// @name        ph工具
// @namespace   Violentmonkey Scripts
// @match       https://*.pornhub.com/view_video.php*
// @match       https://*.pornhub.com/interstitial*
// @require     https://cdn.jsdelivr.net/npm/jquery@3
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @require https://unpkg.com/xgplayer@latest/dist/index.min.js
// @require https://unpkg.com/xgplayer-hls@latest/dist/index.min.js
// @resource playerCss https://unpkg.com/xgplayer@latest/dist/index.min.css
// @require  https://unpkg.com/nprogress@latest/nprogress.js
// @resource progressCss https://unpkg.com/nprogress@latest/nprogress.css
// @version     1.0
// @author      viocha
// @description 2023/9/17 11:34:50
// @run-at      document-start
// @grant unsafeWindow
// @grant GM_getResourceText
// @grant GM_getValue
// @grant GM_listValues
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_addValueChangeListener
// @grant GM_removeValueChangeListener
// @grant GM_addElement
// @grant GM_addStyle
// @grant GM_openInTab
// @grant GM_registerMenuCommand
// @grant GM_unregisterMenuCommand
// @grant GM_setClipboard
// @grant GM_xmlhttpRequest
// @grant GM_download
// ==/UserScript==

// TODO: 监听js对象出现，或者直接请求js对象
// TODO: 标记点
//    全屏按钮
//    一键idm下载


if(location.href.includes('interstitial'))
{
    location.href=location.href.replace('interstitial','view_video.php');
    return;
}

const window=unsafeWindow;

GM_addStyle(`
:is(#player, .playerWrapper) > :not(#mse){
  display:none !important;
}
`);
$(main);

async function main() {
  const id=MGP.getPlayerIds()[0];
/*   const player=MGP.players[id];
  window.player=player; // 用于调试
 */
    // 获取视频链接并排序
  const idNum=id.split('_')[1];
  const videoList=window[`flashvars_${idNum}`].mediaDefinitions
    .filter((x) => x.quality.constructor === String && parseInt(x.quality))
    .sort((x,y)=>Number(y.quality)-Number(x.quality)); // 按画质排序
  videoList.forEach(x=>x.videoUrl=x.videoUrl.replace('master.m3u8','index-v1-a1.m3u8')); // 避免一次请求

  //=======================西瓜播放器==============================================
    // 最高画质的视频链接
  const firstUrl=videoList[0].videoUrl;

  // 播放器css
  GM_addStyle(GM_getResourceText('playerCss'));


   $('#player, .playerWrapper').empty().append(`
   <div id="mse"></div>
  `);

   const config = {
          "id": "mse",
          "playbackRate": false,
          "playsinline": true,
          "plugins": [],
          "keyShortcut": "on",
          "closeVideoClick": false,
          "autoplay": true,
          "fluid": true,
          "volume": 0,
          "progressDot": [
                    {
                              "time": 3,
                              "text": "text1"
                    },
                    {
                              "time": 5,
                              "text": "text2"
                    },
                    {
                              "time": 32,
                              "text": "text3"
                    },
                    {
                              "time": 36,
                              "text": "text4"
                    }
          ],
          "thumbnail": {
                    "pic_num": 44,
                    "width": 160,
                    "height": 90,
                    "col": 10,
                    "row": 10,
                    "urls": [
                              ""
                    ]
          },
          "closeVideoDblclick": false,
          "closeVideoTouch": false,
          "url": firstUrl
        };
  config.plugins.push(HlsPlayer);
  window.player = new Player(config);


  // ====================下载按钮=========================

  // 构建下载按钮html
  const title=$('.inlineFree').text();
  const videoUrls = videoList
    .map((x) => `<a class="video-download" href="${x.videoUrl}"
                    download="${x.quality}"
                    data-name="${title}.mp4" >
                ${x.quality}p
                </a>`)
    .join("\n");

  // onclick="downloadM3U8('${x.videoUrl}','${title}');return false;"

  const divHtml=`
    <div id="downloadUrls">
      下载链接：${videoUrls}
      <button id="titleCopy">复制标题</button>
    </div>`

  // 使用GM_download下载m3u8文件，以便重命名文件
  const $buttons=$(divHtml);
  $buttons.find('.video-download')
          .each((i,el)=>
                  el.onclick=
                  (ev)=>{
                          ev.preventDefault();
                          GM_download({url:el.href,name:el.dataset.name});
                        }
               );
  $('.video-actions-menu, .underThumbButtons').after($buttons); // 电脑和手机选择器不一样
  $('#titleCopy').on('click',()=>{
    navigator.clipboard.writeText(title);
  });

  // 下载进度条css
  GM_addStyle(GM_getResourceText('progressCss'));

  // 下载m3u8视频的实现
  window.downloadM3U8= function downloadM3U8(m3u8_link, name = "video") {
    alert('开始下载：'+name);
    // 使用AJAX请求获取m3u8文件的内容
    fetch(m3u8_link)
      .then((response) => response.text())
      .then(async (data) => {
        // 分析m3u8文件的内容，找到所有的TS文件链接
        const ts_links = [];
        const lines = data.split("\n");
        lines.forEach((line) => {
          if (line.includes("-v1-a1.ts")) {
            ts_links.push(line);
          }
        });

        // 使用Blob和URL.createObjectURL创建一个包含所有TS文件内容的MP4文件
      NProgress.start(); // 显示下载进度
      let count=0;
      const total=ts_links.length;
      const blobParts = await Promise.all(
        ts_links.map((link) =>
          fetch(new URL(link, m3u8_link))
             .then((response) => response.blob())
             .then(b=>{
              NProgress.set((++count)/total);
              return b;
            })
        )
      );
      NProgress.done();


        mp4_blob = new Blob(blobParts, { type: "video/mp4" });
        mp4_url = URL.createObjectURL(mp4_blob);

        // 将MP4文件的链接添加到<a>标签的href属性，以便下载
        const anchor = document.createElement("a");
        anchor.href = mp4_url;
        anchor.download = name + ".mp4";
        anchor.click();
        URL.revokeObjectURL(mp4_url); // 撤回对blob对象的引用
      });
  };

    // 下载按钮样式
  GM_addStyle(`
#downloadUrls {
    font-weight: bold;
    color: lightgreen;
    padding: 0.1em 0.5em;
    border: 1px solid dimgray;
    border-radius: 0.3em;
    margin: 0 0.2em;
}

div#downloadUrls> :is(a,button) {
    border: 1px solid rgb(255, 144, 0);
    border-radius: 0.3em;
    padding: 0.1em 0.4em;
    margin: 0.1em 0.3em;
    min-width: 3em;
    text-align: center;
    background-color: transparent;
    color: rgb(255, 144, 0);
}

`);

}
