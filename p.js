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
// @version     1.11
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

$(()=>{
	$(document.body).prepend($('<button>测试下载</button>').on('click', ()=>{
		// 测试下载
		GM_download({
			name:'test.jpg',
			url:'https://ei.phncdn.com/videos/202501/05/462769881/timeline/120x90/(m=eyzaiCObaaaa)(mh=mJYTv2br_xJBGnNk)S5.jpg',
		});
	}));
});

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
	const flashvars = unsafeWindow[`flashvars_${idNum}`]; // 必须使用unsafeWindow才能访问到
	const videoList = flashvars.mediaDefinitions
														 .filter(x=>x.quality.constructor===String && parseInt(x.quality))
														 .sort((x, y)=>Number(y.quality)-Number(x.quality)); // 按画质排序
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
		plugins:[HlsPlayer], // 插件列表，支持hls播放m3u8链接
	};
	
	// 视频重点标记
	config.progressDot = flashvars.actionTags
																.split(',')
																.map((x)=>x.split(':'))
																.map((x)=>({text:x[0], time:+x[1]}));
	
	const player = new Player(config);
	unsafeWindow.player = player;
	
	// =====================自动横屏=============================
	const $controls = $('#mse > xg-controls');
	document.addEventListener('fullscreenchange', ()=>{
		if (document.fullscreenElement!==null){ // 处于全屏状态
			screen.orientation.lock('landscape'); // 强制横屏
			$controls.css('position', 'fixed');   // 解决控制栏默认会偏移
		} else {
			$controls.css('position', 'absolute');
		}
	});
	
	// =======================缩略图设置=============================
	
	// 预览图
	const urlPattern = flashvars.thumbs.urlPattern;
	const maxNum = +urlPattern.match(/{(\d+)}/)[1];
	const thumbUrls = [];
	// 截图拼接而成的网格图，每一张包含5x5张截图，最后一张可能不完整
	// 采样率为9秒一张
	for (let i = 0; i<=maxNum; i++){
		thumbUrls.push(urlPattern.replace(/{\d+}/, i));
	}
	
	// 拼接成一张视频预览图，然后上传到图床，获取url
	let totalCount, uploadedUrl;
	// if($('#hd-leftColVideoPage').length){ // 无效！
	//   totalCount = maxNum * 25 + (await getThumbCount(thumbUrls.at(-1)));
	//   const blob = await concatenateImages(thumbUrls);
	//   uploadedUrl = await uploadImage(blob);
	//   console.log(uploadedUrl);
	// }
	// ====================缩略图快速跳转=================== TODO
	
	// ===================重点标记快速跳转=================== TODO
	// 创建一个列表，列表的wrapper的最大高度10em限制，允许滚动，每个列表项点击之后能够跳转到对应的视频时间点，点击有动画效果
	const $jumpList = $(`<div id="jumpList">
		<div class="jump-list-tile">快速跳转列表：</div>
	</div>`);
	for (const {text, time} of config.progressDot){
		// 用0填充直到两位数
		const minutes = Math.floor(time/60).toString().padStart(2, '0');
		const seconds = (time%60).toString().padStart(2, '0');
		$jumpList.append(`<div class="jumpItem" data-time="${time}">
					<span class="time-label">${minutes}:${seconds} </span>
					${text}
				</div>`);
	}
	$('.video-actions-menu, .underThumbButtons').after($jumpList);
	// language=css
	GM_addStyle(`
    #jumpList {
      max-height    : 10em;
      overflow      : auto;
      font-weight   : bold;
      color         : lightgreen;
      padding       : 0.1em 0.5em;
      border        : 1px solid dimgray;
      border-radius : 0.3em;
      margin        : 0 0.2em;
    }

    #jumpList > .jump-list-tile {
      font-weight : bold;
      color       : lightgreen;
    }

    .jumpItem {
      padding          : 0.2em 0.5em;
      margin           : 0.1em 0.3em;
      border           : 1px solid #ff9000;
      border-radius    : 0.3em;
      cursor           : pointer;
      background-color : transparent;
      color            : #ff9000;
    }

    .jumpItem .time-label {
      margin-right : 1em;
    }
	`);
	// 点击事件
	$jumpList.on('click', '.jumpItem', function(){
		const time = $(this).data('time');
		player.seek(time);
	});
	
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
	// language=css
	GM_addStyle(`
    #downloadUrls {
      font-weight   : bold;
      color         : lightgreen;
      padding       : 0.1em 0.5em;
      border        : 1px solid dimgray;
      border-radius : 0.3em;
      margin        : 0 0.2em;
    }

    div#downloadUrls > :is(a,button) {
      border           : 1px solid rgb(255, 144, 0);
      border-radius    : 0.3em;
      padding          : 0.1em 0.4em;
      margin           : 0.1em 0.3em;
      min-width        : 3em;
      text-align       : center;
      background-color : transparent;
      color            : rgb(255, 144, 0);
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
