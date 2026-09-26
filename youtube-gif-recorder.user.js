// ==UserScript==
// @name         방송 플랫폼 녹화 · 스크린샷 · 움짤 생성
// @namespace    http://tampermonkey.net/
// @version      1.1.1
// @description  유튜브·트위치·치지직 플레이어 컨트롤바에 녹화/스크린샷/움짤/OCR영역지정 버튼 추가. 유튜브 쇼츠는 플로팅 버튼으로 지원(컨트롤바 넘침 방지). 단축키 커스터마이징 가능 (기본값: 녹화 F9, 스크린샷 F10, 움짤 F8). 움짤 자동 생성 옵션 지원. GIF 고화질(gifski) 옵션 지원. OCR 영역 지정 시 드래그로 선택한 영역만 녹화/움짤/스크린샷으로 캡처.
// @match        https://www.youtube.com/*
// @match        https://www.twitch.tv/*
// @match        https://chzzk.naver.com/*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @noframes
// @updateURL   https://raw.githubusercontent.com/hawted/youtube-gif-recorder.user/main/youtube-gif-recorder.user.js
// @downloadURL https://raw.githubusercontent.com/hawted/youtube-gif-recorder.user/main/youtube-gif-recorder.user.js
// ==/UserScript==

// ===============================================================
// 설정
// ===============================================================

const DEFAULT_SETTINGS = {
    fps: 10,
    width: 480,
    quality: 10,
    format: 'gif',
    webpLossless: false,
    gifQuality: 'normal', // 'normal' | 'high'(gifski)
    autoGenerate: false,
    bitrateMbps: 4,
    keyRecord: 'F9',
    keyScreenshot: 'F10',
    keyGif: 'F8',
    keyCrop: 'F7',
};

const FPS_PRESETS = [10, 15, 20, 25, 30, 40, 60];
const WIDTH_PRESETS = [640, 720, 960, 1280, 1440, 1600, 1920];
const QUALITY_PRESETS = [1, 5, 10, 15, 20];
const BITRATE_PRESETS = [1, 2, 3, 4, 8, 12, 20]; // Mbps, 'auto'는 해상도별 기존 로직 사용

// ===============================================================
// 설정 불러오기 / 저장
// ===============================================================

function loadSettings() {
    try {
        const raw = GM_getValue('yt-gif-settings', null);

        if (!raw) {
            return { ...DEFAULT_SETTINGS };
        }

        const p = JSON.parse(raw);

        return {
            fps: Number(p.fps) > 0 ? Number(p.fps) : DEFAULT_SETTINGS.fps,

            width: Number(p.width) >= 0 ? Number(p.width) : DEFAULT_SETTINGS.width,

            quality: Number(p.quality) >= 1 ? Number(p.quality) : DEFAULT_SETTINGS.quality,

            format: p.format === 'webp' ? 'webp' : 'gif',

            webpLossless: p.webpLossless === true,

            gifQuality: p.gifQuality === 'high' ? 'high' : 'normal',

            autoGenerate: p.autoGenerate === true,

            bitrateMbps:
                p.bitrateMbps === 'auto' || Number(p.bitrateMbps) > 0
                    ? p.bitrateMbps === 'auto'
                        ? 'auto'
                        : Number(p.bitrateMbps)
                    : DEFAULT_SETTINGS.bitrateMbps,

            keyRecord:
                typeof p.keyRecord === 'string' && p.keyRecord
                    ? p.keyRecord
                    : DEFAULT_SETTINGS.keyRecord,

            keyScreenshot:
                typeof p.keyScreenshot === 'string' && p.keyScreenshot
                    ? p.keyScreenshot
                    : DEFAULT_SETTINGS.keyScreenshot,

            keyGif: typeof p.keyGif === 'string' && p.keyGif ? p.keyGif : DEFAULT_SETTINGS.keyGif,

            keyCrop: typeof p.keyCrop === 'string' && p.keyCrop ? p.keyCrop : DEFAULT_SETTINGS.keyCrop,
        };
    } catch (e) {
        return {
            ...DEFAULT_SETTINGS,
        };
    }
}

function saveSettings(s) {
    GM_setValue('yt-gif-settings', JSON.stringify(s));
}

let gifSettings = loadSettings();

// ===============================================================
// Select 옵션 생성
// ===============================================================

function buildFpsOptionsHtml(selected) {
    let html = '';

    FPS_PRESETS.forEach((v) => {
        html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
    });

    html += `<option value="custom"${FPS_PRESETS.includes(selected) ? '' : ' selected'}>직접 입력</option>`;

    return html;
}

function buildWidthOptionsHtml(selected) {
    let html = '';

    WIDTH_PRESETS.forEach((v) => {
        html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
    });

    html += `<option value="0"${selected === 0 ? ' selected' : ''}>원본</option>`;

    html += `<option value="custom"${WIDTH_PRESETS.includes(selected) || selected === 0 ? '' : ' selected'}>직접 입력</option>`;

    return html;
}

function buildQualityOptionsHtml(selected) {
    let html = '';

    QUALITY_PRESETS.forEach((v) => {
        html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
    });

    html += `<option value="custom"${QUALITY_PRESETS.includes(selected) ? '' : ' selected'}>직접 입력</option>`;

    return html;
}

function buildFormatOptionsHtml(selected) {
    return (
        `<option value="gif"${selected === 'gif' ? ' selected' : ''}>GIF</option>` +
        `<option value="webp"${selected === 'webp' ? ' selected' : ''}>WebP</option>`
    );
}

function buildBitrateOptionsHtml(selected) {
    let html = '';

    html += `<option value="auto"${selected === 'auto' ? ' selected' : ''}>자동(해상도별)</option>`;

    BITRATE_PRESETS.forEach((v) => {
        html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v} Mbps</option>`;
    });

    html += `<option value="custom"${selected !== 'auto' && !BITRATE_PRESETS.includes(selected) ? ' selected' : ''}>직접 입력</option>`;

    return html;
}

function buildWebpCompressionOptionsHtml(lossless) {
    return (
        `<option value="lossy"${!lossless ? ' selected' : ''}>손실</option>` +
        `<option value="lossless"${lossless ? ' selected' : ''}>무손실</option>`
    );
}

function buildGifQualityOptionsHtml(mode) {
    return (
        `<option value="normal"${mode !== 'high' ? ' selected' : ''}>일반</option>` +
        `<option value="high"${mode === 'high' ? ' selected' : ''}>고화질 (느림, gifski)</option>`
    );
}

// ===============================================================
// Trusted Types
// ===============================================================

const ttPolicySettings =
    window.trustedTypes && trustedTypes.createPolicy
        ? trustedTypes.createPolicy('yt-gif-settings', {
              createHTML: (s) => s,
          })
        : {
              createHTML: (s) => s,
          };

// ===============================================================
// 설정창
// ===============================================================

function openSettingsPanel() {
    if (document.getElementById('yt-gif-settings-overlay')) {
        return;
    }

    const overlay = document.createElement('div');

    overlay.id = 'yt-gif-settings-overlay';

    overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#fff;';

    const panel = document.createElement('div');

    panel.style.cssText =
        'background:#181818;border-radius:12px;padding:20px;width:min(360px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.5);';

    overlay.appendChild(panel);

    panel.innerHTML = ttPolicySettings.createHTML(`

        <h2 style="margin:0 0 14px;font-size:16px;">
            움짤(GIF/WebP) 기본값 설정
        </h2>

        <label style="font-size:13px;display:block;margin-bottom:10px;">
            기본 FPS

            <input
                id="yt-gif-setting-fps"
                type="number"
                min="1"
                step="1"
                value="${gifSettings.fps}"
                style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
            />
        </label>

        <label style="font-size:13px;display:block;margin-bottom:16px;">
            기본 가로 크기(px, 0=원본)

            <input
                id="yt-gif-setting-width"
                type="number"
                min="0"
                step="10"
                value="${gifSettings.width}"
                style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
            />
        </label>

        <div
            id="yt-gif-setting-quality-wrap"
            style="margin-bottom:16px;"
        >

            <label style="font-size:13px;display:block;">
                화질(1=최고화질~느림, 20=저화질~빠름)

                <input
                    id="yt-gif-setting-quality"
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value="${gifSettings.quality}"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
                />
            </label>

        </div>

        <label style="font-size:13px;display:block;margin-bottom:16px;">
            기본 저장 형식

            <select
                id="yt-gif-setting-format"
                style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
            >
                ${buildFormatOptionsHtml(gifSettings.format)}
            </select>
        </label>

        <div
            id="yt-gif-setting-gifquality-wrap"
            style="display:${gifSettings.format === 'gif' ? 'block' : 'none'};margin-bottom:16px;"
        >

            <label style="font-size:13px;display:block;">

                GIF 화질 모드

                <select
                    id="yt-gif-setting-gifquality"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
                >
                    ${buildGifQualityOptionsHtml(gifSettings.gifQuality)}
                </select>

            </label>

        </div>

        <div
            id="yt-gif-setting-webp-wrap"
            style="display:${gifSettings.format === 'webp' ? 'block' : 'none'};margin-bottom:16px;"
        >

            <label style="font-size:13px;display:block;">

                WebP 압축 방식

                <select
                    id="yt-gif-setting-webp"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
                >
                    ${buildWebpCompressionOptionsHtml(gifSettings.webpLossless)}
                </select>

            </label>

        </div>

        <label style="font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;">
            <input
                id="yt-gif-setting-auto"
                type="checkbox"
                ${gifSettings.autoGenerate ? 'checked' : ''}
                style="width:16px;height:16px;"
            />
            자동 생성 (편집창 없이 저장된 설정으로 바로 저장)
        </label>

        <div style="border-top:1px solid #333;margin:4px 0 16px;padding-top:14px;">

            <div style="font-size:13px;font-weight:bold;margin-bottom:10px;color:#aaa;">
                단축키 설정 (입력칸 클릭 후 원하는 키를 누르세요)
            </div>

            <label style="font-size:13px;display:block;margin-bottom:10px;">
                녹화 단축키

                <input
                    id="yt-gif-setting-key-record"
                    type="text"
                    readonly
                    value="${gifSettings.keyRecord}"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;cursor:pointer;text-align:center;"
                />
            </label>

            <label style="font-size:13px;display:block;margin-bottom:6px;">
                녹화 비트레이트 <span style="color:#888;font-weight:normal;">(움짤은 항상 원본 화질)</span>

                <select
                    id="yt-gif-setting-bitrate"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;"
                >
                    ${buildBitrateOptionsHtml(gifSettings.bitrateMbps)}
                </select>
            </label>

            <input
                id="yt-gif-setting-bitrate-custom"
                type="number"
                min="1"
                step="1"
                placeholder="Mbps 직접 입력"
                value="${typeof gifSettings.bitrateMbps === 'number' ? gifSettings.bitrateMbps : 4}"
                style="display:${gifSettings.bitrateMbps !== 'auto' && !BITRATE_PRESETS.includes(gifSettings.bitrateMbps) ? 'block' : 'none'};margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;margin-bottom:16px;"
            />

            <label style="font-size:13px;display:block;margin-bottom:10px;">
                스크린샷 단축키

                <input
                    id="yt-gif-setting-key-screenshot"
                    type="text"
                    readonly
                    value="${gifSettings.keyScreenshot}"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;cursor:pointer;text-align:center;"
                />
            </label>

            <label style="font-size:13px;display:block;">
                움짤 단축키

                <input
                    id="yt-gif-setting-key-gif"
                    type="text"
                    readonly
                    value="${gifSettings.keyGif}"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;cursor:pointer;text-align:center;"
                />
            </label>

            <label style="font-size:13px;display:block;margin-top:10px;">
                OCR 영역 지정/해제 단축키

                <input
                    id="yt-gif-setting-key-crop"
                    type="text"
                    readonly
                    value="${gifSettings.keyCrop}"
                    style="display:block;margin-top:4px;width:100%;box-sizing:border-box;background:#111;color:#fff;border:1px solid #444;border-radius:4px;padding:6px;cursor:pointer;text-align:center;"
                />
            </label>

        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">

            <button
                id="yt-gif-setting-cancel"
                style="border:none;border-radius:6px;padding:8px 18px;font-size:14px;color:#fff;cursor:pointer;font-weight:bold;background:#3d3d3d;"
            >
                취소
            </button>

            <button
                id="yt-gif-setting-save"
                style="border:none;border-radius:6px;padding:8px 18px;font-size:14px;color:#fff;cursor:pointer;font-weight:bold;background:#3ea6ff;"
            >
                저장
            </button>

        </div>

    `);

    document.body.appendChild(overlay);

    const formatSelect = panel.querySelector('#yt-gif-setting-format');

    const webpWrap = panel.querySelector('#yt-gif-setting-webp-wrap');

    const gifQualityWrap = panel.querySelector('#yt-gif-setting-gifquality-wrap');

    const qualityWrap = panel.querySelector('#yt-gif-setting-quality-wrap');

    const webpSelect = panel.querySelector('#yt-gif-setting-webp');

    const gifQualitySelect = panel.querySelector('#yt-gif-setting-gifquality');

    function updateSettingsWebpUI() {
        const isWebp = formatSelect.value === 'webp';

        const isGif = formatSelect.value === 'gif';

        const isWebpLossless = isWebp && webpSelect.value === 'lossless';

        const isGifHighQuality = isGif && gifQualitySelect.value === 'high';

        webpWrap.style.display = isWebp ? 'block' : 'none';

        gifQualityWrap.style.display = isGif ? 'block' : 'none';

        qualityWrap.style.display = isWebpLossless || isGifHighQuality ? 'none' : 'block';
    }

    formatSelect.addEventListener('change', updateSettingsWebpUI);

    webpSelect.addEventListener('change', updateSettingsWebpUI);

    gifQualitySelect.addEventListener('change', updateSettingsWebpUI);

    updateSettingsWebpUI();

    const bitrateSelect = panel.querySelector('#yt-gif-setting-bitrate');

    const bitrateCustomInput = panel.querySelector('#yt-gif-setting-bitrate-custom');

    function updateBitrateCustomUI() {
        bitrateCustomInput.style.display = bitrateSelect.value === 'custom' ? 'block' : 'none';
    }

    bitrateSelect.addEventListener('change', updateBitrateCustomUI);

    // -------------------------------------------------------
    // 단축키 캡처
    // -------------------------------------------------------

    function normalizeKeyLabel(e) {
        return e.key.length === 1 ? e.key.toUpperCase() : e.key;
    }

    function bindKeyCapture(inputEl) {
        inputEl.addEventListener('click', () => {
            if (inputEl.dataset.capturing === '1') {
                return;
            }

            inputEl.dataset.capturing = '1';

            const original = inputEl.value;

            inputEl.value = '키를 눌러주세요... (Esc: 취소)';

            inputEl.style.color = '#3ea6ff';

            function onKey(e) {
                e.preventDefault();

                e.stopPropagation();

                if (e.key === 'Escape') {
                    inputEl.value = original;
                } else {
                    inputEl.value = normalizeKeyLabel(e);
                }

                inputEl.style.color = '#fff';

                inputEl.dataset.capturing = '';

                document.removeEventListener('keydown', onKey, true);
            }

            document.addEventListener('keydown', onKey, true);
        });
    }

    const keyRecordInput = panel.querySelector('#yt-gif-setting-key-record');

    const keyScreenshotInput = panel.querySelector('#yt-gif-setting-key-screenshot');

    const keyGifInput = panel.querySelector('#yt-gif-setting-key-gif');

    const keyCropInput = panel.querySelector('#yt-gif-setting-key-crop');

    bindKeyCapture(keyRecordInput);

    bindKeyCapture(keyScreenshotInput);

    bindKeyCapture(keyGifInput);

    bindKeyCapture(keyCropInput);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    panel.querySelector('#yt-gif-setting-cancel').addEventListener('click', () => overlay.remove());

    panel.querySelector('#yt-gif-setting-save').addEventListener('click', () => {
        const fps = parseInt(panel.querySelector('#yt-gif-setting-fps').value, 10);

        const width = parseInt(panel.querySelector('#yt-gif-setting-width').value, 10);

        const quality = parseInt(panel.querySelector('#yt-gif-setting-quality').value, 10);

        const format = formatSelect.value === 'webp' ? 'webp' : 'gif';

        const webpLossless = panel.querySelector('#yt-gif-setting-webp').value === 'lossless';

        const gifQuality =
            panel.querySelector('#yt-gif-setting-gifquality').value === 'high' ? 'high' : 'normal';

        const keyRecord = keyRecordInput.value;

        const keyScreenshot = keyScreenshotInput.value;

        const keyGif = keyGifInput.value;

        const keyCrop = keyCropInput.value;

        const autoGenerate = panel.querySelector('#yt-gif-setting-auto').checked;

        const bitrateMbps =
            bitrateSelect.value === 'auto'
                ? 'auto'
                : bitrateSelect.value === 'custom'
                  ? parseFloat(bitrateCustomInput.value)
                  : parseFloat(bitrateSelect.value);

        if (bitrateMbps !== 'auto' && (isNaN(bitrateMbps) || bitrateMbps <= 0)) {
            alert('비트레이트를 올바르게 입력해주세요.');

            return;
        }

        if (isNaN(fps) || fps <= 0) {
            alert('FPS를 올바르게 입력해주세요.');

            return;
        }

        if (isNaN(width) || width < 0) {
            alert('가로 크기를 올바르게 입력해주세요.');

            return;
        }

        if (isNaN(quality) || quality < 1 || quality > 20) {
            alert('화질 값은 1~20 사이로 입력해주세요.');

            return;
        }

        if (
            !keyRecord ||
            !keyScreenshot ||
            !keyGif ||
            !keyCrop ||
            keyRecord.includes('눌러주세요') ||
            keyScreenshot.includes('눌러주세요') ||
            keyGif.includes('눌러주세요') ||
            keyCrop.includes('눌러주세요')
        ) {
            alert('단축키를 모두 설정해주세요.');

            return;
        }

        if (
            new Set([keyRecord, keyScreenshot, keyGif, keyCrop]).size !== 4
        ) {
            alert('단축키는 서로 겹치지 않게 설정해주세요.');

            return;
        }

        gifSettings = {
            fps,
            width,
            quality,
            format,
            webpLossless,
            gifQuality,
            autoGenerate,
            bitrateMbps,
            keyRecord,
            keyScreenshot,
            keyGif,
            keyCrop,
        };

        saveSettings(gifSettings);

        document.dispatchEvent(new CustomEvent('yt-gif-settings-updated'));

        overlay.remove();
    });
}

if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('움짤(GIF/WebP) 기본값 설정', openSettingsPanel);
}

// ===============================================================
// 메인
// ===============================================================

(function () {
    'use strict';

    const ttPolicy =
        window.trustedTypes && trustedTypes.createPolicy
            ? trustedTypes.createPolicy('yt-gif-editor', {
                  createHTML: (s) => s,
                  createScriptURL: (s) => s,
              })
            : {
                  createHTML: (s) => s,
                  createScriptURL: (s) => s,
              };

    // ===========================================================
    // 파일명 관련
    // ===========================================================

    function getYouTubeVideoTitle() {
        let title = '';

        // 유튜브 플레이어 제목 우선
        const playerTitle = document.querySelector('.ytp-title-link');

        if (playerTitle && playerTitle.textContent.trim()) {
            title = playerTitle.textContent.trim();
        }

        // 트위치 방송 제목
        if (!title) {
            const twitchTitle = document.querySelector('[data-a-target="stream-title"]');

            if (twitchTitle && twitchTitle.textContent.trim()) {
                title = twitchTitle.textContent.trim();
            }
        }

        // 위에서 못 찾으면 document.title 사용 (사이트명 접미사 제거)
        if (!title) {
            title = document.title.replace(/\s*-\s*(YouTube|Twitch|CHZZK)\s*$/i, '').trim();
        }

        if (!title) {
            title = 'YouTube';
        }

        /*
         * Windows 파일명에서 사용할 수 없는 문자 제거
         *
         * < > : " / \ | ? *
         * 제어문자도 제거
         */
        title = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

        /*
         * 파일명 앞뒤 공백 제거
         * Windows에서 문제가 될 수 있는 끝의 점 제거
         */
        title = title
            .replace(/^\s+|\s+$/g, '')
            .replace(/\.+$/g, '')
            .trim();

        if (!title) {
            title = 'YouTube';
        }

        /*
         * Windows 예약 파일명 방지
         */
        if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(title)) {
            title = '_' + title;
        }

        return title;
    }

    function getChannelName() {
        let name = '';

        const ytChannel =
            document.querySelector('#channel-name #text a') ||
            document.querySelector('#channel-name yt-formatted-string a') ||
            document.querySelector('#upload-info #channel-name a') ||
            document.querySelector('ytd-channel-name a');

        if (ytChannel && ytChannel.textContent.trim()) {
            name = ytChannel.textContent.trim();
        }

        if (!name) {
            const twitchChannel =
                document.querySelector('[data-a-target="channel-header-link"] h1') ||
                document.querySelector('.channel-info-content h1');

            if (twitchChannel && twitchChannel.textContent.trim()) {
                name = twitchChannel.textContent.trim();
            }
        }

        if (!name) {
            const chzzkChannel =
                document.querySelector('[class*="channel_name"]') ||
                document.querySelector('[class*="ChannelName"]');

            if (chzzkChannel && chzzkChannel.textContent.trim()) {
                name = chzzkChannel.textContent.trim();
            }
        }

        // 유튜브 쇼츠: 현재 활성 쇼츠 패널 안에서 @핸들 링크를 탐색
        if (!name) {
            const activeReel =
                document.querySelector('ytd-reel-video-renderer[is-active]') ||
                document.querySelector('ytd-shorts #shorts-player');

            const shortsChannel = activeReel
                ? activeReel.querySelector('a[href^="/@"]')
                : document.querySelector('ytd-reel-video-renderer a[href^="/@"]') ||
                  document.querySelector('a[href^="/@"]');

            if (shortsChannel && shortsChannel.textContent.trim()) {
                name = shortsChannel.textContent.trim();
            }
        }

        if (!name) {
            name = document.title.replace(/\s*-\s*(YouTube|Twitch|CHZZK)\s*$/i, '').trim();
        }

        if (!name) {
            name = 'Unknown';
        }

        name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

        name = name
            .replace(/^\s+|\s+$/g, '')
            .replace(/\.+$/g, '')
            .trim();

        if (!name) {
            name = 'Unknown';
        }

        if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name)) {
            name = '_' + name;
        }

        return name;
    }

    function getFileTimestamp() {
        const now = new Date();

        const pad = (n, length = 2) => String(n).padStart(length, '0');

        return (
            now.getFullYear() +
            '-' +
            pad(now.getMonth() + 1) +
            '-' +
            pad(now.getDate()) +
            '_' +
            pad(now.getHours()) +
            '-' +
            pad(now.getMinutes()) +
            '-' +
            pad(now.getSeconds()) +
            '-' +
            pad(now.getMilliseconds(), 3)
        );
    }

    function makeVideoFileName(type, extension, title = null) {
        const channelName = title || getChannelName();

        const timestamp = getFileTimestamp();

        return channelName + '_' + timestamp + '.' + extension;
    }

    // ===========================================================
    // F9 녹화
    // ===========================================================

    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let captureStream = null;

    // ===========================================================
    // F8 움짤 녹화
    // ===========================================================

    let gifMediaRecorder = null;
    let gifRecordedChunks = [];
    let isGifRecording = false;
    let gifCaptureStream = null;
    let gifRecordingBlob = null;

    // 녹화 시작 당시 영상 제목 저장
    let gifVideoTitle = '';

    // ===========================================================
    // OCR 영역 지정 (녹화/움짤 캡처 영역 제한)
    // ===========================================================

    let cropRegion = null; // { xRatio, yRatio, widthRatio, heightRatio } - 화질이 바뀌어도 유지되도록 비율로 저장
    let cropSelecting = false;
    let cropOverlayEl = null;
    let cropBorderEl = null;
    let cropBorderRafId = null;
    let activeCropStreamStop = null;
    let activeGifCropStreamStop = null;

    // ===========================================================
    // Video 찾기
    // ===========================================================

    function findVideoElement() {
        /*
         * 유튜브 쇼츠는 스크롤 프리로드로 인해 <video>가 여러 개
         * 동시에 DOM에 존재할 수 있다. 화면 세로 중앙을 실제로
         * 가로지르는(=현재 재생 중인) video를 우선 선택한다.
         */
        const shortsVideos = document.querySelectorAll(
            'ytd-reel-video-renderer video, #shorts-player video',
        );

        if (shortsVideos.length > 0) {
            const viewportMidY = window.innerHeight / 2;

            for (const v of shortsVideos) {
                const rect = v.getBoundingClientRect();

                if (rect.height > 0 && rect.top < viewportMidY && rect.bottom > viewportMidY) {
                    return v;
                }
            }

            // 중앙에 걸친 것을 못 찾으면 첫 번째 쇼츠 video로 폴백
            if (shortsVideos[0]) {
                return shortsVideos[0];
            }
        }

        return (
            document.querySelector('.html5-video-container video') ||
            document.querySelector('video.html5-main-video') ||
            document.querySelector('video')
        );
    }

    // ===========================================================
    // 일반 녹화 MIME
    // ===========================================================

    function pickMimeType() {
        const candidates = [
            'video/mp4;codecs=avc1,mp4a',

            'video/mp4',

            'video/webm;codecs=vp9,opus',

            'video/webm',
        ];

        for (const type of candidates) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return '';
    }

    function extFromMime(mime) {
        return mime.includes('mp4') ? 'mp4' : 'webm';
    }

    function getBitrateForVideo(video, forceAuto = false) {
        if (!forceAuto && gifSettings.bitrateMbps !== 'auto') {
            return Math.round(gifSettings.bitrateMbps * 1000000);
        }

        const h = video.videoHeight || 0;

        if (h >= 2160) {
            return 40000000;
        } else if (h >= 1440) {
            return 20000000;
        } else if (h >= 1080) {
            return 12000000;
        } else if (h >= 720) {
            return 8000000;
        } else {
            return 4000000;
        }
    }

    // ===========================================================
    // 다운로드
    // ===========================================================

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download = filename;

        document.body.appendChild(a);

        a.click();

        a.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 5000);
    }

    // ===========================================================
    // OCR 영역(비율) → 현재 해상도 기준 픽셀 좌표 변환
    // 화질이 바뀌면 video.videoWidth/videoHeight 자체가 바뀌므로,
    // 저장해둔 비율에 "현재" 해상도를 곱해서 항상 같은 상대 위치를
    // 가리키도록 한다.
    // ===========================================================

    function getCropPixelRegion(video) {
        if (!cropRegion || !video || !video.videoWidth || !video.videoHeight) {
            return null;
        }

        const vw = video.videoWidth;

        const vh = video.videoHeight;

        const x = Math.round(cropRegion.xRatio * vw);

        const y = Math.round(cropRegion.yRatio * vh);

        const width = Math.max(2, Math.round(cropRegion.widthRatio * vw));

        const height = Math.max(2, Math.round(cropRegion.heightRatio * vh));

        return {
            x: Math.max(0, Math.min(x, vw - 2)),

            y: Math.max(0, Math.min(y, vh - 2)),

            width: Math.min(width, vw - Math.max(0, Math.min(x, vw - 2))),

            height: Math.min(height, vh - Math.max(0, Math.min(y, vh - 2))),
        };
    }

    // ===========================================================
    // 스크린샷
    // ===========================================================

    function takeScreenshot() {
        const video = findVideoElement();

        if (!video || !video.videoWidth) {
            alert('영상을 찾을 수 없습니다.');

            return;
        }

        const region = getCropPixelRegion(video) || {
            x: 0,
            y: 0,
            width: video.videoWidth,
            height: video.videoHeight,
        };

        const canvas = document.createElement('canvas');

        canvas.width = region.width;

        canvas.height = region.height;

        const ctx = canvas.getContext('2d');

        try {
            ctx.drawImage(
                video,
                region.x,
                region.y,
                region.width,
                region.height,
                0,
                0,
                region.width,
                region.height,
            );
        } catch (err) {
            alert('스크린샷 캡처에 실패했습니다: ' + err.message);

            return;
        }

        canvas.toBlob((blob) => {
            if (!blob) {
                alert('스크린샷 캡처에 실패했습니다.');

                return;
            }

            downloadBlob(blob, makeVideoFileName('스크린샷', 'png'));
        }, 'image/png');
    }

    // ===========================================================
    // OCR 영역(크롭) 캡처 스트림 생성
    // ===========================================================

    function createCroppedStream(video, ratioRegion, fps) {
        const initialRegion = getCropPixelRegion(video) || {
            x: 0,
            y: 0,
            width: video.videoWidth,
            height: video.videoHeight,
        };

        const canvas = document.createElement('canvas');

        // 캔버스(출력) 크기는 녹화 시작 시점 해상도로 고정한다.
        // 화질이 바뀌어도 소스 영역만 비율에 맞춰 재계산해서
        // 이 고정된 캔버스 크기로 스케일링해 그린다.
        canvas.width = initialRegion.width;

        canvas.height = initialRegion.height;

        const ctx = canvas.getContext('2d');

        let rafId = null;

        function draw() {
            try {
                const vw = video.videoWidth || initialRegion.width;

                const vh = video.videoHeight || initialRegion.height;

                const sx = ratioRegion.xRatio * vw;

                const sy = ratioRegion.yRatio * vh;

                const sw = Math.max(1, ratioRegion.widthRatio * vw);

                const sh = Math.max(1, ratioRegion.heightRatio * vh);

                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            } catch (e) {
                // 프레임 드로잉 실패는 무시하고 다음 프레임 시도
            }

            rafId = requestAnimationFrame(draw);
        }

        draw();

        const canvasStream = fps ? canvas.captureStream(fps) : canvas.captureStream();

        let audioTracks = [];

        try {
            audioTracks = video.captureStream().getAudioTracks();
        } catch (e) {
            audioTracks = [];
        }

        const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

        return {
            stream: combined,
            stop: () => {
                if (rafId) {
                    cancelAnimationFrame(rafId);

                    rafId = null;
                }
            },
        };
    }

    // ===========================================================
    // OCR 영역 지정/해제
    // ===========================================================

    function updateCropButtonUI() {
        const btn = document.getElementById('yt-crop-btn');

        if (!btn) return;

        btn.title = cropRegion
            ? `OCR 영역 해제 (녹화/움짤이 다시 전체 화면을 캡처합니다) (${gifSettings.keyCrop})`
            : `OCR 영역 지정 (드래그로 녹화/움짤 캡처 범위를 선택합니다) (${gifSettings.keyCrop})`;

        const oldSvg = btn.querySelector('svg');

        if (oldSvg) {
            oldSvg.remove();
        }

        btn.appendChild(buildCropIcon(!!cropRegion));
    }

    function toggleCropMode() {
        if (cropSelecting) {
            return;
        }

        if (cropRegion) {
            clearCropRegion();
        } else {
            startCropSelection();
        }
    }

    function startCropSelection() {
        const video = findVideoElement();

        if (!video || !video.videoWidth) {
            alert('영상을 찾을 수 없습니다.');

            return;
        }

        cropSelecting = true;

        const overlay = document.createElement('div');

        overlay.id = 'yt-crop-select-overlay';

        overlay.style.cssText =
            'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.15);';

        const hint = document.createElement('div');

        hint.textContent = '드래그하여 녹화/움짤로 캡처할 영역을 지정하세요 (Esc: 취소)';

        hint.style.cssText =
            'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:8px 16px;border-radius:6px;font-family:Arial,sans-serif;font-size:13px;z-index:2147483647;pointer-events:none;';

        overlay.appendChild(hint);

        const selBox = document.createElement('div');

        selBox.style.cssText =
            'position:fixed;border:2px dashed #3ea6ff;background:rgba(62,166,255,0.15);display:none;pointer-events:none;';

        overlay.appendChild(selBox);

        document.body.appendChild(overlay);

        cropOverlayEl = overlay;

        let startX = 0;
        let startY = 0;
        let dragging = false;

        function onMouseDown(e) {
            dragging = true;

            startX = e.clientX;

            startY = e.clientY;

            selBox.style.left = startX + 'px';

            selBox.style.top = startY + 'px';

            selBox.style.width = '0px';

            selBox.style.height = '0px';

            selBox.style.display = 'block';
        }

        function onMouseMove(e) {
            if (!dragging) return;

            const x = Math.min(e.clientX, startX);

            const y = Math.min(e.clientY, startY);

            const w = Math.abs(e.clientX - startX);

            const h = Math.abs(e.clientY - startY);

            selBox.style.left = x + 'px';

            selBox.style.top = y + 'px';

            selBox.style.width = w + 'px';

            selBox.style.height = h + 'px';
        }

        function onMouseUp() {
            if (!dragging) return;

            dragging = false;

            const rect = selBox.getBoundingClientRect();

            cleanup();

            finishCropSelection(rect, video);
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                cleanup();

                cropSelecting = false;
            }
        }

        function cleanup() {
            overlay.removeEventListener('mousedown', onMouseDown);

            overlay.removeEventListener('mousemove', onMouseMove);

            overlay.removeEventListener('mouseup', onMouseUp);

            document.removeEventListener('keydown', onKeyDown, true);

            overlay.remove();

            cropOverlayEl = null;
        }

        overlay.addEventListener('mousedown', onMouseDown);

        overlay.addEventListener('mousemove', onMouseMove);

        overlay.addEventListener('mouseup', onMouseUp);

        document.addEventListener('keydown', onKeyDown, true);
    }

    function finishCropSelection(screenRect, video) {
        cropSelecting = false;

        const videoRect = video.getBoundingClientRect();

        const left = Math.max(screenRect.left, videoRect.left);

        const top = Math.max(screenRect.top, videoRect.top);

        const right = Math.min(screenRect.right, videoRect.right);

        const bottom = Math.min(screenRect.bottom, videoRect.bottom);

        const w = right - left;

        const h = bottom - top;

        if (w < 10 || h < 10 || videoRect.width <= 0 || videoRect.height <= 0) {
            alert('선택한 영역이 너무 작거나 영상 범위를 벗어났습니다. 다시 시도해주세요.');

            return;
        }

        const scaleX = video.videoWidth / videoRect.width;

        const scaleY = video.videoHeight / videoRect.height;

        const x = Math.round((left - videoRect.left) * scaleX);

        const y = Math.round((top - videoRect.top) * scaleY);

        const width = Math.round(w * scaleX);

        const height = Math.round(h * scaleY);

        const clampedX = Math.max(0, Math.min(x, video.videoWidth - 2));

        const clampedY = Math.max(0, Math.min(y, video.videoHeight - 2));

        const clampedWidth = Math.max(2, Math.min(width, video.videoWidth - clampedX));

        const clampedHeight = Math.max(2, Math.min(height, video.videoHeight - clampedY));

        cropRegion = {
            xRatio: clampedX / video.videoWidth,

            yRatio: clampedY / video.videoHeight,

            widthRatio: clampedWidth / video.videoWidth,

            heightRatio: clampedHeight / video.videoHeight,
        };

        updateCropButtonUI();

        createCropBorderBox();
    }

    function createCropBorderBox() {
        removeCropBorderBox();

        const box = document.createElement('div');

        box.id = 'yt-crop-border-box';

        box.style.cssText =
            'position:fixed;border:2px dashed #ff0000;z-index:2147483000;pointer-events:none;box-sizing:border-box;display:none;';

        document.body.appendChild(box);

        cropBorderEl = box;

        function loop() {
            if (!cropBorderEl || !cropRegion) return;

            const video = findVideoElement();

            const region = video ? getCropPixelRegion(video) : null;

            if (video && region) {
                const videoRect = video.getBoundingClientRect();

                const scaleX = videoRect.width / video.videoWidth;

                const scaleY = videoRect.height / video.videoHeight;

                cropBorderEl.style.left = videoRect.left + region.x * scaleX + 'px';

                cropBorderEl.style.top = videoRect.top + region.y * scaleY + 'px';

                cropBorderEl.style.width = region.width * scaleX + 'px';

                cropBorderEl.style.height = region.height * scaleY + 'px';

                cropBorderEl.style.display = 'block';
            } else {
                cropBorderEl.style.display = 'none';
            }

            cropBorderRafId = requestAnimationFrame(loop);
        }

        loop();
    }

    function removeCropBorderBox() {
        if (cropBorderRafId) {
            cancelAnimationFrame(cropBorderRafId);

            cropBorderRafId = null;
        }

        if (cropBorderEl) {
            cropBorderEl.remove();

            cropBorderEl = null;
        }
    }

    function clearCropRegion() {
        cropRegion = null;

        removeCropBorderBox();

        updateCropButtonUI();
    }

    // ===========================================================
    // F9 녹화 시작
    // ===========================================================

    async function startRecording() {
        const video = findVideoElement();

        if (!video) {
            alert('영상을 찾을 수 없습니다.');

            return;
        }

        if (typeof video.captureStream !== 'function') {
            alert('이 브라우저는 video.captureStream()을 지원하지 않습니다.');

            return;
        }

        if (cropRegion) {
            const cropped = createCroppedStream(video, cropRegion, 30);

            captureStream = cropped.stream;

            activeCropStreamStop = cropped.stop;

            if (captureStream.getVideoTracks().length === 0) {
                alert('비디오 트랙을 가져오지 못했습니다.');

                activeCropStreamStop();

                activeCropStreamStop = null;

                return;
            }
        } else {
            try {
                captureStream = video.captureStream(30);
            } catch (err) {
                alert('영상 캡처에 실패했습니다: ' + err.message);

                return;
            }

            if (captureStream.getVideoTracks().length === 0) {
                alert('비디오 트랙을 가져오지 못했습니다.');

                return;
            }

            try {
                await captureStream.getVideoTracks()[0].applyConstraints({
                    frameRate: {
                        exact: 30,
                    },
                });
            } catch (err) {
                alert('30fps로 고정하는 데 실패했습니다: ' + err.message);

                return;
            }
        }

        const mimeType = pickMimeType();

        if (!mimeType) {
            alert('이 브라우저는 MediaRecorder를 지원하지 않습니다.');

            return;
        }

        recordedChunks = [];

        /*
         * 일반 녹화도 녹화 시작 시점의 제목을 기억한다.
         * 녹화 도중 페이지 제목이 바뀌어도 파일명은 동일하게 유지.
         */
        const recordingChannelName = getChannelName();

        mediaRecorder = new MediaRecorder(captureStream, {
            mimeType,
            videoBitsPerSecond: getBitrateForVideo(video),
        });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const ext = extFromMime(mimeType);

            const blob = new Blob(recordedChunks, {
                type: mimeType,
            });

            downloadBlob(blob, makeVideoFileName('녹화', ext, recordingChannelName));

            captureStream = null;

            if (activeCropStreamStop) {
                activeCropStreamStop();

                activeCropStreamStop = null;
            }
        };

        mediaRecorder.start();

        isRecording = true;

        updateButtonUI();
    }

    // ===========================================================
    // F9 녹화 종료
    // ===========================================================

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        isRecording = false;

        updateButtonUI();
    }

    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    // ===========================================================
    // F8 움짤 녹화 시작
    // ===========================================================

    async function startGifRecording() {
        const video = findVideoElement();

        if (!video) {
            alert('영상을 찾을 수 없습니다.');

            return;
        }

        /*
         * 움짤 녹화 시작 순간의 제목을 저장.
         * 편집창을 나중에 저장해도 당시 제목을 사용한다.
         */
        gifVideoTitle = getChannelName();

        if (typeof video.captureStream !== 'function') {
            alert('이 브라우저는 video.captureStream()을 지원하지 않습니다.');

            return;
        }

        if (cropRegion) {
            const cropped = createCroppedStream(video, cropRegion);

            gifCaptureStream = cropped.stream;

            activeGifCropStreamStop = cropped.stop;
        } else {
            try {
                gifCaptureStream = video.captureStream();
            } catch (err) {
                alert('영상 캡처에 실패했습니다: ' + err.message);

                return;
            }
        }

        if (gifCaptureStream.getVideoTracks().length === 0) {
            alert('비디오 트랙을 가져오지 못했습니다.');

            if (activeGifCropStreamStop) {
                activeGifCropStreamStop();

                activeGifCropStreamStop = null;
            }

            return;
        }

        const mimeType = pickMimeType();

        if (!mimeType) {
            alert('이 브라우저는 MediaRecorder를 지원하지 않습니다.');

            return;
        }

        gifRecordedChunks = [];

        gifMediaRecorder = new MediaRecorder(gifCaptureStream, {
            mimeType,
            videoBitsPerSecond: getBitrateForVideo(video, true),
        });

        gifMediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                gifRecordedChunks.push(e.data);
            }
        };

        gifMediaRecorder.onstop = () => {
            gifRecordingBlob = new Blob(gifRecordedChunks, {
                type: mimeType,
            });

            gifCaptureStream = null;

            if (activeGifCropStreamStop) {
                activeGifCropStreamStop();

                activeGifCropStreamStop = null;
            }

            openGifEditorInNewTab(gifRecordingBlob, gifVideoTitle, gifSettings.autoGenerate);
        };

        gifMediaRecorder.start();

        isGifRecording = true;

        updateGifButtonUI();
    }

    // ===========================================================
    // F8 움짤 녹화 종료
    // ===========================================================

    function stopGifRecording() {
        if (gifMediaRecorder && gifMediaRecorder.state !== 'inactive') {
            gifMediaRecorder.stop();
        }

        isGifRecording = false;

        updateGifButtonUI();
    }

    function toggleGifRecording() {
        if (isGifRecording) {
            stopGifRecording();
        } else {
            startGifRecording();
        }
    }

    // ===========================================================
    // F8 종료 후 새 탭 편집창
    // ===========================================================

    function openGifEditorInNewTab(blob, videoTitle, autoGenerate = false) {
        const reader = new FileReader();

        reader.onload = () => {
            const dataUrl = reader.result;

            const safeVideoTitle = videoTitle || 'YouTube';

            const html =
                '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                '<meta charset="UTF-8">' +
                '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
                '<title>움짤(GIF/WebP) 만들기</title>' +
                '<style>' +
                'html,body{margin:0;padding:0;}' +
                'body{' +
                'background:#181818;' +
                'color:#fff;' +
                'font-family:Arial,sans-serif;' +
                'padding:20px;' +
                'box-sizing:border-box;' +
                '}' +
                'video{' +
                'width:100%;' +
                'max-width:800px;' +
                'background:#000;' +
                'border-radius:6px;' +
                'display:block;' +
                '}' +
                '.mini{' +
                'background:#2c2c2c;' +
                'color:#fff;' +
                'border:1px solid #444;' +
                'border-radius:6px;' +
                'padding:5px 10px;' +
                'font-size:12px;' +
                'cursor:pointer;' +
                'margin:4px;' +
                '}' +
                '.mainbtn{' +
                'border:none;' +
                'border-radius:6px;' +
                'padding:8px 18px;' +
                'font-size:14px;' +
                'color:#fff;' +
                'cursor:pointer;' +
                'font-weight:bold;' +
                'margin:4px;' +
                '}' +
                '.mainbtn:disabled{' +
                'opacity:.5;' +
                'cursor:not-allowed;' +
                '}' +
                'input,select{' +
                'background:#111;' +
                'color:#fff;' +
                'border:1px solid #444;' +
                'border-radius:4px;' +
                'padding:4px 6px;' +
                '}' +
                '#bar{' +
                'background:#333;' +
                'border-radius:6px;' +
                'overflow:hidden;' +
                'height:10px;' +
                'margin-top:6px;' +
                '}' +
                '#fill{' +
                'background:#3ea6ff;' +
                'height:100%;' +
                'width:0%;' +
                '}' +
                '</style>' +
                '</head>' +
                '<body>' +
                '<h2>움짤(GIF/WebP) 만들기</h2>' +
                '<video id="v" controls></video>' +
                '<div style="margin-top:14px;">' +
                '구간 선택(초) 시작 ' +
                '<input id="s" type="number" step="0.1" value="0"> ' +
                '<button class="mini" id="setS">' +
                '현재 위치' +
                '</button> ' +
                '끝 ' +
                '<input id="e" type="number" step="0.1"> ' +
                '<button class="mini" id="setE">' +
                '현재 위치' +
                '</button> ' +
                '<button class="mini" id="resetR">' +
                '전체 구간' +
                '</button>' +
                '</div>' +
                '<div style="margin-top:12px;">' +
                'FPS ' +
                '<select id="fps">' +
                buildFpsOptionsHtml(gifSettings.fps) +
                '</select> ' +
                '<input id="fpsCustom" type="number" min="1" step="1" placeholder="직접입력" style="display:none;width:70px;" value="' +
                gifSettings.fps +
                '"> ' +
                '가로(px) ' +
                '<select id="w">' +
                buildWidthOptionsHtml(gifSettings.width) +
                '</select> ' +
                '<input id="wCustom" type="number" min="1" step="10" placeholder="직접입력" style="display:none;width:80px;" value="' +
                gifSettings.width +
                '"> ' +
                '<span id="qualityWrap">' +
                '화질 ' +
                '<select id="q">' +
                buildQualityOptionsHtml(gifSettings.quality) +
                '</select> ' +
                '<input id="qCustom" type="number" min="1" max="20" step="1" placeholder="직접입력" style="display:none;width:70px;" value="' +
                gifSettings.quality +
                '">' +
                '</span> ' +
                '저장 형식 ' +
                '<select id="format">' +
                buildFormatOptionsHtml(gifSettings.format) +
                '</select> ' +
                '<span id="gifQualityWrap" style="display:' +
                (gifSettings.format === 'gif' ? 'inline' : 'none') +
                ';">' +
                ' GIF 화질 ' +
                '<select id="gifQualityMode">' +
                buildGifQualityOptionsHtml(gifSettings.gifQuality) +
                '</select>' +
                '</span> ' +
                '<span id="webpCompressionWrap" style="display:' +
                (gifSettings.format === 'webp' ? 'inline' : 'none') +
                ';">' +
                ' WebP 압축 ' +
                '<select id="webpCompression">' +
                buildWebpCompressionOptionsHtml(gifSettings.webpLossless) +
                '</select>' +
                '</span>' +
                '</div>' +
                '<div id="memoryWarning" style="display:none;margin-top:12px;padding:10px;background:#3a2525;border:1px solid #744444;border-radius:6px;font-size:12px;line-height:1.5;"></div>' +
                '<div id="pw" style="display:none;">' +
                '<div id="lbl">변환 중...</div>' +
                '<div id="bar">' +
                '<div id="fill"></div>' +
                '</div>' +
                '</div>' +
                '<button class="mainbtn" id="cancel" style="background:#3d3d3d;">' +
                '닫기' +
                '</button>' +
                '<button class="mainbtn" id="save" style="background:#3ea6ff;">' +
                '저장' +
                '</button>' +
                '<script>' +
                'const v=document.getElementById("v");' +
                'v.src=' +
                JSON.stringify(dataUrl) +
                ';' +
                'const videoTitle=' +
                JSON.stringify(safeVideoTitle) +
                ';' +
                'const autoGenerate=' +
                JSON.stringify(!!autoGenerate) +
                ';' +
                'if(autoGenerate){document.body.style.display="none";}' +
                // ------------------------------------------------
                // 파일명
                // ------------------------------------------------

                'function getFileTimestamp(){' +
                'const now=new Date();' +
                'const pad=(n,length=2)=>String(n).padStart(length,"0");' +
                'return now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate())+"_"+pad(now.getHours())+"-"+pad(now.getMinutes())+"-"+pad(now.getSeconds())+"-"+pad(now.getMilliseconds(),3);' +
                '}' +
                'function makeFileName(type,extension){' +
                'let title=videoTitle||"YouTube";' +
                'title=title.replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g,"");' +
                'title=title.replace(/^\\s+|\\s+$/g,"").replace(/\\.+$/g,"").trim();' +
                'if(!title)title="YouTube";' +
                'if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(title))title="_"+title;' +
                'return title+"_"+getFileTimestamp()+"."+extension;' +
                '}' +
                'let dur=0;' +
                'v.addEventListener("loadedmetadata",()=>{' +
                'const fix=()=>{' +
                'if(isFinite(v.duration)&&v.duration>0){' +
                'dur=v.duration;' +
                'document.getElementById("e").value=dur.toFixed(1);' +
                'v.currentTime=0;' +
                'if(autoGenerate){document.getElementById("save").click();}' +
                '}else{' +
                'v.currentTime=1e101;' +
                'v.addEventListener("durationchange",fix,{once:true});' +
                '}' +
                '};' +
                'fix();' +
                '});' +
                // ------------------------------------------------
                // 커스텀 입력
                // ------------------------------------------------

                'function syncCustom(sel,inp){' +
                'inp.style.display=sel.value==="custom"?"inline-block":"none";' +
                '}' +
                'const fpsSel=document.getElementById("fps"),fpsCustom=document.getElementById("fpsCustom");' +
                'const wSel=document.getElementById("w"),wCustom=document.getElementById("wCustom");' +
                'const qSel=document.getElementById("q"),qCustom=document.getElementById("qCustom");' +
                'const formatSel=document.getElementById("format");' +
                'const webpCompressionWrap=document.getElementById("webpCompressionWrap");' +
                'const webpCompression=document.getElementById("webpCompression");' +
                'const gifQualityWrap=document.getElementById("gifQualityWrap");' +
                'const gifQualityMode=document.getElementById("gifQualityMode");' +
                'const qualityWrap=document.getElementById("qualityWrap");' +
                'const memoryWarning=document.getElementById("memoryWarning");' +
                'syncCustom(fpsSel,fpsCustom);' +
                'syncCustom(wSel,wCustom);' +
                'syncCustom(qSel,qCustom);' +
                'fpsSel.addEventListener("change",()=>syncCustom(fpsSel,fpsCustom));' +
                'wSel.addEventListener("change",()=>syncCustom(wSel,wCustom));' +
                'qSel.addEventListener("change",()=>syncCustom(qSel,qCustom));' +
                'qCustom.addEventListener("input",()=>{' +
                'if(qCustom.value==="")return;' +
                'const qv=parseInt(qCustom.value,10);' +
                'if(!isNaN(qv)&&qv>20)qCustom.value="20";' +
                'if(!isNaN(qv)&&qv<1)qCustom.value="1";' +
                '});' +
                // ------------------------------------------------
                // GIF / WebP UI
                // ------------------------------------------------

                'function updateFormatUI(){' +
                'const isWebp=formatSel.value==="webp";' +
                'const isGif=formatSel.value==="gif";' +
                'const isLossless=webpCompression.value==="lossless";' +
                'const isGifHighQuality=isGif&&gifQualityMode.value==="high";' +
                'webpCompressionWrap.style.display=isWebp?"inline":"none";' +
                'gifQualityWrap.style.display=isGif?"inline":"none";' +
                'qualityWrap.style.display=isGifHighQuality?"none":((!isWebp||!isLossless)?"inline":"none");' +
                'updateMemoryWarning();' +
                '}' +
                'formatSel.addEventListener("change",updateFormatUI);' +
                'webpCompression.addEventListener("change",updateFormatUI);' +
                'gifQualityMode.addEventListener("change",updateFormatUI);' +
                // ------------------------------------------------
                // 현재 위치
                // ------------------------------------------------

                'document.getElementById("setS").onclick=()=>document.getElementById("s").value=v.currentTime.toFixed(1);' +
                'document.getElementById("setE").onclick=()=>document.getElementById("e").value=v.currentTime.toFixed(1);' +
                'document.getElementById("resetR").onclick=()=>{' +
                'document.getElementById("s").value=0;' +
                'document.getElementById("e").value=dur.toFixed(1);' +
                'updateMemoryWarning();' +
                '};' +
                // ------------------------------------------------
                // 구간 입력 변화
                // ------------------------------------------------

                'document.getElementById("s").addEventListener("input",updateMemoryWarning);' +
                'document.getElementById("e").addEventListener("input",updateMemoryWarning);' +
                'fpsSel.addEventListener("change",updateMemoryWarning);' +
                'fpsCustom.addEventListener("input",updateMemoryWarning);' +
                'wSel.addEventListener("change",updateMemoryWarning);' +
                'wCustom.addEventListener("input",updateMemoryWarning);' +
                // ------------------------------------------------
                // 메모리 예상
                // ------------------------------------------------

                'function getCurrentFps(){' +
                'return fpsSel.value==="custom"?parseInt(fpsCustom.value,10):parseInt(fpsSel.value,10);' +
                '}' +
                'function getCurrentWidth(){' +
                'return wSel.value==="custom"?parseInt(wCustom.value,10):parseInt(wSel.value,10);' +
                '}' +
                'function updateMemoryWarning(){' +
                'if(formatSel.value!=="webp"){' +
                'memoryWarning.style.display="none";' +
                'return;' +
                '}' +
                'const start=parseFloat(document.getElementById("s").value);' +
                'const end=parseFloat(document.getElementById("e").value);' +
                'const fps=getCurrentFps();' +
                'const targetWidth=getCurrentWidth();' +
                'if(!isFinite(start)||!isFinite(end)||end<=start||!isFinite(fps)||fps<=0||!isFinite(targetWidth)||targetWidth<0||!v.videoWidth){' +
                'memoryWarning.style.display="none";' +
                'return;' +
                '}' +
                'const srcW=v.videoWidth;' +
                'const srcH=v.videoHeight;' +
                'const scale=targetWidth>0?targetWidth/srcW:1;' +
                'const outW=Math.max(1,Math.round(srcW*scale));' +
                'const outH=Math.max(1,Math.round(srcH*scale));' +
                'const total=Math.max(1,Math.floor((end-start)*fps));' +
                'const rawBytes=outW*outH*4*total;' +
                'const estimated=rawBytes*1.5;' +
                'if(estimated>=512*1024*1024){' +
                'memoryWarning.style.display="block";' +
                'memoryWarning.innerHTML="⚠️ 예상 메모리 사용량이 약 <b>"+formatBytes(estimated)+"</b>입니다.<br>WebP는 변환 중 모든 프레임을 메모리에 보관하기 때문에 높은 FPS/해상도/긴 구간에서는 변환이 실패할 수 있습니다.<br><br>FPS, 가로 크기 또는 구간을 줄이는 것을 권장합니다.";' +
                '}else if(estimated>=256*1024*1024){' +
                'memoryWarning.style.display="block";' +
                'memoryWarning.innerHTML="⚠️ 예상 메모리 사용량이 약 <b>"+formatBytes(estimated)+"</b>입니다.<br>현재 설정은 상당히 무거운 편입니다. 변환 실패를 피하려면 FPS나 가로 크기를 낮추는 것을 권장합니다.";' +
                '}else{' +
                'memoryWarning.style.display="none";' +
                '}' +
                '}' +
                'function formatBytes(bytes){' +
                'if(bytes<1024)return bytes.toFixed(0)+" B";' +
                'if(bytes<1024*1024)return (bytes/1024).toFixed(1)+" KB";' +
                'if(bytes<1024*1024*1024)return (bytes/(1024*1024)).toFixed(1)+" MB";' +
                'return (bytes/(1024*1024*1024)).toFixed(2)+" GB";' +
                '}' +
                // ------------------------------------------------
                // 초기 UI
                // ------------------------------------------------

                'document.getElementById("cancel").onclick=()=>window.close();' +
                // ------------------------------------------------
                // 프레임 캡처 (재생 기반, seek 폴백 포함)
                // ------------------------------------------------

                'function seekTo(video,t){' +
                'return new Promise((resolve,reject)=>{' +
                'let done=false;' +
                'const finish=()=>{' +
                'if(done)return;' +
                'done=true;' +
                'resolve();' +
                '};' +
                'const cleanup=()=>{' +
                'video.removeEventListener("seeked",onSeeked);' +
                'clearTimeout(timer);' +
                '};' +
                'const waitFrame=()=>{' +
                'if(video.requestVideoFrameCallback){' +
                'const frameTimer=setTimeout(finish,200);' +
                'video.requestVideoFrameCallback(()=>{clearTimeout(frameTimer);finish();});' +
                '}else{' +
                'requestAnimationFrame(()=>requestAnimationFrame(finish));' +
                '}' +
                '};' +
                'const onSeeked=()=>{' +
                'if(done)return;' +
                'cleanup();' +
                'waitFrame();' +
                '};' +
                'const timer=setTimeout(()=>{' +
                'if(done)return;' +
                'cleanup();' +
                'waitFrame();' +
                '},800);' +
                'video.addEventListener("seeked",onSeeked);' +
                'video.currentTime=t;' +
                '});' +
                '}' +
                // 프레임 추출: 프레임마다 seek 후 정착을 기다린 뒤 캡처한다.
                'async function captureFramesSeek(video,ctx,outW,outH,start,end,fps,total,onFrame){' +
                'for(let i=0;i<total;i++){' +
                'await seekTo(video,Math.min(start+i/fps,end));' +
                'ctx.drawImage(video,0,0,outW,outH);' +
                'onFrame(i);' +
                '}' +
                '}' +
                // ------------------------------------------------
                // 커스텀 입력
                // ------------------------------------------------

                'function syncCustom(sel,inp){' +
                'inp.style.display=sel.value==="custom"?"inline-block":"none";' +
                '}' +
                // ------------------------------------------------
                // 외부 스크립트
                // ------------------------------------------------

                'function loadScript(src){' +
                'return new Promise((res,rej)=>{' +
                'const s=document.createElement("script");' +
                's.src=src;' +
                's.onload=res;' +
                's.onerror=rej;' +
                'document.head.appendChild(s);' +
                '});' +
                '}' +
                // ------------------------------------------------
                // 저장
                // ------------------------------------------------

                'document.getElementById("save").onclick=async()=>{' +
                'const start=parseFloat(document.getElementById("s").value);' +
                'const end=parseFloat(document.getElementById("e").value);' +
                'if(isNaN(start)||isNaN(end)||end<=start){' +
                'alert("구간을 올바르게 입력해주세요.");' +
                'return;' +
                '}' +
                'const fps=fpsSel.value==="custom"?parseInt(fpsCustom.value,10):parseInt(fpsSel.value,10);' +
                'const targetWidth=wSel.value==="custom"?parseInt(wCustom.value,10):parseInt(wSel.value,10);' +
                'const quality=qSel.value==="custom"?parseInt(qCustom.value,10):parseInt(qSel.value,10);' +
                'const format=formatSel.value==="webp"?"webp":"gif";' +
                'const webpLossless=format==="webp"&&webpCompression.value==="lossless";' +
                'if(isNaN(fps)||fps<=0){alert("FPS를 올바르게 입력해주세요.");return;}' +
                'if(isNaN(targetWidth)||targetWidth<0){alert("가로 크기를 올바르게 입력해주세요.");return;}' +
                'if(isNaN(quality)||quality<1||quality>20){alert("화질 값은 1~20 사이로 입력해주세요.");return;}' +
                // ------------------------------------------------
                // WebP 메모리 사전 검사
                // ------------------------------------------------

                'if(format==="webp"){' +
                'const srcW=v.videoWidth,srcH=v.videoHeight;' +
                'const scale=targetWidth>0?targetWidth/srcW:1;' +
                'const outW=Math.max(1,Math.round(srcW*scale));' +
                'const outH=Math.max(1,Math.round(srcH*scale));' +
                'const total=Math.max(1,Math.floor((end-start)*fps));' +
                'const estimated=outW*outH*4*total*1.5;' +
                'if(estimated>=768*1024*1024&&!autoGenerate){' +
                'if(!confirm("현재 WebP 설정은 매우 무겁습니다.\\n\\n예상 메모리 사용량: "+formatBytes(estimated)+"\\n\\n변환이 실패하거나 브라우저가 느려질 수 있습니다.\\n그래도 진행하시겠습니까?")){' +
                'return;' +
                '}' +
                '}' +
                '}' +
                'document.getElementById("save").disabled=true;' +
                'document.getElementById("pw").style.display="block";' +
                'document.getElementById("lbl").textContent="라이브러리 로딩 중...";' +
                'document.getElementById("fill").style.width="0%";' +
                'try{' +
                'const srcW=v.videoWidth,srcH=v.videoHeight;' +
                'const scale=targetWidth>0?targetWidth/srcW:1;' +
                'const outW=Math.max(1,Math.round(srcW*scale));' +
                'const outH=Math.max(1,Math.round(srcH*scale));' +
                'const canvas=document.createElement("canvas");' +
                'canvas.width=outW;' +
                'canvas.height=outH;' +
                'const ctx=canvas.getContext("2d",{willReadFrequently:true});' +
                'if(!ctx){' +
                'throw new Error("Canvas를 생성할 수 없습니다.");' +
                '}' +
                'const delay=Math.max(20,Math.round(1000/fps));' +
                'const total=Math.max(1,Math.floor((end-start)*fps));' +
                // =================================================
                // WebP
                // =================================================

                'if(format==="webp"){' +
                'document.getElementById("lbl").textContent="WebP 라이브러리 로딩 중...";' +
                'const mod=await import("https://cdn.jsdelivr.net/npm/wasm-webp@0.1.0/+esm");' +
                'if(!mod||typeof mod.encodeAnimation!=="function"){' +
                'throw new Error("WebP 라이브러리에서 encodeAnimation을 찾을 수 없습니다.");' +
                '}' +
                'const frames=[];' +
                'const webpQuality=Math.max(10,Math.min(100,Math.round(100-((quality-1)/19)*90)));' +
                'await captureFramesSeek(v,ctx,outW,outH,start,end,fps,total,(i)=>{' +
                'const imageData=ctx.getImageData(0,0,outW,outH);' +
                'const rgba=new Uint8Array(imageData.data);' +
                'const frame={' +
                'data:rgba,' +
                'duration:delay,' +
                'config:{' +
                'lossless:webpLossless?1:0' +
                '}' +
                '};' +
                'if(!webpLossless){' +
                'frame.config.quality=webpQuality;' +
                '}' +
                'frames[i]=frame;' +
                'document.getElementById("lbl").textContent="프레임 추출 중... "+Math.round((i+1)/total*100)+"%";' +
                'document.getElementById("fill").style.width=Math.round((i+1)/total*50)+"%";' +
                '});' +
                'document.getElementById("lbl").textContent=webpLossless?"WebP 무손실 인코딩 중...":"WebP 인코딩 중...";' +
                'document.getElementById("fill").style.width="75%";' +
                'let data;' +
                'try{' +
                'data=await mod.encodeAnimation(outW,outH,true,frames);' +
                '}catch(webpErr){' +
                'console.error("WebP encodeAnimation error:",webpErr);' +
                'throw new Error("WebP 인코딩 중 메모리 또는 WASM 오류가 발생했습니다. FPS/해상도/구간을 줄여 다시 시도해주세요. ("+(webpErr&&webpErr.message?webpErr.message:webpErr)+")");' +
                '}' +
                'if(!data){' +
                'throw new Error("WebP 인코딩 결과가 없습니다.");' +
                '}' +
                'const webpBlob=new Blob([data],{type:"image/webp"});' +
                'const webpUrl=URL.createObjectURL(webpBlob);' +
                'const a=document.createElement("a");' +
                'a.href=webpUrl;' +
                'a.download=makeFileName("움짤","webp");' +
                'document.body.appendChild(a);' +
                'a.click();' +
                'a.remove();' +
                'setTimeout(()=>URL.revokeObjectURL(webpUrl),10000);' +
                'frames.length=0;' +
                'document.getElementById("fill").style.width="100%";' +
                'document.getElementById("lbl").textContent="완료! 다운로드 폴더를 확인하세요.";' +
                'document.getElementById("save").disabled=false;' +
                'if(autoGenerate){setTimeout(()=>window.close(),1200);}' +
                // =================================================
                // GIF - 고화질 (gifski)
                // =================================================

                '}else if(gifQualityMode.value==="high"){' +
                'document.getElementById("lbl").textContent="gifski 라이브러리 로딩 중...";' +
                'const gifskiMod=await import("https://cdn.jsdelivr.net/npm/gifski-wasm/+esm");' +
                'const gifskiEncode=gifskiMod.default;' +
                'if(typeof gifskiEncode!=="function"){' +
                'throw new Error("gifski 라이브러리를 불러오지 못했습니다.");' +
                '}' +
                'const gifskiFrames=[];' +
                'await captureFramesSeek(v,ctx,outW,outH,start,end,fps,total,(i)=>{' +
                'const imageData=ctx.getImageData(0,0,outW,outH);' +
                'gifskiFrames[i]=imageData;' +
                'document.getElementById("lbl").textContent="프레임 추출 중... "+Math.round((i+1)/total*100)+"%";' +
                'document.getElementById("fill").style.width=Math.round((i+1)/total*50)+"%";' +
                '});' +
                'document.getElementById("lbl").textContent="gifski 인코딩 중... (시간이 걸릴 수 있습니다)";' +
                'document.getElementById("fill").style.width="75%";' +
                'let gifskiData;' +
                'try{' +
                'gifskiData=await gifskiEncode({frames:gifskiFrames,width:outW,height:outH,fps:fps,quality:95});' +
                '}catch(gifskiErr){' +
                'console.error("gifski encode error:",gifskiErr);' +
                'throw new Error("gifski 인코딩 중 오류가 발생했습니다. FPS/해상도/구간을 줄여 다시 시도해주세요. ("+(gifskiErr&&gifskiErr.message?gifskiErr.message:gifskiErr)+")");' +
                '}' +
                'if(!gifskiData){' +
                'throw new Error("gifski 인코딩 결과가 없습니다.");' +
                '}' +
                'const gifskiBlob=new Blob([gifskiData],{type:"image/gif"});' +
                'const gifskiUrl=URL.createObjectURL(gifskiBlob);' +
                'const gifskiA=document.createElement("a");' +
                'gifskiA.href=gifskiUrl;' +
                'gifskiA.download=makeFileName("움짤","gif");' +
                'document.body.appendChild(gifskiA);' +
                'gifskiA.click();' +
                'gifskiA.remove();' +
                'setTimeout(()=>URL.revokeObjectURL(gifskiUrl),10000);' +
                'gifskiFrames.length=0;' +
                'document.getElementById("fill").style.width="100%";' +
                'document.getElementById("lbl").textContent="완료! 다운로드 폴더를 확인하세요.";' +
                'document.getElementById("save").disabled=false;' +
                'if(autoGenerate){setTimeout(()=>window.close(),1200);}' +
                // =================================================
                // GIF - 일반 (gif.js)
                // =================================================

                '}else{' +
                'if(typeof window.GIF!=="function"){' +
                'document.getElementById("lbl").textContent="GIF 라이브러리 로딩 중...";' +
                'await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js");' +
                '}' +
                'if(typeof window.GIF!=="function"){' +
                'throw new Error("GIF 라이브러리를 불러오지 못했습니다.");' +
                '}' +
                'const workerText=await(await fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js")).text();' +
                'const workerUrl=URL.createObjectURL(new Blob([workerText],{type:"application/javascript"}));' +
                'const gif=new window.GIF({' +
                'workers:Math.min(4,navigator.hardwareConcurrency||2),' +
                'quality:quality,' +
                'width:outW,' +
                'height:outH,' +
                'workerScript:workerUrl' +
                '});' +
                'await captureFramesSeek(v,ctx,outW,outH,start,end,fps,total,(i)=>{' +
                'gif.addFrame(ctx,{copy:true,delay:delay});' +
                'document.getElementById("lbl").textContent="프레임 추출 중... "+Math.round((i+1)/total*100)+"%";' +
                'document.getElementById("fill").style.width=Math.round((i+1)/total*50)+"%";' +
                '});' +
                'gif.on("progress",(r)=>{' +
                'document.getElementById("lbl").textContent="GIF 인코딩 중... "+Math.round(r*100)+"%";' +
                'document.getElementById("fill").style.width=(50+Math.round(r*50))+"%";' +
                '});' +
                'gif.on("finished",(blob)=>{' +
                'const a=document.createElement("a");' +
                'const url=URL.createObjectURL(blob);' +
                'a.href=url;' +
                'a.download=makeFileName("움짤","gif");' +
                'document.body.appendChild(a);' +
                'a.click();' +
                'a.remove();' +
                'setTimeout(()=>URL.revokeObjectURL(url),10000);' +
                'URL.revokeObjectURL(workerUrl);' +
                'document.getElementById("lbl").textContent="완료! 다운로드 폴더를 확인하세요.";' +
                'document.getElementById("save").disabled=false;' +
                'if(autoGenerate){setTimeout(()=>window.close(),1200);}' +
                '});' +
                'gif.on("abort",()=>{' +
                'URL.revokeObjectURL(workerUrl);' +
                'document.getElementById("save").disabled=false;' +
                'document.getElementById("lbl").textContent="GIF 변환이 중단되었습니다.";' +
                '});' +
                'gif.render();' +
                '}' +
                '}catch(err){' +
                'console.error("움짤 변환 오류:",err);' +
                'alert("변환 실패: "+(err&&err.message?err.message:err));' +
                'document.getElementById("save").disabled=false;' +
                'document.getElementById("lbl").textContent="변환 실패";' +
                '}' +
                '};' +
                'updateFormatUI();' +
                'updateMemoryWarning();' +
                '</script>' +
                '</body>' +
                '</html>';

            const blobUrl = URL.createObjectURL(
                new Blob([html], {
                    type: 'text/html;charset=utf-8',
                }),
            );

            GM_openInTab(blobUrl, {
                active: true,
                insert: true,
                setParent: true,
            });
        };

        reader.readAsDataURL(blob);
    }

    // ===========================================================
    // 아이콘
    // ===========================================================

    function buildRecordIcon(recording) {
        const svgNS = 'http://www.w3.org/2000/svg';

        let shape;

        if (recording) {
            shape = document.createElementNS(svgNS, 'polygon');

            shape.setAttribute('points', '8,5 19,12 8,19');

            shape.setAttribute('fill', '#ff0000');
        } else {
            shape = document.createElementNS(svgNS, 'circle');

            shape.setAttribute('cx', '12');

            shape.setAttribute('cy', '12');

            shape.setAttribute('r', '8');

            shape.setAttribute('fill', '#ffffff');
        }

        return makeSvgIcon(shape);
    }

    function updateButtonUI() {
        const btn = document.getElementById('yt-record-btn');

        if (!btn) return;

        btn.title = isRecording
            ? `녹화 중지 (클릭 시 저장) (${gifSettings.keyRecord})`
            : `녹화 시작 (${gifSettings.keyRecord})`;

        const oldSvg = btn.querySelector('svg');

        if (oldSvg) {
            oldSvg.remove();
        }

        btn.appendChild(buildRecordIcon(isRecording));
    }

    function updateGifButtonUI() {
        const btn = document.getElementById('yt-gif-btn');

        if (!btn) return;

        btn.title = isGifRecording
            ? `움짤 녹화 중지 (클릭 시 편집창 열림) (${gifSettings.keyGif})`
            : `움짤(GIF/WebP) 녹화 시작 (${gifSettings.keyGif})`;

        const oldSvg = btn.querySelector('svg');

        if (oldSvg) {
            oldSvg.remove();
        }

        btn.appendChild(buildGifIcon(isGifRecording));
    }

    function updateScreenshotButtonUI() {
        const btn = document.getElementById('yt-screenshot-btn');

        if (!btn) return;

        btn.title = `스크린샷 (${gifSettings.keyScreenshot})`;
    }

    function makeSvgIcon(pathOrCircleOrGroup) {
        const svgNS = 'http://www.w3.org/2000/svg';

        const svg = document.createElementNS(svgNS, 'svg');

        svg.setAttribute('height', '24');

        svg.setAttribute('viewBox', '0 0 24 24');

        svg.setAttribute('width', '24');

        svg.appendChild(pathOrCircleOrGroup);

        return svg;
    }

    function buildGifIcon(recording) {
        const svgNS = 'http://www.w3.org/2000/svg';

        const g = document.createElementNS(svgNS, 'g');

        const rect = document.createElementNS(svgNS, 'rect');

        rect.setAttribute('x', '2.5');

        rect.setAttribute('y', '6');

        rect.setAttribute('width', '19');

        rect.setAttribute('height', '12');

        rect.setAttribute('rx', '2');

        rect.setAttribute('fill', 'none');

        rect.setAttribute('stroke', recording ? '#ff0000' : 'currentColor');

        rect.setAttribute('stroke-width', '1.6');

        g.appendChild(rect);

        const text = document.createElementNS(svgNS, 'text');

        text.setAttribute('x', '12');

        text.setAttribute('y', '15.2');

        text.setAttribute('text-anchor', 'middle');

        text.setAttribute('font-size', '7.5');

        text.setAttribute('font-weight', 'bold');

        text.setAttribute('fill', recording ? '#ff0000' : 'currentColor');

        text.setAttribute('font-family', 'Arial, sans-serif');

        text.textContent = 'GIF';

        g.appendChild(text);

        return makeSvgIcon(g);
    }

    function buildScreenshotIcon() {
        const svgNS = 'http://www.w3.org/2000/svg';

        const rect = document.createElementNS(svgNS, 'rect');

        rect.setAttribute('x', '3');

        rect.setAttribute('y', '5');

        rect.setAttribute('width', '18');

        rect.setAttribute('height', '14');

        rect.setAttribute('rx', '2');

        rect.setAttribute('fill', 'none');

        rect.setAttribute('stroke', 'currentColor');

        rect.setAttribute('stroke-width', '1.8');

        const lens = document.createElementNS(svgNS, 'circle');

        lens.setAttribute('cx', '12');

        lens.setAttribute('cy', '12');

        lens.setAttribute('r', '3.5');

        lens.setAttribute('fill', 'none');

        lens.setAttribute('stroke', 'currentColor');

        lens.setAttribute('stroke-width', '1.8');

        const g = document.createElementNS(svgNS, 'g');

        g.appendChild(rect);

        g.appendChild(lens);

        return makeSvgIcon(g);
    }

    function buildCropIcon(active) {
        const svgNS = 'http://www.w3.org/2000/svg';

        const rect = document.createElementNS(svgNS, 'rect');

        rect.setAttribute('x', '3');

        rect.setAttribute('y', '5');

        rect.setAttribute('width', '18');

        rect.setAttribute('height', '14');

        rect.setAttribute('rx', '2');

        rect.setAttribute('fill', 'none');

        rect.setAttribute('stroke', active ? '#ff0000' : 'currentColor');

        rect.setAttribute('stroke-width', '1.8');

        rect.setAttribute('stroke-dasharray', '3,2');

        return makeSvgIcon(rect);
    }

    // ===========================================================
    // 쇼츠 전용: 플로팅 버튼
    // 쇼츠 컨트롤바(ytd-shorts-player-controls-cow)는 폭이 좁아
    // 버튼 3개를 끼워 넣으면 기존 버튼(전체화면 등)이 넘쳐서
    // 사라진다. 대신 컨트롤바 위쪽에 별도의 플로팅 버튼 줄을
    // position:fixed로 띄워서 기존 레이아웃을 전혀 건드리지 않는다.
    // ===========================================================

    const SHORTS_BTN_STYLE =
        'width:40px;height:40px;border-radius:50%;border:none;background:rgba(0,0,0,0.6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;';

    function ensureShortsButtonsWrap() {
        let wrap = document.getElementById('yt-shorts-extra-buttons');

        if (wrap) return wrap;

        wrap = document.createElement('div');

        wrap.id = 'yt-shorts-extra-buttons';

        wrap.style.cssText = 'position:fixed;z-index:9999;display:flex;gap:8px;';

        const recordBtn = document.createElement('button');

        recordBtn.id = 'yt-record-btn';

        recordBtn.title = `녹화 시작 (${gifSettings.keyRecord})`;

        recordBtn.style.cssText = SHORTS_BTN_STYLE;

        recordBtn.appendChild(buildRecordIcon(false));

        recordBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            toggleRecording();
        });

        const shotBtn = document.createElement('button');

        shotBtn.id = 'yt-screenshot-btn';

        shotBtn.title = `스크린샷 (${gifSettings.keyScreenshot})`;

        shotBtn.style.cssText = SHORTS_BTN_STYLE;

        shotBtn.appendChild(buildScreenshotIcon());

        shotBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            takeScreenshot();
        });

        const gifBtn = document.createElement('button');

        gifBtn.id = 'yt-gif-btn';

        gifBtn.title = `움짤(GIF/WebP) 녹화 시작 (${gifSettings.keyGif})`;

        gifBtn.style.cssText = SHORTS_BTN_STYLE;

        gifBtn.appendChild(buildGifIcon(false));

        gifBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            toggleGifRecording();
        });

        const cropBtn = document.createElement('button');

        cropBtn.id = 'yt-crop-btn';

        cropBtn.title = cropRegion
            ? `OCR 영역 해제 (${gifSettings.keyCrop})`
            : `OCR 영역 지정 (녹화/움짤 캡처 범위 선택) (${gifSettings.keyCrop})`;

        cropBtn.style.cssText = SHORTS_BTN_STYLE;

        cropBtn.appendChild(buildCropIcon(!!cropRegion));

        cropBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            toggleCropMode();
        });

        wrap.appendChild(recordBtn);

        wrap.appendChild(shotBtn);

        wrap.appendChild(gifBtn);

        wrap.appendChild(cropBtn);

        document.body.appendChild(wrap);

        return wrap;
    }

    function removeShortsButtonsWrap() {
        const wrap = document.getElementById('yt-shorts-extra-buttons');

        if (wrap) {
            wrap.remove();
        }
    }

    // ===========================================================
    // 버튼 생성
    // ===========================================================

    function createButton() {
        // -------------------------------------------------------
        // 유튜브 쇼츠는 컨트롤바에 끼워 넣지 않고 플로팅 버튼으로
        // 전체화면 버튼 바로 위에 띄운다.
        // -------------------------------------------------------

        const shortsFullscreenBtn = document.getElementById('fullscreen-button-shape');

        if (shortsFullscreenBtn) {
            const wrap = ensureShortsButtonsWrap();

            const rect = shortsFullscreenBtn.getBoundingClientRect();

            wrap.style.top = Math.max(8, rect.top - 48) + 'px';

            wrap.style.left = rect.left + 'px';

            return;
        }

        removeShortsButtonsWrap();

        let controls = document.querySelector('.ytp-right-controls');

        let insertBeforeNode = controls ? controls.firstChild : null;

        if (!controls) {
            const twitchSettingsBtn = document.querySelector(
                'button[data-a-target="player-settings-button"]',
            );

            if (twitchSettingsBtn) {
                controls = twitchSettingsBtn.parentElement;

                insertBeforeNode = twitchSettingsBtn;
            }
        }

        if (!controls) {
            const chzzkClipBtn = document.querySelector('.custom__clip-button');

            if (chzzkClipBtn) {
                controls = chzzkClipBtn.parentElement;

                insertBeforeNode = chzzkClipBtn.nextSibling;
            }
        }

        if (!controls) return;

        const svgNS = 'http://www.w3.org/2000/svg';

        // -------------------------------------------------------
        // 녹화 버튼
        // -------------------------------------------------------

        if (!document.getElementById('yt-record-btn')) {
            const recordBtn = document.createElement('button');

            recordBtn.id = 'yt-record-btn';

            recordBtn.className = 'ytp-button';

            recordBtn.title = `녹화 시작 (${gifSettings.keyRecord})`;

            recordBtn.style.cssText =
                'width:48px;height:100%;display:inline-flex;align-items:center;justify-content:center;opacity:1;visibility:visible;';

            recordBtn.appendChild(buildRecordIcon(false));

            recordBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                toggleRecording();
            });

            controls.insertBefore(recordBtn, insertBeforeNode);
        }

        // -------------------------------------------------------
        // 스크린샷 버튼
        // -------------------------------------------------------

        if (!document.getElementById('yt-screenshot-btn')) {
            const shotBtn = document.createElement('button');

            shotBtn.id = 'yt-screenshot-btn';

            shotBtn.className = 'ytp-button';

            shotBtn.title = `스크린샷 (${gifSettings.keyScreenshot})`;

            shotBtn.style.cssText =
                'color:#ffffff;width:48px;height:100%;display:inline-flex;align-items:center;justify-content:center;opacity:1;visibility:visible;';

            shotBtn.appendChild(buildScreenshotIcon());

            shotBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                takeScreenshot();
            });

            const recordBtn = document.getElementById('yt-record-btn');

            controls.insertBefore(shotBtn, recordBtn.nextSibling);
        }

        // -------------------------------------------------------
        // GIF 버튼
        // -------------------------------------------------------

        if (!document.getElementById('yt-gif-btn')) {
            const gifBtn = document.createElement('button');

            gifBtn.id = 'yt-gif-btn';

            gifBtn.className = 'ytp-button';

            gifBtn.title = `움짤(GIF/WebP) 녹화 시작 (${gifSettings.keyGif})`;

            gifBtn.style.cssText =
                'color:#ffffff;width:48px;height:100%;display:inline-flex;align-items:center;justify-content:center;opacity:1;visibility:visible;';

            gifBtn.appendChild(buildGifIcon(false));

            gifBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                toggleGifRecording();
            });

            const shotBtn = document.getElementById('yt-screenshot-btn');

            controls.insertBefore(gifBtn, shotBtn.nextSibling);
        }

        // -------------------------------------------------------
        // OCR 영역 지정 버튼
        // -------------------------------------------------------

        if (!document.getElementById('yt-crop-btn')) {
            const cropBtn = document.createElement('button');

            cropBtn.id = 'yt-crop-btn';

            cropBtn.className = 'ytp-button';

            cropBtn.title = cropRegion
                ? `OCR 영역 해제 (녹화/움짤이 다시 전체 화면을 캡처합니다) (${gifSettings.keyCrop})`
                : `OCR 영역 지정 (드래그로 녹화/움짤 캡처 범위를 선택합니다) (${gifSettings.keyCrop})`;

            cropBtn.style.cssText =
                'color:#ffffff;width:48px;height:100%;display:inline-flex;align-items:center;justify-content:center;opacity:1;visibility:visible;';

            cropBtn.appendChild(buildCropIcon(!!cropRegion));

            cropBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                toggleCropMode();
            });

            const gifBtn = document.getElementById('yt-gif-btn');

            controls.insertBefore(cropBtn, gifBtn.nextSibling);
        }
    }

    // ===========================================================
    // 설정 변경 시 버튼 title 즉시 갱신
    // ===========================================================

    document.addEventListener('yt-gif-settings-updated', () => {
        updateButtonUI();

        updateGifButtonUI();

        updateScreenshotButtonUI();

        updateCropButtonUI();
    });

    // ===========================================================
    // 단축키
    // ===========================================================

    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement && document.activeElement.tagName;

        const isTyping =
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            (document.activeElement && document.activeElement.isContentEditable);

        if (isTyping) return;

        const pressedKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;

        if (pressedKey === gifSettings.keyRecord) {
            e.preventDefault();

            toggleRecording();
        } else if (pressedKey === gifSettings.keyScreenshot) {
            e.preventDefault();

            takeScreenshot();
        } else if (pressedKey === gifSettings.keyGif) {
            e.preventDefault();

            toggleGifRecording();
        } else if (pressedKey === gifSettings.keyCrop) {
            e.preventDefault();

            toggleCropMode();
        }
    });

    // ===========================================================
    // 다른 영상으로 이동(SPA 네비게이션) 시 OCR 영역 자동 해제
    // 새로고침은 스크립트가 처음부터 다시 실행되므로 자동으로
    // 초기화되지만, 유튜브/트위치/치지직은 페이지를 새로 불러오지
    // 않고 내부적으로 영상만 바꾸는 경우가 많아 별도 감지가 필요하다.
    // ===========================================================

    let lastVideoKey = getCurrentVideoKey();

    function handlePossibleVideoChange() {
        const key = getCurrentVideoKey();

        if (key === lastVideoKey) return;

        lastVideoKey = key;

        if (cropRegion) {
            clearCropRegion();
        }
    }

    // 유튜브는 SPA 네비게이션 완료 시 이 이벤트를 발생시킨다.
    document.addEventListener('yt-navigate-finish', handlePossibleVideoChange);

    // 트위치/치지직 등은 위 이벤트가 없으므로 주소 변화를 주기적으로 확인한다.
    setInterval(handlePossibleVideoChange, 500);

    /*
     * <video> 태그가 새 리소스를 불러오기 시작하면(loadstart) 즉시
     * 확인한다. 단, 화질을 바꾸면 같은 영상인데도 리소스가 다시
     * 로드되며 이 이벤트가 발생할 수 있으므로, 실제로 "영상 키"
     * (유튜브 v= / shorts id, 또는 경로)가 바뀌었을 때만 해제한다.
     */
    document.addEventListener(
        'loadstart',
        (e) => {
            if (e.target && e.target.tagName === 'VIDEO') {
                handlePossibleVideoChange();
            }
        },
        true,
    );

    // ===========================================================
    // 현재 영상을 구분하는 "키" (화질 변경과 실제 영상 전환을 구분하기 위함)
    // 유튜브는 v= 파라미터(또는 쇼츠 id), 그 외 사이트는 쿼리스트링을
    // 제외한 경로를 기준으로 삼는다. 화질을 바꿔도 이 값은 그대로다.
    // ===========================================================

    function getCurrentVideoKey() {
        try {
            const url = new URL(location.href);

            if (location.hostname.includes('youtube.com')) {
                if (url.pathname.startsWith('/shorts/')) {
                    return 'yt-shorts:' + url.pathname.split('/')[2];
                }

                const v = url.searchParams.get('v');

                if (v) return 'yt:' + v;
            }

            return location.hostname + url.pathname;
        } catch (e) {
            return location.href;
        }
    }

    // ===========================================================
    // YouTube SPA 감시
    // ===========================================================

    const observer = new MutationObserver(() => createButton());

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    createButton();
})();
