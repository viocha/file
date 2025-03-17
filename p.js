// ==UserScript==
// @name        ph工具
// @namespace   Violentmonkey Scripts
// @match       https://*.pornhub.com/view_video.php*
// @match       https://*.pornhub.com/interstitial*
// @require     https://cdn.jsdelivr.net/npm/jquery@3
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @require     https://unpkg.com/xgplayer@latest/dist/index.min.js
// @require     https://unpkg.com/xgplayer-hls@latest/dist/index.min.js
// @resource    playerCss https://unpkg.com/xgplayer@3.0.9/dist/index.min.css
// @version     1.6
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

// TODO ：电脑端原始的声音不能关闭

// 跳转广告
if (location.href.includes('interstitial')){
	location.href = location.href.replace('interstitial', 'view_video.php');
	return;
}

// 隐藏原始播放器
GM_addStyle(`
:is(#player, .playerWrapper) > :not(#xgplayer){
  display:none !important;
}
`);

$(main);

async function main(){
	// 获取视频链接并按画质排序
	const idNum = MGP.getPlayerIds()[0].split('_')[1];
	const flashvars = unsafeWindow[`flashvars_${idNum}`];
	const videoList = flashvars.mediaDefinitions
														 .filter(x=>x.quality.constructor===String && parseInt(x.quality))
														 .sort((x, y)=>Number(y.quality)-Number(x.quality)); // 按画质排序
	for (const x of videoList){ // 避免一次请求
		x.videoUrl = x.videoUrl.replace('master.m3u8', 'index-v1-a1.m3u8');
	}
	// 最高画质的视频链接
	const firstUrl = videoList[0].videoUrl;
	
	//=======================西瓜播放器==============================================
	// 播放器css
	GM_addStyle(GM_getResourceText('playerCss'));
	// 播放器html
	$('#player, .playerWrapper').empty().append(`
   <div id="xgplayer"></div>
  `);
	
	const config = {
		id:'xgplayer',
		url:firstUrl,
		autoplay:true, // 自动开始播放
		volume:0, // 开始时静音
		playbackRate:false, // 禁用速度设置
		miniprogress:true, // 当控制栏隐藏时，显示底部的小进度条
		fluid:true, // 启用后，不会超出屏幕大小
		fullscreen:{
			useScreenOrientation:true, // 移动端全屏时强制旋转成横屏
			target:$('#xgplayer')[0], // 全屏时的目标元素
		},
		plugins:[HlsPlayer], // 插件列表，支持hls播放m3u8链接
	};
	
	// 视频重点标记
	config.progressDot = flashvars.actionTags
																.split(',')
																.map((x)=>x.split(':'))
																.map((x)=>({text:x[0], time:+x[1]}));
	
	unsafeWindow.player = new Player(config);
	
	// =====================自动横屏=============================
	// const $controls = $('#mse > xg-controls');
	// document.addEventListener('fullscreenchange', ()=>{
	// 	if (document.fullscreenElement!==null){ // 处于全屏状态
	// 		screen.orientation.lock('landscape'); // 强制横屏
	// 		$controls.css('position', 'fixed');
	// 	} else {
	// 		$controls.css('position', 'absolute');
	// 	}
	// });
	
	// =======================缩略图设置=============================
	
	// 预览图
	const urlPattern = flashvars.thumbs.urlPattern;
	const maxNum = +urlPattern.match(/{(\d+)}/)[1];
	const thumbUrls = [];
	for (let i = 0; i<=maxNum; i++){
		thumbUrls.push(urlPattern.replace(/{\d+}/, i));
	}
	
	// 视频预览图
	let totalCount, uploadedUrl;
	// if($('#hd-leftColVideoPage').length){ // 无效！
	//   totalCount = maxNum * 25 + (await getThumbCount(thumbUrls.at(-1)));
	//   const blob = await concatenateImages(thumbUrls);
	//   uploadedUrl = await uploadImage(blob);
	//   console.log(uploadedUrl);
	// }
	
	// ====================下载按钮=========================
	
	// 构建下载按钮html
	const title = flashvars.video_title;
	const videoUrls = videoList
			.map(
					(x)=>`<a class="video-download" href="${x.videoUrl}" onclick="return false;"
                    download="${title}.mp4" >
                ${x.quality}p
                </a>`,
			)
			.join('\n');
	
	const divHtml = `
    <div id="downloadUrls">
      下载链接：${videoUrls}
      <button id="titleCopy">复制标题</button>
    </div>`;
	
	const $buttons = $(divHtml);
	$buttons.find('#titleCopy').on('click', ()=>{
		navigator.clipboard.writeText(title);
	});
	
	$('.video-actions-menu, .underThumbButtons').after($buttons); // 电脑和手机选择器不一样
	
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

// 获取最后一张图片的缩略图个数
async function getThumbCount(imageUrl){
	return new Promise((resolve, reject)=>{
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = imageUrl;
		
		function onload(){
			const canvas = document.createElement('canvas');
			canvas.width = this.width;
			canvas.height = this.height;
			let ctx = canvas.getContext('2d');
			
			ctx.drawImage(this, 0, 0, this.width, this.height);
			
			let count = 0;
			for (let i = 0; i<5; i++){
				for (let j = 0; j<5; j++){
					if (getAveragePixel(ctx, i, j).toString()!=='0,0,0,255'){
						count++;
					}
				}
			}
			
			resolve(count);
		}
		
		if (img.complete) onload.apply(img);
		else img.onload = onload;
		
		img.onerror = function(){
			reject(new Error('Image failed to load'));
		};
	});
	
	// 获取一个区域的平均像素值
	function getAveragePixel(ctx, i, j){
		let pixelData = [0, 0, 0, 0];
		let count = 0;
		for (let x = 10; x<150; x++)
			for (let y = 10; y<80; y++){
				pixelData = arrayAdd(
						pixelData,
						ctx.getImageData(i*160+x, j*90+y, 1, 1).data,
				);
				count++;
			}
		
		for (let k = 0; k<pixelData.length; k++){
			pixelData[k] = pixelData[k]/count;
		}
		
		return pixelData;
		
		function arrayAdd(x, y){
			const r = [];
			for (let i = 0; i<x.length; i++){
				r[i] = x[i]+y[i];
			}
			return r;
		}
	}
}

// 通过canvas上下拼接图片
async function concatenateImages(imageUrls){
	const canvas = document.createElement('canvas');
	canvas.width = 800;
	canvas.height = 450*imageUrls.length;
	const ctx = canvas.getContext('2d');
	
	let total_height = 0;
	for (let i = 0; i<imageUrls.length; i++){
		await new Promise((resolve, reject)=>{
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.src = imageUrls[i];
			
			function onload(){
				total_height += img.height; // 要保证画布位置充足
				ctx.drawImage(img, 0, total_height-img.height);
				resolve();
			}
			
			if (img.complete){
				onload();
			} else {
				img.onload = onload;
			}
		});
	}
	
	// return canvas.toDataURL(); // 得到最终的图片url
	return new Promise((resolve)=>canvas.toBlob(resolve));
}

// 上传图片到图床
async function uploadImage(blob){
	const fd = new FormData();
	fd.append('source', blob);
	fd.append('type', 'file');
	fd.append('action', 'upload');
	fd.append('expiration', 'P1D');
	return fetch('https://zh-cn.imgbb.com/json', {
		method:'post',
		body:fd,
	}).then(r=>r.json()).then(j=>j.image.display_url);
}
