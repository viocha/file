// ==UserScript==
// @name        x tool
// @namespace   Violentmonkey Scripts
// @match       https://*.pornhub.com/view_video.php*
// @match       https://*.pornhub.com/interstitial*
// @match       https://*.xhamster.com/videos*
// @match       https://www.xvideos.com/video*
// @require     https://cdn.jsdelivr.net/npm/jquery@3
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @require     https://unpkg.com/xgplayer@latest/dist/index.min.js
// @require     https://unpkg.com/xgplayer-hls@latest/dist/index.min.js
// @require     https://unpkg.com/xgplayer-mp4@latest/dist/index.min.js
// @resource    playerCss https://unpkg.com/xgplayer@3.0.9/dist/index.min.css
// @version     2.13
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

// TODO：验证seek会不会自动播放

const sites = [
	{
		key:'pornhub.com',
		handler:pornhub,
		wrapper:'#player, .playerWrapper',
		controls:'.video-actions-menu, .underThumbButtons',
	},
	{
		key:'xhamster.com',
		handler:xhamster,
		wrapper:'#video_box',
		controls:'[data-role="video-controls"]',
	},
	{
		key:'xvideos',
		handler:xvideos,
		wrapper:'#content',
		controls:'#v-actions-container',
	},
];

for (const {key, handler, wrapper, controls} of sites){
	if (location.host.includes(key)){
		// 隐藏原始播放器
		// language=css
		GM_addStyle(`
      :is(${wrapper}) > :not(#xg-player) {
        display : none !important;
      }
		`);
		
		handler(wrapper, controls);
		break;
	}
}

// TODO ：电脑端原始的声音不能关闭

function pornhub(wrapper, controls){
	// 跳转广告
	if (location.href.includes('interstitial')){
		location.href = location.href.replace('interstitial', 'view_video.php');
		return;
	}
	
	$(()=>{
		const idNum = MGP.getPlayerIds()[0].split('_')[1];
		const data = unsafeWindow[`flashvars_${idNum}`]; // 必须使用unsafeWindow才能访问到
		
		// 视频时长和标题
		const duration = data.video_duration;
		const title = data.video_title;
		// 所有画质的视频链接
		const videoUrls = getVideoUrls(data);
		// 最高画质的视频链接
		const playerUrl = videoUrls[0].url;
		
		// 添加播放器
		const progressDot = getProgressDot(data);
		const player = addPlayer(wrapper, playerUrl, {progressDot});
		
		// ===================用于添加自定义功能的区域===============
		const controlContainer = createControlContainer();
		$(controls).after(controlContainer);
		
		// 缩略图快速跳转
		addFrameList(controlContainer, player, duration);
		// 重点标记快速跳转
		addDotList(controlContainer, player, progressDot);
		// 下载按钮
		addDownloadButtons(controlContainer, videoUrls, title);
	});
	
	function getProgressDot(data){
		return data.actionTags
							 .split(',')
							 .map((x)=>x.split(':'))
							 .map((x)=>({text:x[0], time:+x[1]}));
	}
	
	function getVideoUrls(data){
		return data
				.mediaDefinitions
				.filter(x=>parseInt(x.quality))
				.sort((x, y)=>Number(y.quality)-Number(x.quality)) // 按画质排序
				.map(x=>{
					return {
						quality:`${x.quality}p`,
						// 避免一次请求
						url:x.videoUrl.replace('master.m3u8', 'index-v1-a1.m3u8'),
					};
				});
	}
}

function xhamster(wrapper, controls){
	// language=css
	GM_addStyle(`
    /* 去除顶部广告禁用警告 */
    [data-role="promo-messages-wrapper"] {
      display : none !important;
    }
	`);
	$(()=>{
		const data = unsafeWindow.initials;
		// 视频时长和标题
		const duration = data.xplayerSettings.duration;
		const title = data.videoTitle.pageTitle;
		// 所有画质的视频链接
		const videoUrls = getVideoUrls(data);
		// 最高画质的视频链接
		const playerUrl = videoUrls[0].url;
		
		// 添加播放器
		const player = addPlayer(wrapper, playerUrl, {hls:false});
		
		// ===================用于添加自定义功能的区域===============
		const controlContainer = createControlContainer();
		$(controls).after(controlContainer);
		
		// 缩略图快速跳转
		addFrameList(controlContainer, player, duration, false);
		// 下载按钮
		addDownloadButtons(controlContainer, videoUrls, title);
	});
	
	function getVideoUrls(data){
		return data
				.xplayerSettings.sources.standard.h264
				.filter(x=>parseInt(x.quality))
				.sort((x, y)=>parseInt(y.quality)-parseInt(x.quality)) // 按画质排序
				.map(x=>{
					return {
						quality:x.quality,
						url:x.url,
					};
				});
	}
}

function xvideos(wrapper, controls){
	$(async()=>{
		const data = unsafeWindow.html5player;
		// 视频时长和标题
		const title = data.video_title;
		const duration = +$('meta[property="og:duration"]').attr('content');
		// 所有画质的视频链接
		const videoUrls = await parseM3U8(data.url_hls);
		// 最高画质的视频链接
		const playerUrl = videoUrls[0].url;
		
		// 添加播放器
		const player = addPlayer(wrapper, playerUrl);
		
		// ===================用于添加自定义功能的区域===============
		const controlContainer = createControlContainer();
		$(controls).after(controlContainer);
		
		// 缩略图快速跳转
		addFrameList(controlContainer, player, duration);
		// 下载按钮
		addDownloadButtons(controlContainer, videoUrls, title);
	});
	
	function getVideoUrls(data){
		return data
				.xplayerSettings.sources.standard.h264
				.filter(x=>parseInt(x.quality))
				.sort((x, y)=>parseInt(y.quality)-parseInt(x.quality)) // 按画质排序
				.map(x=>{
					return {
						quality:x.quality,
						url:x.url,
					};
				});
	}
}

// =================各网站通用函数=====================

// 默认弃用hls，播放mp4时需要禁用
function addPlayer(playerWrapper, playerUrl, options = {}){
	const {progressDot, hls = true} = options;
	// 播放器html
	$(playerWrapper).empty().append(`
		 <div id="xg-player"></div>
  `);
	// 播放器css
	GM_addStyle(GM_getResourceText('playerCss'));
	
	// 播放器配置
	const config = {
		id:'xg-player',
		url:playerUrl,
		autoplay:true, // 自动开始播放
		volume:0, // 开始时静音
		playbackRate:false, // 禁用速度设置
		miniprogress:true, // 当控制栏隐藏时，显示底部的小进度条
		fluid:true, // 启用后，不会超出屏幕大小
		mobile:{
			disablePress:false, // 开启长按倍速
			pressRate:3, // 长按3倍速
			gestureY:false, // 禁用手势调节亮度音量
			disableSeekIcon:true, // 禁用seek图标
			disableTimeProgress:true, // 禁用时间进度条
		},
		plugins:[],  // 插件列表
		progressDot, // 视频重点标记
	};
	if (hls){
		config.plugins.push(HlsPlayer); // 播放m3u8链接
	} else {
		config.plugins.push(Mp4Plugin); // 播放mp4链接
	}
	const player = new Player(config);
	unsafeWindow.player = player; // 用于调试
	
	// =====================手机端自动横屏=============================
	const $controls = $('#xg-player > xg-controls');
	document.addEventListener('fullscreenchange', ()=>{
		if (document.fullscreenElement!==null){ // 处于全屏状态
			screen.orientation.lock('landscape'); // 强制横屏
			$controls.css('position', 'fixed');   // 解决控制栏默认会偏移
		} else {
			$controls.css('position', 'absolute');
		}
	});
	
	return player;
}

function createControlContainer(){
	// language=css
	GM_addStyle(`
    #control-container > div { /* 每个功能块 */
      font-size     : 14px;
      font-weight   : bold;
      color         : #70bfff;
      background    : #00000002;
      padding       : 0.1em 0.5em;
      border        : 1px solid dimgray;
      border-radius : 0.3em;
      margin        : 0 0.2em;
      line-height   : 1.5;
    }
	`);
	return $(`<div id="control-container"></div>`)[0];
}

function addDotList(containerSelector, player, progressDot){
	// 重点跳转列表
	const $jumpList = $(`
		<div id="jumpList">
				<div class="jump-list-tile">快速跳转列表：</div>
		</div>
	`);
	$(containerSelector).append($jumpList);
	
	for (const {text, time} of progressDot){
		$jumpList.append(`
			<div class="jumpItem" data-time="${time}">
					<span class="time-label">${formatTime(time)}</span>
					${text}
			</div>
		`);
	}
	
	// 点击事件
	$jumpList.on('click', '.jumpItem', function(){
		const time = $(this).data('time');
		player.seek(time);
	});
	
	// language=css
	GM_addStyle(`
    #jumpList {
      max-height : 10em;
      overflow   : auto;
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
      margin-right  : 1em;
      border-radius : 0.2em;
      padding       : 0 0.2em;
      background    : #484848bd;
      color         : #c76fff;
    }
	`);
}

async function addFrameList(containerSelector, player, duration, hls = true){
	// 获取截图时间列表
	const skip = 5; // 跳过开头的时间
	const size = Math.min(duration-skip, 10);
	const step = Math.floor((duration-skip)/size);
	const timeList = Array.from({length:size}, (_, i)=>skip+i*step);
	
	// 添加到页面
	addCss();
	const $frameListWrapper = $(`
		<div id="frame-list-wrapper">
			画面快速跳转：
			<div id="frame-list"></div>
		</div>
	`);
	$(containerSelector).append($frameListWrapper);
	
	const $list = $frameListWrapper.find('#frame-list');
	// 依次截图，动态生成列表项
	for await (const [time, dataUrl] of captureScreenshots(player.url, timeList, hls)){
		// 列表项
		const $item = $('<div class="frame-item"></div>');
		// 缩略图
		const $img = $(`<img data-time="${time}" class="frame-img" src="${dataUrl}">`);
		$img.on('click', function(){
			player.seek(time);
		});
		// 标注文本
		const $text = $(`<div class="frame-text">${formatTime(time)}</div>`);
		$item.append($img, $text);
		$list.append($item);
	}
	
	function addCss(){
		// language=css
		GM_addStyle(`
      /* 横向滚动列表 */
      #frame-list {
        display        : flex;
        overflow-x     : auto;
        padding-bottom : 10px;
      }

      /* 每个列表项 */
      .frame-item {
        flex          : 0 0 auto;
        margin-right  : 15px;
        border-radius : 5px;
        box-shadow    : 0 2px 5px rgba(0, 0, 0, 0.1);
        cursor        : pointer;
      }

      /* 缩略图 */
      .frame-img {
        width  : min(50vw, 200px); /* 固定宽度 */
        height : auto; /* 高度自适应 */
      }

      /* 文字标注 */
      .frame-text {
        width         : 100%;
        border-radius : 0 0 0.2em 0.2em;
        text-align    : center;
        font-size     : 14px;
        background    : #484848bd;
        color         : #c76fff;
      }
		`);
	}
}

function addDownloadButtons(containerSelector, videoUrls, title){
	const $buttonContainer = $(`
    <div id="downloadUrls">
      下载链接：
    </div>`);
	$(containerSelector).append($buttonContainer);
	
	// 所有画质的下载链接
	const links = videoUrls
			.map(
					x=>`<a class="video-download"
									href="${x.url}"
									onclick="return false;"
                  download="${title}.mp4" >
                ${x.quality}
              </a>`,
			)
			.join('\n');
	$buttonContainer.append(links);
	
	// 复制标题按钮
	const $copyButton = $(`<button id="titleCopy">复制标题</button>`).on('click', ()=>{
		navigator.clipboard.writeText(title);
	});
	$buttonContainer.append($copyButton);
	
	// 下载按钮样式
	// language=css
	GM_addStyle(`
    div#downloadUrls > :is(a,button) {
      display          : inline-block;
      font-weight      : bold;
      font-size        : 14px;
      line-height      : 1.5;
      border           : 1px solid rgb(255, 144, 0);
      border-radius    : 0.3em;
      padding          : 0.1em 0.4em;
      margin           : 0.1em 0.3em;
      min-width        : 3em;
      text-align       : center;
      background-color : transparent;
      color            : rgb(255, 144, 0);
      text-decoration  : none;
    }
	`);
}

async function* captureScreenshots(videoUrl, timeList, hls){
	const config = {
		el:$('<div></div>')[0],
		url:videoUrl,
		seekedStatus:'pause', // seek操作之后暂停
	};
	if (hls){
		Object.assign(config, {
			plugins:[HlsPlayer],
			hls:{
				preloadTime:1, // 预加载1秒
			},
		});
	} else {
		Object.assign(config, {
			plugins:[Mp4Plugin],
			mp4plugin:{
				maxBufferLength:1,
				minBufferLength:1,
			},
		});
	}
	const player = new Player(config);
	player.seek(0); // 启动数据加载
	await new Promise((resolve, reject)=>{
		player.on(Player.Events.CANPLAY, resolve);
		setTimeout(reject, 10000, '视频加载超时');
	});
	for (const time of timeList){
		player.seek(time);
		if (!player.isCanPlay){
			await new Promise((resolve, reject)=>{
				player.on(Player.Events.CANPLAY, resolve);
				setTimeout(reject, 10000, '视频加载超时');
			});
		}
		const imgDataUrl = await player.getPlugin('screenShot')
																	 .shot(player.video.videoWidth, player.video.videoHeight,
																			 {quality:1, type:'image/jpg'});
		yield [time, imgDataUrl];
	}
}

// 从m3u8入口解析出所有分辨率的m3u8链接
async function parseM3U8(url){
	// 获取 m3u8 文件内容
	const text = await fetch(url).then(r=>r.text());
	// 按行分割内容
	const lines = text.split('\n');
	
	const result = [];
	let quality = ''; // 用于存储当前分辨率
	for (const line of lines){
		if (line.startsWith('#EXT-X-STREAM-INF')){ // 匹配分辨率
			const match = line.match(/NAME="(.+)"/);
			quality = match[1];
		} else if (line.endsWith('.m3u8')){ // 解析子 m3u8 链接
			const absoluteUrl = new URL(line, url).href; // 处理相对路径
			result.push({quality, url:absoluteUrl});
		}
	}
	// 按画质排序
	return result.sort((x, y)=>parseInt(y.quality)-parseInt(x.quality));
}

function formatTime(time){
	const minutes = Math.floor(time/60).toString().padStart(2, '0');
	const seconds = (time%60).toString().padStart(2, '0');
	return `${minutes}:${seconds}`;
}

$(main);

async function main(){
}

// ====================弃用的函数==========================

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
