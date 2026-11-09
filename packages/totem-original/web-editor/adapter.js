(() => {
  let editing = new URLSearchParams(location.search).get('editor') === '1';
  let state = window.__TOTEM_WEB_DOCUMENT__ || {};
  let selectedCanvas = null, selectedNode = null, viewScreen = null, drag = null, rendered = '';
  const basePositions = new WeakMap();
  const stageNode = document.querySelector('#stage');
  const send = (type, data = {}) => {
    if(parent===window&&!editing)return;
    parent.postMessage({type,...data},location.origin==='null'?'*':location.origin);
  };
  const style = document.createElement('style');
  style.textContent = `
    #stage.bo-canvas-mode>section.demos{display:none!important}
    #stage.bo-fullscreen>.hdr,#stage.bo-fullscreen>.hero,#stage.bo-fullscreen>#vband{visibility:hidden}
    #stage.bo-canvas-mode>.hdr[data-totem-shell="header-bg"]{position:absolute;left:0;top:0;width:1080px;height:110px;bottom:auto}
    #stage.bo-canvas-mode>.hero[data-totem-shell="hero-bg"]{position:absolute;left:0;top:110px;width:1080px;height:580px;bottom:auto}
    #stage.bo-canvas-mode>#vband[data-totem-shell="footer-bg"]{position:absolute;left:0;top:1770px;right:auto;bottom:auto;width:1080px;height:150px}
    #stage.bo-canvas-mode>.hdr[data-totem-shell="header-bg"]{z-index:2}
    #stage.bo-canvas-mode>.hero[data-totem-shell="hero-bg"]{z-index:2}
    #stage.bo-canvas-mode>#vband[data-totem-shell="footer-bg"]{z-index:4}
    [data-totem-shell="header-bg"],[data-totem-shell="hero-bg"],[data-totem-shell="footer-bg"]{box-sizing:border-box}
    [data-bo-shell-media]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none}
    .hero>.txt{z-index:2}.hero:after{pointer-events:none}.hero.bo-solid-color:after{display:none}
    #stage.bo-canvas-mode [data-totem-shell][style*="z-index"]{position:absolute}
    #bo-canvas{position:absolute;left:0;top:690px;width:1080px;height:1080px;overflow:hidden;background:#fff;z-index:3}
    #stage.bo-fullscreen>#bo-canvas{top:0;height:1920px;z-index:4}
    .bo-element{position:absolute;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding:32px;white-space:pre-wrap;line-height:1.12}
    .bo-element.card{padding:40px;gap:12px;border-top:6px solid #00bef4}
    .bo-element.card small{font-size:.65em;font-weight:400}
    .bo-element.button{align-items:center;cursor:pointer}
    .bo-element.image.bo-no-padding{padding:0}
    .bo-element img,.bo-element video{width:100%;height:100%;object-fit:contain;min-height:0}
    .bo-element.image.bo-no-padding img{object-fit:cover}
    .bo-element.video{padding:0}
    .bo-placeholder{font-size:28px;color:#7a7d80;text-align:center;border:2px dashed #cbd0d6;padding:12px}
    .bo-back{position:absolute;z-index:6;top:18px;left:18px;padding:12px 24px;background:#033778;color:white;border:0;font:28px inherit;cursor:pointer}
    #bo-selection{position:absolute;z-index:99;border:3px solid #00bef4;pointer-events:none;box-sizing:border-box}
    #bo-selection[hidden]{display:none}
    .bo-handle{position:absolute;width:20px;height:20px;border:2px solid white;background:#00aadb;border-radius:50%;pointer-events:auto;touch-action:none}
    .bo-handle[data-handle=nw]{left:-11px;top:-11px;cursor:nwse-resize}.bo-handle[data-handle=ne]{right:-11px;top:-11px;cursor:nesw-resize}
    .bo-handle[data-handle=sw]{left:-11px;bottom:-11px;cursor:nesw-resize}.bo-handle[data-handle=se]{right:-11px;bottom:-11px;cursor:nwse-resize}
    .bo-handle[data-handle=n]{left:calc(50% - 10px);top:-11px;cursor:ns-resize}.bo-handle[data-handle=s]{left:calc(50% - 10px);bottom:-11px;cursor:ns-resize}
    .bo-handle[data-handle=w]{left:-11px;top:calc(50% - 10px);cursor:ew-resize}.bo-handle[data-handle=e]{right:-11px;top:calc(50% - 10px);cursor:ew-resize}
  `;
  document.head.appendChild(style);
  const shell = {
    'header-bg': '.hdr', logo: '.hdr .logo', tagline: '.hdr .tag',
    'hero-bg': '.hero', 'hero-video': '#heroVid',
    'hero-eyebrow': '.hero .eyebrow', 'hero-title': '.hero h1', 'hero-subtitle': '.hero p',
    'footer-bg': '#vband', 'footer-eyebrow': '#vband small', 'footer-title': '#vband b', 'footer-subtitle': '#vband .s',
    'footer-icon': '#vband .vgo svg',
  };
  for (const [id, selector] of Object.entries(shell)) {
    const node=document.querySelector(selector);
    if(node){node.setAttribute('data-totem-shell',id);if(id==='hero-video')node.dataset.originalSrc=node.getAttribute('src')||'';}
  }
  const cta = document.querySelector('#vband .vgo');
  if (cta) {
    const label = document.createElement('span');
    for (const node of [...cta.childNodes]) if (node.nodeType === Node.TEXT_NODE) label.appendChild(node);
    label.dataset.totemShell = 'footer-cta'; cta.prepend(label);
  }
  const selection = document.createElement('div'); selection.id = 'bo-selection'; selection.hidden = true;
  for (const handle of ['nw','n','ne','e','se','s','sw','w']) {
    const dot = document.createElement('i'); dot.className = 'bo-handle'; dot.dataset.handle = handle; selection.appendChild(dot);
  }
  (stageNode || document.body).appendChild(selection);
  const stageBox = () => stageNode?.getBoundingClientRect() || {left:0, top:0, width:1080};
  const scale = () => 1080 / (stageBox().width || 1080);
  const screen = () => state.screens?.find(s => s.id === viewScreen) || state.screens?.[0];
  const canvasElement = id => screen()?.elements.find(el => el.id === id);
  const selectorFor = node => {
    if (node.dataset.totemShell) return `[data-totem-shell="${node.dataset.totemShell}"]`;
    if (node.id) return `#${CSS.escape(node.id)}`;
    const parts = [];
    while (node && node.nodeType === 1 && node !== document.body) {
      let part = node.tagName.toLowerCase();
      const classes = [...node.classList].filter(c => !['attract','on','open','anim'].includes(c));
      if (classes.length) part += '.' + classes.slice(0,2).map(CSS.escape).join('.');
      const siblings = node.parentElement ? [...node.parentElement.children].filter(x => x.tagName === node.tagName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node)+1})`;
      parts.unshift(part); node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const canEditText = node => !node.matches('img,video,source,canvas,input,br,hr,iframe') && !node.closest('svg,script,style') && (!node.children.length || [...node.children].every(c => c.tagName === 'BR'));
  const textOf = node => node.innerText ?? node.textContent;
  const showSelection = () => {
    const node = selectedCanvas ? document.querySelector(`[data-bo-element="${CSS.escape(selectedCanvas)}"]`) : selectedNode;
    if (!editing || !node?.isConnected) { selection.hidden = true; return; }
    if(getComputedStyle(node).display==='none'){selection.hidden=true;return;}
    const rect = node.getBoundingClientRect(), stage = stageBox(), s = scale();
    selection.hidden = false;
    Object.assign(selection.style, {left:`${(rect.left-stage.left)*s}px`,top:`${(rect.top-stage.top)*s}px`,width:`${rect.width*s}px`,height:`${rect.height*s}px`});
    const movable=selectedCanvas?!canvasElement(selectedCanvas)?.locked:!!selectedNode&&state.contentMode==='canvas';
    for (const handle of selection.children) handle.style.display = movable ? '' : 'none';
  };
  const selectWeb = node => {
    selectedCanvas = null; selectedNode = node;
    const rect = node.getBoundingClientRect(), stage = stageBox(), s = scale(),selector=selectorFor(node),saved=window.__TOTEM_WEB_OVERRIDES__?.[selector]||{};
    const text = canEditText(node) ? textOf(node).trim() : '';
    const textItems = text ? [] : [...node.querySelectorAll('*')].filter(n => canEditText(n) && textOf(n).trim()).slice(0,48).map(n => ({selector:selectorFor(n),text:textOf(n).trim()}));
    send('totem-element-selected', {element:{selector,tag:node.tagName.toLowerCase(),text,textEditable:canEditText(node),textItems,src:node.getAttribute('src')||'',x:saved.x??Math.round((rect.left-stage.left)*s),y:saved.y??Math.round((rect.top-stage.top)*s),width:saved.width??Math.round(rect.width*s),height:saved.height??Math.round(rect.height*s),color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor}});
    showSelection();
  };
  const selectCanvas = id => {
    selectedCanvas = id; selectedNode = null; showSelection();
    send('totem-canvas-selected', {id,screenId:screen()?.id});
  };
  const apply = (selector, value) => {
    let target; try { target = document.querySelector(selector); } catch { return; }
    if (!target || !value) return;
    if (!basePositions.has(target)) {
      const box=target.getBoundingClientRect(), stage=stageBox(), s=scale();
      basePositions.set(target,{x:(box.left-stage.left)*s,y:(box.top-stage.top)*s});
    }
    if (value.text !== undefined && canEditText(target) && target.textContent !== value.text) {
      target.textContent = value.text; target.style.whiteSpace = 'pre-line';
    }
    const shellId=target.dataset.totemShell;
    if(shellId){
      if(value.hidden)target.style.display='none';else if(shellId!=='hero-video'||value.mode!=='color')target.style.removeProperty('display');
      if(value.background)target.style.backgroundColor=value.background;
      if(Number.isFinite(value.zIndex))target.style.zIndex=String(value.zIndex);
      if(shellId==='hero-bg')target.classList.toggle('bo-solid-color',value.mode==='color');
      if(value.mode==='color'){
        target.querySelectorAll('[data-bo-shell-media]').forEach(node=>node.remove());
        if(shellId==='hero-bg'){
          const video=document.querySelector('#heroVid');if(video)video.style.display='none';
          target.style.backgroundColor=value.background||'#033778';
        }
        if(shellId==='hero-video')target.style.display='none';
      }else if(shellId==='hero-bg'||shellId==='hero-video'){
        const video=document.querySelector('#heroVid');
        if(value.mode==='image'&&value.src){
          if(video)video.style.display='none';
          let image=document.querySelector(`[data-bo-shell-media="${shellId}"]`);
          if(!image){image=document.createElement('img');image.dataset.boShellMedia=shellId;const host=shellId==='hero-video'?target.parentElement:target;host.insertBefore(image,shellId==='hero-bg'?target.querySelector('.txt'):target.nextSibling);}
          if(image.getAttribute('src')!==value.src)image.src=value.src;
        }else if(value.mode==='video'&&value.src){
          document.querySelectorAll('[data-bo-shell-media]').forEach(node=>node.remove());
          const targetVideo=shellId==='hero-bg'?video:target;
          if(targetVideo?.matches('video')){targetVideo.style.display='';if(targetVideo.getAttribute('src')!==value.src){targetVideo.src=value.src;targetVideo.load();targetVideo.play().catch(()=>{});}}
        }else if(value.mode!=='color'&&value.mode!=='image'){
          document.querySelectorAll('[data-bo-shell-media]').forEach(node=>node.remove());
          if(video){if(shellId==='hero-bg')video.style.removeProperty('display');const original=video.dataset.originalSrc;if(original&&video.getAttribute('src')!==original){video.src=original;video.load();video.play().catch(()=>{});}}
          if(shellId==='hero-video')target.style.removeProperty('display');
        }
      }
    }
    if (value.src && target.matches('svg')) {
      const image = document.createElement('img'), css = getComputedStyle(target);
      for (const attr of ['id','class','data-totem-shell']) if (target.hasAttribute(attr)) image.setAttribute(attr,target.getAttribute(attr));
      image.style.cssText=target.style.cssText; image.style.width=css.width; image.style.height=css.height; image.style.objectFit='contain'; image.alt='';
      basePositions.set(image,basePositions.get(target));
      if (selectedNode===target) selectedNode=image;
      target.replaceWith(image); target=image;
    }
    if (value.src && target.matches('img,video,source') && target.getAttribute('src') !== value.src) {
      target.src=value.src; if (target.matches('video')) target.load();
    }
    if (value.x != null || value.y != null) {
      const base=basePositions.get(target); target.style.translate=`${(value.x??base.x)-base.x}px ${(value.y??base.y)-base.y}px`;
    }
    if (value.width != null) target.style.width=`${value.width}px`;
    if (value.height != null) target.style.height=`${value.height}px`;
  };
  const setViewScreen = id => {
    viewScreen=id; selectedCanvas=null; rendered=''; renderCanvas();
    if (editing) send('totem-canvas-screen',{screenId:screen()?.id});
  };
  const renderCanvas = () => {
    const canvasMode=state.contentMode==='canvas';
    stageNode?.classList.toggle('bo-canvas-mode',canvasMode);
    if(!canvasMode)return;
    if(!viewScreen||!state.screens?.some(s=>s.id===viewScreen))viewScreen=state.screens?.[0]?.id;
    const current=screen(); if(!current)return;
    stageNode.classList.toggle('bo-fullscreen',current.mode==='fullscreen');
    const signature=JSON.stringify([current,editing]); if(signature===rendered)return;
    rendered=signature;
    let canvas=document.querySelector('#bo-canvas');
    if(!canvas){canvas=document.createElement('div');canvas.id='bo-canvas';stageNode.insertBefore(canvas,selection);}
    canvas.querySelectorAll("video").forEach(video=>video.pause());
    canvas.replaceChildren();
    for(const el of current.elements){
      const node=document.createElement('div');node.dataset.boElement=el.id;node.className=`bo-element ${el.type}${el.imageNoPadding?' bo-no-padding':''}`;
      Object.assign(node.style,{left:`${el.x}px`,top:`${el.y}px`,width:`${el.width}px`,height:`${el.height}px`,fontSize:`${el.fontSize||36}px`,color:el.color||'#17366f',background:el.background||(el.type==='button'?'#033778':'transparent')});
      if(el.type==='image'||el.type==='video'){
        if(el.src){const media=document.createElement(el.type==='image'?'img':'video');media.src=el.src;media.draggable=false;
          if(el.type==='video'){media.controls=true;media.muted=true;media.playsInline=true;media.preload='metadata';}else media.alt=el.title||'';
          node.appendChild(media);
        }else if(editing){const placeholder=document.createElement('span');placeholder.className='bo-placeholder';placeholder.textContent=el.type==='image'?'Selecciona una imagen':'Selecciona un vídeo';node.appendChild(placeholder);}
      }else if(el.type==='card'){
        const title=document.createElement('strong');title.textContent=el.title||el.text||'';
        const description=document.createElement('small');description.textContent=el.description||'';node.append(title,description);
      }else node.textContent=el.text||el.title||'';
      node.addEventListener('click',()=>{if(!editing&&el.target)setViewScreen(el.target);});canvas.appendChild(node);
    }
    if(current.id!==state.screens[0]?.id){const back=document.createElement('button');back.className='bo-back';back.dataset.boBack='true';back.textContent='← Inicio';back.addEventListener('click',()=>setViewScreen(state.screens[0].id));canvas.appendChild(back);}
    showSelection();
  };
  const applyAll = () => {
    renderCanvas();
    Object.entries(window.__TOTEM_WEB_OVERRIDES__||{}).forEach(([selector,value])=>apply(selector,value));
    Object.entries(window.__TOTEM_WEB_MEDIA__||{}).forEach(([selector,src])=>apply(selector,{...(window.__TOTEM_WEB_OVERRIDES__?.[selector]||{}),src}));
    showSelection();
  };
  let scheduled=false;
  new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;applyAll();});}}).observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin||!event.data)return;
    const data=event.data;
    if(data.type==='totem-editor-mode'){editing=!!data.enabled;rendered='';applyAll();}
    if(data.type==='totem-web-overrides'){window.__TOTEM_WEB_OVERRIDES__=data.overrides||{};applyAll();}
    if(data.type==='totem-web-media'){window.__TOTEM_WEB_MEDIA__=data.media||{};applyAll();}
    if(data.type==='totem-web-document'){state=data.document||{};if(editing&&data.activeScreen)viewScreen=data.activeScreen;applyAll();}
    if(data.type==='totem-select-shell'){const node=document.querySelector(`[data-totem-shell="${CSS.escape(data.id)}"]`);if(node)selectWeb(node);}
    if(data.type==='totem-select-canvas'){selectedCanvas=data.id||null;if(data.id)selectedNode=null;showSelection();}
  });
  const elementTarget = event => {
    let node=event.target instanceof Element?event.target:null;
    return node?.closest('[data-totem-shell]')||node?.closest('svg')||node;
  };
  document.addEventListener('click',event=>{
    if(!editing||event.target.closest('[data-bo-back]'))return;
    if(event.target.closest('#bo-selection')){event.preventDefault();event.stopImmediatePropagation();return;}
    event.preventDefault();event.stopImmediatePropagation();
    const canvas=event.target.closest('[data-bo-element]');
    if(canvas){selectCanvas(canvas.dataset.boElement);return;}
    const target=elementTarget(event);
    if(state.contentMode==='canvas'&&!target?.closest('[data-totem-shell]')){selectedCanvas=null;selectedNode=null;showSelection();send('totem-canvas-selected',{id:null,screenId:screen()?.id});return;}
    if(target&&target!==document.body&&target!==stageNode)selectWeb(target);
  },true);
  document.addEventListener('pointerdown',event=>{
    if(!editing)return;
    // Keep the source kiosk's fullscreen and interaction handlers out of edit gestures.
    event.stopImmediatePropagation();
    if(event.target.closest('[data-bo-back]'))return;
    const handle=event.target.closest('[data-handle]');
    const node=handle?document.querySelector(`[data-bo-element="${CSS.escape(selectedCanvas||'')}"]`):event.target.closest('[data-bo-element]');
    const shellNode=state.contentMode==='canvas'?(handle?selectedNode:elementTarget(event)):null;
    if(!node&&!shellNode)return;
    if(shellNode?.dataset.totemShell){
      selectWeb(shellNode);event.preventDefault();shellNode.setPointerCapture(event.pointerId);
      const rect=shellNode.getBoundingClientRect(),box=stageBox(),s=scale();
      drag={node:shellNode,selector:selectorFor(shellNode),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,handle:handle?.dataset.handle,original:{x:(rect.left-box.left)*s,y:(rect.top-box.top)*s,width:rect.width*s,height:rect.height*s},next:null};
      return;
    }
    if(!node)return;
    selectCanvas(node.dataset.boElement);const el=canvasElement(node.dataset.boElement);if(!el||el.locked)return;
    event.preventDefault();node.setPointerCapture(event.pointerId);
    drag={node,id:el.id,screenId:screen().id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,handle:handle?.dataset.handle,original:{x:el.x,y:el.y,width:el.width,height:el.height},next:null};
  },true);
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();event.stopImmediatePropagation();
    const dx=(event.clientX-drag.startX)*scale(),dy=(event.clientY-drag.startY)*scale(),o=drag.original,h=drag.screenId?(screen().mode==='embedded'?1080:1920):1920;
    let {x,y,width,height}=o;
    if(drag.handle){
      let left=o.x,right=o.x+o.width,top=o.y,bottom=o.y+o.height;
      if(drag.handle.includes('w'))left=Math.max(0,Math.min(right-40,o.x+dx));
      if(drag.handle.includes('e'))right=Math.min(1080,Math.max(left+40,o.x+o.width+dx));
      if(drag.handle.includes('n'))top=Math.max(0,Math.min(bottom-40,o.y+dy));
      if(drag.handle.includes('s'))bottom=Math.min(h,Math.max(top+40,o.y+o.height+dy));
      x=left;y=top;width=right-left;height=bottom-top;
    }else{x=Math.max(0,Math.min(1080-width,o.x+dx));y=Math.max(0,Math.min(h-height,o.y+dy));}
    drag.next={x:Math.round(x),y:Math.round(y),width:Math.round(width),height:Math.round(height)};
    Object.assign(drag.node.style,{left:`${x}px`,top:`${y}px`,width:`${width}px`,height:`${height}px`});showSelection();
  },true);
  const finishDrag=event=>{if(!drag||event.pointerId!==drag.pointerId)return;const finished=drag;drag=null;
    if(finished.next){if(finished.selector)send('totem-shell-changed',{selector:finished.selector,changes:finished.next});else send('totem-canvas-changed',{id:finished.id,screenId:finished.screenId,changes:finished.next});}};
  document.addEventListener('pointerup',finishDrag,true);document.addEventListener('pointercancel',finishDrag,true);
  document.addEventListener('keydown',event=>{
    if(!editing&&state.contentMode==='canvas'&&event.key==='Escape'){setViewScreen(state.screens?.[0]?.id);return;}
    if(!editing||!selectedCanvas||canvasElement(selectedCanvas)?.locked||!['Delete','Backspace'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();send('totem-canvas-delete',{id:selectedCanvas,screenId:screen()?.id});
  },true);
  document.addEventListener('dragover',event=>{if(editing&&state.contentMode==='canvas'&&event.dataTransfer?.types.includes('application/x-totem-element')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
  document.addEventListener('drop',event=>{
    if(!editing||state.contentMode!=='canvas')return;
    const type=event.dataTransfer?.getData('application/x-totem-element');if(!['text','image','video','card','button'].includes(type))return;
    event.preventDefault();const box=stageBox(),s=scale(),y=(event.clientY-box.top)*s-(screen()?.mode==='embedded'?690:0),x=(event.clientX-box.left)*s;
    if(x<0||x>1080||y<0||y>(screen()?.mode==='embedded'?1080:1920))return;
    send('totem-canvas-add',{elementType:type,x:Math.round(x),y:Math.round(y),screenId:screen()?.id});
  });
  window.addEventListener('resize',showSelection);
  applyAll();send('totem-editor-ready');
})();
