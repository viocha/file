// ==UserScript==
// @name        ph工具
// @namespace   Violentmonkey Scripts
// @match       https://*.pornhub.com/view_video.php*
// @match       https://*.pornhub.com/interstitial*
// @require     https://cdn.jsdelivr.net/npm/jquery@3
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
/// @require  https://unpkg.com/nprogress@0.2.0/nprogress.js
/// @resource progressCss https://unpkg.com/nprogress@0.2.0/nprogress.css
// @require https://unpkg.com/artplayer/dist/artplayer.js
// @require https://cdn.jsdelivr.net/npm/hls.js@canary
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

// TODO:   一键idm下载

// 跳转广告
if(location.href.includes('interstitial'))
{
    location.href=location.href.replace('interstitial','view_video.php');
    return;
}

// 隐藏原始播放器
GM_addStyle(`
:is(#player, .playerWrapper) > :not(#mse, .artplayer-app){
  display:none !important;
}
`);
$(main);

async function main() {
  const id=MGP.getPlayerIds()[0];

    // 获取视频链接并排序
  const idNum=id.split('_')[1];
  const flashvars=unsafeWindow[`flashvars_${idNum}`];
  const videoList=flashvars.mediaDefinitions
    .filter((x) => x.quality.constructor === String && parseInt(x.quality))
    .sort((x,y)=>Number(y.quality)-Number(x.quality)); // 按画质排序
  videoList.forEach(x=>x.videoUrl=x.videoUrl.replace('master.m3u8','index-v1-a1.m3u8')); // 避免一次请求

      // 最高画质的视频链接
  const firstUrl=videoList[0].videoUrl;

    // =======================artplayer================================


  // 播放器html
  $('#player, .playerWrapper').empty().append(`
    <div class="artplayer-app" style="aspect-ratio: 16/9;"></div>
  `);

  // m3u8插件
    function playM3u8(video, url, art) {
      if (Hls.isSupported()) {
          if (art.hls) art.hls.destroy();
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
          art.hls = hls;
          art.on('destroy', () => hls.destroy());
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
      } else {
          art.notice.show = 'Unsupported playback format: m3u8';
      }
  }



    // 视频重点标记
  const progressDot=flashvars.actionTags.split(',')
                                    .map(x=>x.split(':'))
                                    .map(x=>({text:x[0],time:+x[1]}));

    unsafeWindow.art = new Artplayer({
      container: ".artplayer-app",
      type:'m3u8',
      customType: {
        m3u8: playM3u8,
      },
      url: firstUrl,
      id:document.title,
      muted: true,
      autoplay: true,
      autoSize: true,
      playbackRate: false,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      playsInline: true,
      autoPlayback: true,
      autoOrientation: true,
      fastForward: true,
      airplay: true,
      theme: "#23ade5",
      highlight: progressDot,
      // thumbnails:{ // 无效
      //   url:finalThumbUrl,
      //   number:totalCount,
      //   column:5,
      //   height:90,
      //   width:160
      // }
    });

  //=======================西瓜播放器==============================================


//   // 播放器css
//   GM_addStyle(GM_getResourceText('playerCss'));


//     // 播放器html
//    $('#player, .playerWrapper').empty().append(`
//    <div id="mse"></div>
//   `);

//   // 视频重点标记
//   const progressDot=flashvars.actionTags.split(',')
//                                     .map(x=>x.split(':'))
//                                     .map(x=>({text:x[0],time:+x[1]}));
//   // 预览图
//   const urlPattern=flashvars.thumbs.urlPattern;
//   const maxNum=urlPattern.match(/{(\d+)}/)[1];
//   const thumbUrls=[];
//   for(let i=0 ;i<=maxNum;i++){
//     thumbUrls.push(urlPattern.replace(/{\d+}/,i));
//   }
//    const config = {
//           "id": "mse",
//           // "miniprogress":true, // TODO: miniprogress无效
//           "playbackRate": false,
//           "playsinline": true,
//           "plugins": [],
//           "keyShortcut": "on",
//           "closeVideoClick": true,
//           "autoplay": true,
//           "fluid": true,
//           "volume": 0,
//           "progressDot": progressDot,
// /*          "thumbnail": { // 预览图无效
//                     "pic_num": 25*(maxNum+1),
//                     "width": 160,
//                     "height": 90,
//                     "col": 5,
//                     "row": 5,
//                     "urls": thumbUrls
//           },*/
//           "closeVideoDblclick": false,
//           "closeVideoTouch": false,
//           "url": firstUrl
//         };
//   config.plugins.push(HlsPlayer);
//   unsafeWindow.player = new Player(config);

  // 自动横屏
//   const $controls=$('#mse > xg-controls');
//   document.addEventListener('fullscreenchange',()=>{
//     if(document.fullscreen){
//       screen.orientation.lock("landscape");
//       $controls.css('position','fixed');
//     }else{
//       // screen.orientation.lock("portrait");
//       $controls.css('position','absolute');
//     }
//   })




  // ====================下载按钮=========================

  // 构建下载按钮html
  const title=document.title;
  const videoUrls = videoList
    .map((x) => `<a class="video-download" href="${x.videoUrl}"
                    download="${title}.mp4" >
                ${x.quality}p
                </a>`)
    .join("\n");

  // onclick="downloadM3U8('${x.videoUrl}','${title}');return false;"

  const divHtml=`
    <div id="downloadUrls">
      下载链接：${videoUrls}
      <button id="titleCopy">复制标题</button>
    </div>`

  const $buttons=$(divHtml);
  $buttons.find('#titleCopy').on('click',()=>{
    navigator.clipboard.writeText(title);
  });
/*  $buttons.find('.video-download')
          .each((i,el)=>
                  el.onclick=
                  (ev)=>{
                          ev.preventDefault();
                          GM_download({url:el.href,name:el.dataset.name});
                        }
               );*/

  $('.video-actions-menu, .underThumbButtons').after($buttons); // 电脑和手机选择器不一样


  // 下载进度条css
  GM_addStyle(GM_getResourceText('progressCss'));

  // 下载m3u8视频的实现
  unsafeWindow.downloadM3U8= function downloadM3U8(m3u8_link, name = "video") {
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


        const mp4_blob = new Blob(blobParts, { type: "video/mp4" });
        const  mp4_url = URL.createObjectURL(mp4_blob);

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


