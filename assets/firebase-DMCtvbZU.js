import{r as D,I as Bc,_ as Pi,q as dh,aJ as es,l as nt,U as fh,aX as mh,d as rt,g as ns,m as Vi,Q as ph,c as qc,C as Me,N as Di,F as Ni,b3 as xi,S as Vr,c4 as gh,c5 as _h,X as yh,a9 as Eh,K as zc,Z as Hc,bh as Gc,bq as Wc,p as vh,n as Th,ax as wh,o as Ih,t as Ah,c6 as Ch,c7 as Rh}from"./index-DSnS7pW0.js";var bh={icon:{tag:"svg",attrs:{viewBox:"64 64 896 896",focusable:"false"},children:[{tag:"path",attrs:{d:"M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm32 664c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V456c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272zm-32-344a48.01 48.01 0 010-96 48.01 48.01 0 010 96z"}}]},name:"info-circle",theme:"filled"},Sh=function(t,e){return D.createElement(Bc,Pi({},t,{ref:e,icon:bh}))},B_=D.forwardRef(Sh),Ph=`accept acceptCharset accessKey action allowFullScreen allowTransparency
    alt async autoComplete autoFocus autoPlay capture cellPadding cellSpacing challenge
    charSet checked classID className colSpan cols content contentEditable contextMenu
    controls coords crossOrigin data dateTime default defer dir disabled download draggable
    encType form formAction formEncType formMethod formNoValidate formTarget frameBorder
    headers height hidden high href hrefLang htmlFor httpEquiv icon id inputMode integrity
    is keyParams keyType kind label lang list loop low manifest marginHeight marginWidth max maxLength media
    mediaGroup method min minLength multiple muted name noValidate nonce open
    optimum pattern placeholder poster preload radioGroup readOnly rel required
    reversed role rowSpan rows sandbox scope scoped scrolling seamless selected
    shape size sizes span spellCheck src srcDoc srcLang srcSet start step style
    summary tabIndex target title type useMap value width wmode wrap`,Vh=`onCopy onCut onPaste onCompositionEnd onCompositionStart onCompositionUpdate onKeyDown
    onKeyPress onKeyUp onFocus onBlur onChange onInput onSubmit onClick onContextMenu onDoubleClick
    onDrag onDragEnd onDragEnter onDragExit onDragLeave onDragOver onDragStart onDrop onMouseDown
    onMouseEnter onMouseLeave onMouseMove onMouseOut onMouseOver onMouseUp onSelect onTouchCancel
    onTouchEnd onTouchMove onTouchStart onScroll onWheel onAbort onCanPlay onCanPlayThrough
    onDurationChange onEmptied onEncrypted onEnded onError onLoadedData onLoadedMetadata
    onLoadStart onPause onPlay onPlaying onProgress onRateChange onSeeked onSeeking onStalled onSuspend onTimeUpdate onVolumeChange onWaiting onLoad onError`,Dh="".concat(Ph," ").concat(Vh).split(/[\s\n]+/),Nh="aria-",xh="data-";function Aa(n,t){return n.indexOf(t)===0}function kh(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:!1,e;t===!1?e={aria:!0,data:!0,attr:!0}:t===!0?e={aria:!0}:e=dh({},t);var r={};return Object.keys(n).forEach(function(s){(e.aria&&(s==="role"||Aa(s,Nh))||e.data&&Aa(s,xh)||e.attr&&Dh.includes(s))&&(r[s]=n[s])}),r}function Ca(...n){const t={};return n.forEach(e=>{e&&Object.keys(e).forEach(r=>{e[r]!==void 0&&(t[r]=e[r])})}),t}function q_(n){if(!n)return;const{closable:t,closeIcon:e}=n;return{closable:t,closeIcon:e}}function Ra(n){const{closable:t,closeIcon:e}=n||{};return nt.useMemo(()=>{if(!t&&(t===!1||e===!1||e===null))return!1;if(t===void 0&&e===void 0)return null;let r={closeIcon:typeof e!="boolean"&&e!==null?e:void 0};return t&&typeof t=="object"&&(r=Object.assign(Object.assign({},r),t)),r},[t,e])}const Oh={};function z_(n,t,e=Oh){const r=Ra(n),s=Ra(t),[o]=es("global",mh.global),a=typeof r!="boolean"?!!r?.disabled:!1,l=nt.useMemo(()=>Object.assign({closeIcon:nt.createElement(fh,null)},e),[e]),h=nt.useMemo(()=>r===!1?!1:r?Ca(l,s,r):s===!1?!1:s?Ca(l,s):l.closable?l:!1,[r,s,l]);return nt.useMemo(()=>{var d,m;if(h===!1)return[!1,null,a,{}];const{closeIconRender:_}=l,{closeIcon:v}=h;let C=v;const V=kh(h,!0);return C!=null&&(_&&(C=_(v)),C=nt.isValidElement(C)?nt.cloneElement(C,Object.assign(Object.assign(Object.assign({},C.props),{"aria-label":(m=(d=C.props)===null||d===void 0?void 0:d["aria-label"])!==null&&m!==void 0?m:o.close}),V)):nt.createElement("span",Object.assign({"aria-label":o.close},V),C)),[!0,C,a,V]},[h,l])}const rs=n=>{const{prefixCls:t,className:e,style:r,size:s,shape:o}=n,a=rt({[`${t}-lg`]:s==="large",[`${t}-sm`]:s==="small"}),l=rt({[`${t}-circle`]:o==="circle",[`${t}-square`]:o==="square",[`${t}-round`]:o==="round"}),h=D.useMemo(()=>typeof s=="number"?{width:s,height:s,lineHeight:`${s}px`}:{},[s]);return D.createElement("span",{className:rt(t,a,l,e),style:Object.assign(Object.assign({},h),r)})},Mh=new ph("ant-skeleton-loading",{"0%":{backgroundPosition:"100% 50%"},"100%":{backgroundPosition:"0 50%"}}),ss=n=>({height:n,lineHeight:qc(n)}),Ze=n=>Object.assign({width:n},ss(n)),Lh=n=>({background:n.skeletonLoadingBackground,backgroundSize:"400% 100%",animationName:Mh,animationDuration:n.skeletonLoadingMotionDuration,animationTimingFunction:"ease",animationIterationCount:"infinite"}),Ks=(n,t)=>Object.assign({width:t(n).mul(5).equal(),minWidth:t(n).mul(5).equal()},ss(n)),Fh=n=>{const{skeletonAvatarCls:t,gradientFromColor:e,controlHeight:r,controlHeightLG:s,controlHeightSM:o}=n;return{[t]:Object.assign({display:"inline-block",verticalAlign:"top",background:e},Ze(r)),[`${t}${t}-circle`]:{borderRadius:"50%"},[`${t}${t}-lg`]:Object.assign({},Ze(s)),[`${t}${t}-sm`]:Object.assign({},Ze(o))}},$h=n=>{const{controlHeight:t,borderRadiusSM:e,skeletonInputCls:r,controlHeightLG:s,controlHeightSM:o,gradientFromColor:a,calc:l}=n;return{[r]:Object.assign({display:"inline-block",verticalAlign:"top",background:a,borderRadius:e},Ks(t,l)),[`${r}-lg`]:Object.assign({},Ks(s,l)),[`${r}-sm`]:Object.assign({},Ks(o,l))}},ba=n=>Object.assign({width:n},ss(n)),jh=n=>{const{skeletonImageCls:t,imageSizeBase:e,gradientFromColor:r,borderRadiusSM:s,calc:o}=n;return{[t]:Object.assign(Object.assign({display:"inline-flex",alignItems:"center",justifyContent:"center",verticalAlign:"middle",background:r,borderRadius:s},ba(o(e).mul(2).equal())),{[`${t}-path`]:{fill:"#bfbfbf"},[`${t}-svg`]:Object.assign(Object.assign({},ba(e)),{maxWidth:o(e).mul(4).equal(),maxHeight:o(e).mul(4).equal()}),[`${t}-svg${t}-svg-circle`]:{borderRadius:"50%"}}),[`${t}${t}-circle`]:{borderRadius:"50%"}}},Qs=(n,t,e)=>{const{skeletonButtonCls:r}=n;return{[`${e}${r}-circle`]:{width:t,minWidth:t,borderRadius:"50%"},[`${e}${r}-round`]:{borderRadius:t}}},Xs=(n,t)=>Object.assign({width:t(n).mul(2).equal(),minWidth:t(n).mul(2).equal()},ss(n)),Uh=n=>{const{borderRadiusSM:t,skeletonButtonCls:e,controlHeight:r,controlHeightLG:s,controlHeightSM:o,gradientFromColor:a,calc:l}=n;return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({[e]:Object.assign({display:"inline-block",verticalAlign:"top",background:a,borderRadius:t,width:l(r).mul(2).equal(),minWidth:l(r).mul(2).equal()},Xs(r,l))},Qs(n,r,e)),{[`${e}-lg`]:Object.assign({},Xs(s,l))}),Qs(n,s,`${e}-lg`)),{[`${e}-sm`]:Object.assign({},Xs(o,l))}),Qs(n,o,`${e}-sm`))},Bh=n=>{const{componentCls:t,skeletonAvatarCls:e,skeletonTitleCls:r,skeletonParagraphCls:s,skeletonButtonCls:o,skeletonInputCls:a,skeletonImageCls:l,controlHeight:h,controlHeightLG:d,controlHeightSM:m,gradientFromColor:_,padding:v,marginSM:C,borderRadius:V,titleHeight:k,blockRadius:P,paragraphLiHeight:M,controlHeightXS:$,paragraphMarginTop:U}=n;return{[t]:{display:"table",width:"100%",[`${t}-header`]:{display:"table-cell",paddingInlineEnd:v,verticalAlign:"top",[e]:Object.assign({display:"inline-block",verticalAlign:"top",background:_},Ze(h)),[`${e}-circle`]:{borderRadius:"50%"},[`${e}-lg`]:Object.assign({},Ze(d)),[`${e}-sm`]:Object.assign({},Ze(m))},[`${t}-content`]:{display:"table-cell",width:"100%",verticalAlign:"top",[r]:{width:"100%",height:k,background:_,borderRadius:P,[`+ ${s}`]:{marginBlockStart:m}},[s]:{padding:0,"> li":{width:"100%",height:M,listStyle:"none",background:_,borderRadius:P,"+ li":{marginBlockStart:$}}},[`${s}> li:last-child:not(:first-child):not(:nth-child(2))`]:{width:"61%"}},[`&-round ${t}-content`]:{[`${r}, ${s} > li`]:{borderRadius:V}}},[`${t}-with-avatar ${t}-content`]:{[r]:{marginBlockStart:C,[`+ ${s}`]:{marginBlockStart:U}}},[`${t}${t}-element`]:Object.assign(Object.assign(Object.assign(Object.assign({display:"inline-block",width:"auto"},Uh(n)),Fh(n)),$h(n)),jh(n)),[`${t}${t}-block`]:{width:"100%",[o]:{width:"100%"},[a]:{width:"100%"}},[`${t}${t}-active`]:{[`
        ${r},
        ${s} > li,
        ${e},
        ${o},
        ${a},
        ${l}
      `]:Object.assign({},Lh(n))}}},qh=n=>{const{colorFillContent:t,colorFill:e}=n,r=t,s=e;return{color:r,colorGradientEnd:s,gradientFromColor:r,gradientToColor:s,titleHeight:n.controlHeight/2,blockRadius:n.borderRadiusSM,paragraphMarginTop:n.marginLG+n.marginXXS,paragraphLiHeight:n.controlHeight/2}},un=ns("Skeleton",n=>{const{componentCls:t,calc:e}=n,r=Vi(n,{skeletonAvatarCls:`${t}-avatar`,skeletonTitleCls:`${t}-title`,skeletonParagraphCls:`${t}-paragraph`,skeletonButtonCls:`${t}-button`,skeletonInputCls:`${t}-input`,skeletonImageCls:`${t}-image`,imageSizeBase:e(n.controlHeight).mul(1.5).equal(),borderRadius:100,skeletonLoadingBackground:`linear-gradient(90deg, ${n.gradientFromColor} 25%, ${n.gradientToColor} 37%, ${n.gradientFromColor} 63%)`,skeletonLoadingMotionDuration:"1.4s"});return Bh(r)},qh,{deprecatedTokens:[["color","gradientFromColor"],["colorGradientEnd","gradientToColor"]]}),zh=n=>{const{prefixCls:t,className:e,rootClassName:r,active:s,shape:o="circle",size:a="default"}=n,{getPrefixCls:l}=D.useContext(Me),h=l("skeleton",t),[d,m,_]=un(h),v=Di(n,["prefixCls","className"]),C=rt(h,`${h}-element`,{[`${h}-active`]:s},e,r,m,_);return d(D.createElement("div",{className:C},D.createElement(rs,Object.assign({prefixCls:`${h}-avatar`,shape:o,size:a},v))))},Hh=n=>{const{prefixCls:t,className:e,rootClassName:r,active:s,block:o=!1,size:a="default"}=n,{getPrefixCls:l}=D.useContext(Me),h=l("skeleton",t),[d,m,_]=un(h),v=Di(n,["prefixCls"]),C=rt(h,`${h}-element`,{[`${h}-active`]:s,[`${h}-block`]:o},e,r,m,_);return d(D.createElement("div",{className:C},D.createElement(rs,Object.assign({prefixCls:`${h}-button`,size:a},v))))},Gh="M365.714286 329.142857q0 45.714286-32.036571 77.677714t-77.677714 32.036571-77.677714-32.036571-32.036571-77.677714 32.036571-77.677714 77.677714-32.036571 77.677714 32.036571 32.036571 77.677714zM950.857143 548.571429l0 256-804.571429 0 0-109.714286 182.857143-182.857143 91.428571 91.428571 292.571429-292.571429zM1005.714286 146.285714l-914.285714 0q-7.460571 0-12.873143 5.412571t-5.412571 12.873143l0 694.857143q0 7.460571 5.412571 12.873143t12.873143 5.412571l914.285714 0q7.460571 0 12.873143-5.412571t5.412571-12.873143l0-694.857143q0-7.460571-5.412571-12.873143t-12.873143-5.412571zM1097.142857 164.571429l0 694.857143q0 37.741714-26.843429 64.585143t-64.585143 26.843429l-914.285714 0q-37.741714 0-64.585143-26.843429t-26.843429-64.585143l0-694.857143q0-37.741714 26.843429-64.585143t64.585143-26.843429l914.285714 0q37.741714 0 64.585143 26.843429t26.843429 64.585143z",Wh=n=>{const{prefixCls:t,className:e,rootClassName:r,style:s,active:o}=n,{getPrefixCls:a}=D.useContext(Me),l=a("skeleton",t),[h,d,m]=un(l),_=rt(l,`${l}-element`,{[`${l}-active`]:o},e,r,d,m);return h(D.createElement("div",{className:_},D.createElement("div",{className:rt(`${l}-image`,e),style:s},D.createElement("svg",{viewBox:"0 0 1098 1024",xmlns:"http://www.w3.org/2000/svg",className:`${l}-image-svg`},D.createElement("title",null,"Image placeholder"),D.createElement("path",{d:Gh,className:`${l}-image-path`})))))},Kh=n=>{const{prefixCls:t,className:e,rootClassName:r,active:s,block:o,size:a="default"}=n,{getPrefixCls:l}=D.useContext(Me),h=l("skeleton",t),[d,m,_]=un(h),v=Di(n,["prefixCls"]),C=rt(h,`${h}-element`,{[`${h}-active`]:s,[`${h}-block`]:o},e,r,m,_);return d(D.createElement("div",{className:C},D.createElement(rs,Object.assign({prefixCls:`${h}-input`,size:a},v))))},Qh=n=>{const{prefixCls:t,className:e,rootClassName:r,style:s,active:o,children:a}=n,{getPrefixCls:l}=D.useContext(Me),h=l("skeleton",t),[d,m,_]=un(h),v=rt(h,`${h}-element`,{[`${h}-active`]:o},m,e,r,_);return d(D.createElement("div",{className:v},D.createElement("div",{className:rt(`${h}-image`,e),style:s},a)))},Xh=(n,t)=>{const{width:e,rows:r=2}=t;if(Array.isArray(e))return e[n];if(r-1===n)return e},Yh=n=>{const{prefixCls:t,className:e,style:r,rows:s=0}=n,o=Array.from({length:s}).map((a,l)=>D.createElement("li",{key:l,style:{width:Xh(l,n)}}));return D.createElement("ul",{className:rt(t,e),style:r},o)},Jh=({prefixCls:n,className:t,width:e,style:r})=>D.createElement("h3",{className:rt(n,t),style:Object.assign({width:e},r)});function Ys(n){return n&&typeof n=="object"?n:{}}function Zh(n,t){return n&&!t?{size:"large",shape:"square"}:{size:"large",shape:"circle"}}function td(n,t){return!n&&t?{width:"38%"}:n&&t?{width:"50%"}:{}}function ed(n,t){const e={};return(!n||!t)&&(e.width="61%"),!n&&t?e.rows=3:e.rows=2,e}const Yn=n=>{const{prefixCls:t,loading:e,className:r,rootClassName:s,style:o,children:a,avatar:l=!1,title:h=!0,paragraph:d=!0,active:m,round:_}=n,{getPrefixCls:v,direction:C,className:V,style:k}=Ni("skeleton"),P=v("skeleton",t),[M,$,U]=un(P);if(e||!("loading"in n)){const q=!!l,Y=!!h,z=!!d;let w;if(q){const E=Object.assign(Object.assign({prefixCls:`${P}-avatar`},Zh(Y,z)),Ys(l));w=D.createElement("div",{className:`${P}-header`},D.createElement(rs,Object.assign({},E)))}let p;if(Y||z){let E;if(Y){const I=Object.assign(Object.assign({prefixCls:`${P}-title`},td(q,z)),Ys(h));E=D.createElement(Jh,Object.assign({},I))}let T;if(z){const I=Object.assign(Object.assign({prefixCls:`${P}-paragraph`},ed(q,Y)),Ys(d));T=D.createElement(Yh,Object.assign({},I))}p=D.createElement("div",{className:`${P}-content`},E,T)}const g=rt(P,{[`${P}-with-avatar`]:q,[`${P}-active`]:m,[`${P}-rtl`]:C==="rtl",[`${P}-round`]:_},V,r,s,$,U);return M(D.createElement("div",{className:g,style:Object.assign(Object.assign({},k),o)},w,p))}return a??null};Yn.Button=Hh;Yn.Avatar=zh;Yn.Input=Kh;Yn.Image=Wh;Yn.Node=Qh;const nd=n=>{const{componentCls:t}=n;return{[t]:{display:"flex",flexFlow:"row wrap",minWidth:0,"&::before, &::after":{display:"flex"},"&-no-wrap":{flexWrap:"nowrap"},"&-start":{justifyContent:"flex-start"},"&-center":{justifyContent:"center"},"&-end":{justifyContent:"flex-end"},"&-space-between":{justifyContent:"space-between"},"&-space-around":{justifyContent:"space-around"},"&-space-evenly":{justifyContent:"space-evenly"},"&-top":{alignItems:"flex-start"},"&-middle":{alignItems:"center"},"&-bottom":{alignItems:"flex-end"}}}},rd=n=>{const{componentCls:t}=n;return{[t]:{position:"relative",maxWidth:"100%",minHeight:1}}},sd=(n,t)=>{const{prefixCls:e,componentCls:r,gridColumns:s}=n,o={};for(let a=s;a>=0;a--)a===0?(o[`${r}${t}-${a}`]={display:"none"},o[`${r}-push-${a}`]={insetInlineStart:"auto"},o[`${r}-pull-${a}`]={insetInlineEnd:"auto"},o[`${r}${t}-push-${a}`]={insetInlineStart:"auto"},o[`${r}${t}-pull-${a}`]={insetInlineEnd:"auto"},o[`${r}${t}-offset-${a}`]={marginInlineStart:0},o[`${r}${t}-order-${a}`]={order:0}):(o[`${r}${t}-${a}`]=[{"--ant-display":"block",display:"block"},{display:"var(--ant-display)",flex:`0 0 ${a/s*100}%`,maxWidth:`${a/s*100}%`}],o[`${r}${t}-push-${a}`]={insetInlineStart:`${a/s*100}%`},o[`${r}${t}-pull-${a}`]={insetInlineEnd:`${a/s*100}%`},o[`${r}${t}-offset-${a}`]={marginInlineStart:`${a/s*100}%`},o[`${r}${t}-order-${a}`]={order:a});return o[`${r}${t}-flex`]={flex:`var(--${e}${t}-flex)`},o},oi=(n,t)=>sd(n,t),id=(n,t,e)=>({[`@media (min-width: ${qc(t)})`]:Object.assign({},oi(n,e))}),od=()=>({}),ad=()=>({}),cd=ns("Grid",nd,od),ld=n=>({xs:n.screenXSMin,sm:n.screenSMMin,md:n.screenMDMin,lg:n.screenLGMin,xl:n.screenXLMin,xxl:n.screenXXLMin}),ud=ns("Grid",n=>{const t=Vi(n,{gridColumns:24}),e=ld(t);return delete e.xs,[rd(t),oi(t,""),oi(t,"-xs"),Object.keys(e).map(r=>id(t,e[r],`-${r}`)).reduce((r,s)=>Object.assign(Object.assign({},r),s),{})]},ad),hd=()=>{const[,n]=xi(),[t]=es("Empty"),r=new Vr(n.colorBgBase).toHsl().l<.5?{opacity:.65}:{};return D.createElement("svg",{style:r,width:"184",height:"152",viewBox:"0 0 184 152",xmlns:"http://www.w3.org/2000/svg"},D.createElement("title",null,t?.description||"Empty"),D.createElement("g",{fill:"none",fillRule:"evenodd"},D.createElement("g",{transform:"translate(24 31.67)"},D.createElement("ellipse",{fillOpacity:".8",fill:"#F5F5F7",cx:"67.797",cy:"106.89",rx:"67.797",ry:"12.668"}),D.createElement("path",{d:"M122.034 69.674L98.109 40.229c-1.148-1.386-2.826-2.225-4.593-2.225h-51.44c-1.766 0-3.444.839-4.592 2.225L13.56 69.674v15.383h108.475V69.674z",fill:"#AEB8C2"}),D.createElement("path",{d:"M101.537 86.214L80.63 61.102c-1.001-1.207-2.507-1.867-4.048-1.867H31.724c-1.54 0-3.047.66-4.048 1.867L6.769 86.214v13.792h94.768V86.214z",fill:"url(#linearGradient-1)",transform:"translate(13.56)"}),D.createElement("path",{d:"M33.83 0h67.933a4 4 0 0 1 4 4v93.344a4 4 0 0 1-4 4H33.83a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z",fill:"#F5F5F7"}),D.createElement("path",{d:"M42.678 9.953h50.237a2 2 0 0 1 2 2V36.91a2 2 0 0 1-2 2H42.678a2 2 0 0 1-2-2V11.953a2 2 0 0 1 2-2zM42.94 49.767h49.713a2.262 2.262 0 1 1 0 4.524H42.94a2.262 2.262 0 0 1 0-4.524zM42.94 61.53h49.713a2.262 2.262 0 1 1 0 4.525H42.94a2.262 2.262 0 0 1 0-4.525zM121.813 105.032c-.775 3.071-3.497 5.36-6.735 5.36H20.515c-3.238 0-5.96-2.29-6.734-5.36a7.309 7.309 0 0 1-.222-1.79V69.675h26.318c2.907 0 5.25 2.448 5.25 5.42v.04c0 2.971 2.37 5.37 5.277 5.37h34.785c2.907 0 5.277-2.421 5.277-5.393V75.1c0-2.972 2.343-5.426 5.25-5.426h26.318v33.569c0 .617-.077 1.216-.221 1.789z",fill:"#DCE0E6"})),D.createElement("path",{d:"M149.121 33.292l-6.83 2.65a1 1 0 0 1-1.317-1.23l1.937-6.207c-2.589-2.944-4.109-6.534-4.109-10.408C138.802 8.102 148.92 0 161.402 0 173.881 0 184 8.102 184 18.097c0 9.995-10.118 18.097-22.599 18.097-4.528 0-8.744-1.066-12.28-2.902z",fill:"#DCE0E6"}),D.createElement("g",{transform:"translate(149.65 15.383)",fill:"#FFF"},D.createElement("ellipse",{cx:"20.654",cy:"3.167",rx:"2.849",ry:"2.815"}),D.createElement("path",{d:"M5.698 5.63H0L2.898.704zM9.259.704h4.985V5.63H9.259z"}))))},dd=()=>{const[,n]=xi(),[t]=es("Empty"),{colorFill:e,colorFillTertiary:r,colorFillQuaternary:s,colorBgContainer:o}=n,{borderColor:a,shadowColor:l,contentColor:h}=D.useMemo(()=>({borderColor:new Vr(e).onBackground(o).toHexString(),shadowColor:new Vr(r).onBackground(o).toHexString(),contentColor:new Vr(s).onBackground(o).toHexString()}),[e,r,s,o]);return D.createElement("svg",{width:"64",height:"41",viewBox:"0 0 64 41",xmlns:"http://www.w3.org/2000/svg"},D.createElement("title",null,t?.description||"Empty"),D.createElement("g",{transform:"translate(0 1)",fill:"none",fillRule:"evenodd"},D.createElement("ellipse",{fill:l,cx:"32",cy:"33",rx:"32",ry:"7"}),D.createElement("g",{fillRule:"nonzero",stroke:a},D.createElement("path",{d:"M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"}),D.createElement("path",{d:"M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z",fill:h}))))},fd=n=>{const{componentCls:t,margin:e,marginXS:r,marginXL:s,fontSize:o,lineHeight:a}=n;return{[t]:{marginInline:r,fontSize:o,lineHeight:a,textAlign:"center",[`${t}-image`]:{height:n.emptyImgHeight,marginBottom:r,opacity:n.opacityImage,img:{height:"100%"},svg:{maxWidth:"100%",height:"100%",margin:"auto"}},[`${t}-description`]:{color:n.colorTextDescription},[`${t}-footer`]:{marginTop:e},"&-normal":{marginBlock:s,color:n.colorTextDescription,[`${t}-description`]:{color:n.colorTextDescription},[`${t}-image`]:{height:n.emptyImgHeightMD}},"&-small":{marginBlock:r,color:n.colorTextDescription,[`${t}-image`]:{height:n.emptyImgHeightSM}}}}},md=ns("Empty",n=>{const{componentCls:t,controlHeightLG:e,calc:r}=n,s=Vi(n,{emptyImgCls:`${t}-img`,emptyImgHeight:r(e).mul(2.5).equal(),emptyImgHeightMD:e,emptyImgHeightSM:r(e).mul(.875).equal()});return fd(s)});var pd=function(n,t){var e={};for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&t.indexOf(r)<0&&(e[r]=n[r]);if(n!=null&&typeof Object.getOwnPropertySymbols=="function")for(var s=0,r=Object.getOwnPropertySymbols(n);s<r.length;s++)t.indexOf(r[s])<0&&Object.prototype.propertyIsEnumerable.call(n,r[s])&&(e[r[s]]=n[r[s]]);return e};const Kc=D.createElement(hd,null),Qc=D.createElement(dd,null),Xc=n=>{var t;const{className:e,rootClassName:r,prefixCls:s,image:o,description:a,children:l,imageStyle:h,style:d,classNames:m,styles:_}=n,v=pd(n,["className","rootClassName","prefixCls","image","description","children","imageStyle","style","classNames","styles"]),{getPrefixCls:C,direction:V,className:k,style:P,classNames:M,styles:$,image:U}=Ni("empty"),q=C("empty",s),[Y,z,w]=md(q),[p]=es("Empty"),g=typeof a<"u"?a:p?.description,E=typeof g=="string"?g:"empty",T=(t=o??U)!==null&&t!==void 0?t:Kc;let I=null;return typeof T=="string"?I=D.createElement("img",{draggable:!1,alt:E,src:T}):I=T,Y(D.createElement("div",Object.assign({className:rt(z,w,q,k,{[`${q}-normal`]:T===Qc,[`${q}-rtl`]:V==="rtl"},e,r,M.root,m?.root),style:Object.assign(Object.assign(Object.assign(Object.assign({},$.root),P),_?.root),d)},v),D.createElement("div",{className:rt(`${q}-image`,M.image,m?.image),style:Object.assign(Object.assign(Object.assign({},h),$.image),_?.image)},I),g&&D.createElement("div",{className:rt(`${q}-description`,M.description,m?.description),style:Object.assign(Object.assign({},$.description),_?.description)},g),l&&D.createElement("div",{className:rt(`${q}-footer`,M.footer,m?.footer),style:Object.assign(Object.assign({},$.footer),_?.footer)},l)))};Xc.PRESENTED_IMAGE_DEFAULT=Kc;Xc.PRESENTED_IMAGE_SIMPLE=Qc;const nn=["xxl","xl","lg","md","sm","xs"],gd=n=>({xs:`(max-width: ${n.screenXSMax}px)`,sm:`(min-width: ${n.screenSM}px)`,md:`(min-width: ${n.screenMD}px)`,lg:`(min-width: ${n.screenLG}px)`,xl:`(min-width: ${n.screenXL}px)`,xxl:`(min-width: ${n.screenXXL}px)`}),_d=n=>{const t=n,e=[].concat(nn).reverse();return e.forEach((r,s)=>{const o=r.toUpperCase(),a=`screen${o}Min`,l=`screen${o}`;if(!(t[a]<=t[l]))throw new Error(`${a}<=${l} fails : !(${t[a]}<=${t[l]})`);if(s<e.length-1){const h=`screen${o}Max`;if(!(t[l]<=t[h]))throw new Error(`${l}<=${h} fails : !(${t[l]}<=${t[h]})`);const m=`screen${e[s+1].toUpperCase()}Min`;if(!(t[h]<=t[m]))throw new Error(`${h}<=${m} fails : !(${t[h]}<=${t[m]})`)}}),n},H_=(n,t)=>{if(t){for(const e of nn)if(n[e]&&t?.[e]!==void 0)return t[e]}},yd=()=>{const[,n]=xi(),t=gd(_d(n));return nt.useMemo(()=>{const e=new Map;let r=-1,s={};return{responsiveMap:t,matchHandlers:{},dispatch(o){return s=o,e.forEach(a=>a(s)),e.size>=1},subscribe(o){return e.size||this.register(),r+=1,e.set(r,o),o(s),r},unsubscribe(o){e.delete(o),e.size||this.unregister()},register(){Object.entries(t).forEach(([o,a])=>{const l=({matches:d})=>{this.dispatch(Object.assign(Object.assign({},s),{[o]:d}))},h=window.matchMedia(a);_h(h,l),this.matchHandlers[a]={mql:h,listener:l},l(h)})},unregister(){Object.values(t).forEach(o=>{const a=this.matchHandlers[o];gh(a?.mql,a?.listener)}),e.clear()}}},[n])};function Ed(){const[,n]=D.useReducer(t=>t+1,0);return n}function vd(n=!0,t={}){const e=D.useRef(t),r=Ed(),s=yd();return yh(()=>{const o=s.subscribe(a=>{e.current=a,n&&r()});return()=>s.unsubscribe(o)},[]),e.current}var Td=zc.ESC,wd=zc.TAB;function Id(n){var t=n.visible,e=n.triggerRef,r=n.onVisibleChange,s=n.autoFocus,o=n.overlayRef,a=D.useRef(!1),l=function(){if(t){var _,v;(_=e.current)===null||_===void 0||(v=_.focus)===null||v===void 0||v.call(_),r?.(!1)}},h=function(){var _;return(_=o.current)!==null&&_!==void 0&&_.focus?(o.current.focus(),a.current=!0,!0):!1},d=function(_){switch(_.keyCode){case Td:l();break;case wd:{var v=!1;a.current||(v=h()),v?_.preventDefault():l();break}}};D.useEffect(function(){return t?(window.addEventListener("keydown",d),s&&Eh(h,3),function(){window.removeEventListener("keydown",d),a.current=!1}):function(){a.current=!1}},[t])}var Ad=D.forwardRef(function(n,t){var e=n.overlay,r=n.arrow,s=n.prefixCls,o=D.useMemo(function(){var l;return typeof e=="function"?l=e():l=e,l},[e]),a=Hc(t,Gc(o));return nt.createElement(nt.Fragment,null,r&&nt.createElement("div",{className:"".concat(s,"-arrow")}),nt.cloneElement(o,{ref:Wc(o)?a:void 0}))}),Ge={adjustX:1,adjustY:1},We=[0,0],Cd={topLeft:{points:["bl","tl"],overflow:Ge,offset:[0,-4],targetOffset:We},top:{points:["bc","tc"],overflow:Ge,offset:[0,-4],targetOffset:We},topRight:{points:["br","tr"],overflow:Ge,offset:[0,-4],targetOffset:We},bottomLeft:{points:["tl","bl"],overflow:Ge,offset:[0,4],targetOffset:We},bottom:{points:["tc","bc"],overflow:Ge,offset:[0,4],targetOffset:We},bottomRight:{points:["tr","br"],overflow:Ge,offset:[0,4],targetOffset:We}},Rd=["arrow","prefixCls","transitionName","animation","align","placement","placements","getPopupContainer","showAction","hideAction","overlayClassName","overlayStyle","visible","trigger","autoFocus","overlay","children","onVisibleChange"];function bd(n,t){var e,r=n.arrow,s=r===void 0?!1:r,o=n.prefixCls,a=o===void 0?"rc-dropdown":o,l=n.transitionName,h=n.animation,d=n.align,m=n.placement,_=m===void 0?"bottomLeft":m,v=n.placements,C=v===void 0?Cd:v,V=n.getPopupContainer,k=n.showAction,P=n.hideAction,M=n.overlayClassName,$=n.overlayStyle,U=n.visible,q=n.trigger,Y=q===void 0?["hover"]:q,z=n.autoFocus,w=n.overlay,p=n.children,g=n.onVisibleChange,E=vh(n,Rd),T=nt.useState(),I=Th(T,2),y=I[0],bt=I[1],mt="visible"in n?U:y,je=nt.useRef(null),zt=nt.useRef(null),Ht=nt.useRef(null);nt.useImperativeHandle(t,function(){return je.current});var ie=function(kt){bt(kt),g?.(kt)};Id({visible:mt,triggerRef:Ht,onVisibleChange:ie,autoFocus:z,overlayRef:zt});var Re=function(kt){var Ue=n.onOverlayClick;bt(!1),Ue&&Ue(kt)},oe=function(){return nt.createElement(Ad,{ref:zt,overlay:w,prefixCls:a,arrow:s})},jt=function(){return typeof w=="function"?oe:oe()},ct=function(){var kt=n.minOverlayWidthMatchTrigger,Ue=n.alignPoint;return"minOverlayWidthMatchTrigger"in n?kt:!Ue},ae=function(){var kt=n.openClassName;return kt!==void 0?kt:"".concat(a,"-open")},Dt=nt.cloneElement(p,{className:rt((e=p.props)===null||e===void 0?void 0:e.className,mt&&ae()),ref:Wc(p)?Hc(Ht,Gc(p)):void 0}),Jt=P;return!Jt&&Y.indexOf("contextMenu")!==-1&&(Jt=["click"]),nt.createElement(wh,Pi({builtinPlacements:C},E,{prefixCls:a,ref:je,popupClassName:rt(M,Ih({},"".concat(a,"-show-arrow"),s)),popupStyle:$,action:Y,showAction:k,hideAction:Jt,popupPlacement:_,popupAlign:d,popupTransitionName:l,popupAnimation:h,popupVisible:mt,stretch:ct()?"minWidth":"",popup:jt(),onPopupVisibleChange:ie,onPopupClick:Re,getPopupContainer:V}),Dt)}const G_=nt.forwardRef(bd);var Sd={icon:{tag:"svg",attrs:{viewBox:"64 64 896 896",focusable:"false"},children:[{tag:"path",attrs:{d:"M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8z"}},{tag:"path",attrs:{d:"M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8z"}}]},name:"plus",theme:"outlined"},Pd=function(t,e){return D.createElement(Bc,Pi({},t,{ref:e,icon:Sd}))},W_=D.forwardRef(Pd);const Yc=D.createContext({});var Vd=function(n,t){var e={};for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&t.indexOf(r)<0&&(e[r]=n[r]);if(n!=null&&typeof Object.getOwnPropertySymbols=="function")for(var s=0,r=Object.getOwnPropertySymbols(n);s<r.length;s++)t.indexOf(r[s])<0&&Object.prototype.propertyIsEnumerable.call(n,r[s])&&(e[r[s]]=n[r[s]]);return e};function Sa(n){return typeof n=="number"?`${n} ${n} auto`:/^\d+(\.\d+)?(px|em|rem|%)$/.test(n)?`0 0 ${n}`:n}const Dd=["xs","sm","md","lg","xl","xxl"],K_=D.forwardRef((n,t)=>{const{getPrefixCls:e,direction:r}=D.useContext(Me),{gutter:s,wrap:o}=D.useContext(Yc),{prefixCls:a,span:l,order:h,offset:d,push:m,pull:_,className:v,children:C,flex:V,style:k}=n,P=Vd(n,["prefixCls","span","order","offset","push","pull","className","children","flex","style"]),M=e("col",a),[$,U,q]=ud(M),Y={};let z={};Dd.forEach(g=>{let E={};const T=n[g];typeof T=="number"?E.span=T:typeof T=="object"&&(E=T||{}),delete P[g],z=Object.assign(Object.assign({},z),{[`${M}-${g}-${E.span}`]:E.span!==void 0,[`${M}-${g}-order-${E.order}`]:E.order||E.order===0,[`${M}-${g}-offset-${E.offset}`]:E.offset||E.offset===0,[`${M}-${g}-push-${E.push}`]:E.push||E.push===0,[`${M}-${g}-pull-${E.pull}`]:E.pull||E.pull===0,[`${M}-rtl`]:r==="rtl"}),E.flex&&(z[`${M}-${g}-flex`]=!0,Y[`--${M}-${g}-flex`]=Sa(E.flex))});const w=rt(M,{[`${M}-${l}`]:l!==void 0,[`${M}-order-${h}`]:h,[`${M}-offset-${d}`]:d,[`${M}-push-${m}`]:m,[`${M}-pull-${_}`]:_},v,z,U,q),p={};if(s&&s[0]>0){const g=s[0]/2;p.paddingLeft=g,p.paddingRight=g}return V&&(p.flex=Sa(V),o===!1&&!p.minWidth&&(p.minWidth=0)),$(D.createElement("div",Object.assign({},P,{style:Object.assign(Object.assign(Object.assign({},p),k),Y),className:w,ref:t}),C))});function Nd(n,t){const e=[void 0,void 0],r=Array.isArray(n)?n:[n,void 0],s=t||{xs:!0,sm:!0,md:!0,lg:!0,xl:!0,xxl:!0};return r.forEach((o,a)=>{if(typeof o=="object"&&o!==null)for(let l=0;l<nn.length;l++){const h=nn[l];if(s[h]&&o[h]!==void 0){e[a]=o[h];break}}else e[a]=o}),e}var xd=function(n,t){var e={};for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&t.indexOf(r)<0&&(e[r]=n[r]);if(n!=null&&typeof Object.getOwnPropertySymbols=="function")for(var s=0,r=Object.getOwnPropertySymbols(n);s<r.length;s++)t.indexOf(r[s])<0&&Object.prototype.propertyIsEnumerable.call(n,r[s])&&(e[r[s]]=n[r[s]]);return e};function Pa(n,t){const[e,r]=D.useState(typeof n=="string"?n:""),s=()=>{if(typeof n=="string"&&r(n),typeof n=="object")for(let o=0;o<nn.length;o++){const a=nn[o];if(!t||!t[a])continue;const l=n[a];if(l!==void 0){r(l);return}}};return D.useEffect(()=>{s()},[JSON.stringify(n),t]),e}const Q_=D.forwardRef((n,t)=>{const{prefixCls:e,justify:r,align:s,className:o,style:a,children:l,gutter:h=0,wrap:d}=n,m=xd(n,["prefixCls","justify","align","className","style","children","gutter","wrap"]),{getPrefixCls:_,direction:v}=D.useContext(Me),C=vd(!0,null),V=Pa(s,C),k=Pa(r,C),P=_("row",e),[M,$,U]=cd(P),q=Nd(h,C),Y=rt(P,{[`${P}-no-wrap`]:d===!1,[`${P}-${k}`]:k,[`${P}-${V}`]:V,[`${P}-rtl`]:v==="rtl"},o,$,U),z={},w=q[0]!=null&&q[0]>0?q[0]/-2:void 0;w&&(z.marginLeft=w,z.marginRight=w);const[p,g]=q;z.rowGap=g;const E=D.useMemo(()=>({gutter:[p,g],wrap:d}),[p,g,d]);return M(D.createElement(Yc.Provider,{value:E},D.createElement("div",Object.assign({},m,{className:Y,style:Object.assign(Object.assign({},z),a),ref:t}),l)))});function Va(n){return["small","middle","large"].includes(n)}function Da(n){return n?typeof n=="number"&&!Number.isNaN(n):!1}const Jc=nt.createContext({latestIndex:0}),kd=Jc.Provider,Od=({className:n,index:t,children:e,split:r,style:s})=>{const{latestIndex:o}=D.useContext(Jc);return e==null?null:D.createElement(D.Fragment,null,D.createElement("div",{className:n,style:s},e),t<o&&r&&D.createElement("span",{className:`${n}-split`},r))};var Md=function(n,t){var e={};for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&t.indexOf(r)<0&&(e[r]=n[r]);if(n!=null&&typeof Object.getOwnPropertySymbols=="function")for(var s=0,r=Object.getOwnPropertySymbols(n);s<r.length;s++)t.indexOf(r[s])<0&&Object.prototype.propertyIsEnumerable.call(n,r[s])&&(e[r[s]]=n[r[s]]);return e};const Ld=D.forwardRef((n,t)=>{var e;const{getPrefixCls:r,direction:s,size:o,className:a,style:l,classNames:h,styles:d}=Ni("space"),{size:m=o??"small",align:_,className:v,rootClassName:C,children:V,direction:k="horizontal",prefixCls:P,split:M,style:$,wrap:U=!1,classNames:q,styles:Y}=n,z=Md(n,["size","align","className","rootClassName","children","direction","prefixCls","split","style","wrap","classNames","styles"]),[w,p]=Array.isArray(m)?m:[m,m],g=Va(p),E=Va(w),T=Da(p),I=Da(w),y=Ah(V,{keepEmpty:!0}),bt=_===void 0&&k==="horizontal"?"center":_,mt=r("space",P),[je,zt,Ht]=Ch(mt),ie=rt(mt,a,zt,`${mt}-${k}`,{[`${mt}-rtl`]:s==="rtl",[`${mt}-align-${bt}`]:bt,[`${mt}-gap-row-${p}`]:g,[`${mt}-gap-col-${w}`]:E},v,C,Ht),Re=rt(`${mt}-item`,(e=q?.item)!==null&&e!==void 0?e:h.item);let oe=0;const jt=y.map((Dt,Jt)=>{var Nt;Dt!=null&&(oe=Jt);const kt=Dt?.key||`${Re}-${Jt}`;return D.createElement(Od,{className:Re,key:kt,index:Jt,split:M,style:(Nt=Y?.item)!==null&&Nt!==void 0?Nt:d.item},Dt)}),ct=D.useMemo(()=>({latestIndex:oe}),[oe]);if(y.length===0)return null;const ae={};return U&&(ae.flexWrap="wrap"),!E&&I&&(ae.columnGap=w),!g&&T&&(ae.rowGap=p),je(D.createElement("div",Object.assign({ref:t,className:ie,style:Object.assign(Object.assign(Object.assign({},ae),l),$)},z),D.createElement(kd,{value:ct},jt)))}),Fd=Ld;Fd.Compact=Rh;const $d=()=>{};var Na={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zc=function(n){const t=[];let e=0;for(let r=0;r<n.length;r++){let s=n.charCodeAt(r);s<128?t[e++]=s:s<2048?(t[e++]=s>>6|192,t[e++]=s&63|128):(s&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(s=65536+((s&1023)<<10)+(n.charCodeAt(++r)&1023),t[e++]=s>>18|240,t[e++]=s>>12&63|128,t[e++]=s>>6&63|128,t[e++]=s&63|128):(t[e++]=s>>12|224,t[e++]=s>>6&63|128,t[e++]=s&63|128)}return t},jd=function(n){const t=[];let e=0,r=0;for(;e<n.length;){const s=n[e++];if(s<128)t[r++]=String.fromCharCode(s);else if(s>191&&s<224){const o=n[e++];t[r++]=String.fromCharCode((s&31)<<6|o&63)}else if(s>239&&s<365){const o=n[e++],a=n[e++],l=n[e++],h=((s&7)<<18|(o&63)<<12|(a&63)<<6|l&63)-65536;t[r++]=String.fromCharCode(55296+(h>>10)),t[r++]=String.fromCharCode(56320+(h&1023))}else{const o=n[e++],a=n[e++];t[r++]=String.fromCharCode((s&15)<<12|(o&63)<<6|a&63)}}return t.join("")},tl={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,t){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const e=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let s=0;s<n.length;s+=3){const o=n[s],a=s+1<n.length,l=a?n[s+1]:0,h=s+2<n.length,d=h?n[s+2]:0,m=o>>2,_=(o&3)<<4|l>>4;let v=(l&15)<<2|d>>6,C=d&63;h||(C=64,a||(v=64)),r.push(e[m],e[_],e[v],e[C])}return r.join("")},encodeString(n,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(n):this.encodeByteArray(Zc(n),t)},decodeString(n,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(n):jd(this.decodeStringToByteArray(n,t))},decodeStringToByteArray(n,t){this.init_();const e=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let s=0;s<n.length;){const o=e[n.charAt(s++)],l=s<n.length?e[n.charAt(s)]:0;++s;const d=s<n.length?e[n.charAt(s)]:64;++s;const _=s<n.length?e[n.charAt(s)]:64;if(++s,o==null||l==null||d==null||_==null)throw new Ud;const v=o<<2|l>>4;if(r.push(v),d!==64){const C=l<<4&240|d>>2;if(r.push(C),_!==64){const V=d<<6&192|_;r.push(V)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class Ud extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Bd=function(n){const t=Zc(n);return tl.encodeByteArray(t,!0)},Lr=function(n){return Bd(n).replace(/\./g,"")},qd=function(n){try{return tl.decodeString(n,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zd(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hd=()=>zd().__FIREBASE_DEFAULTS__,Gd=()=>{if(typeof process>"u"||typeof Na>"u")return;const n=Na.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},Wd=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const t=n&&qd(n[1]);return t&&JSON.parse(t)},ki=()=>{try{return $d()||Hd()||Gd()||Wd()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Kd=n=>ki()?.emulatorHosts?.[n],Qd=n=>{const t=Kd(n);if(!t)return;const e=t.lastIndexOf(":");if(e<=0||e+1===t.length)throw new Error(`Invalid host ${t} with no separate hostname and port!`);const r=parseInt(t.substring(e+1),10);return t[0]==="["?[t.substring(1,e-1),r]:[t.substring(0,e),r]},el=()=>ki()?.config;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xd{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,e)=>{this.resolve=t,this.reject=e})}wrapCallback(t){return(e,r)=>{e?this.reject(e):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(e):t(e,r))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Oi(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Yd(n){return(await fetch(n,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Jd(n,t){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const e={alg:"none",type:"JWT"},r=t||"demo-project",s=n.iat||0,o=n.sub||n.user_id;if(!o)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const a={iss:`https://securetoken.google.com/${r}`,aud:r,iat:s,exp:s+3600,auth_time:s,sub:o,user_id:o,firebase:{sign_in_provider:"custom",identities:{}},...n};return[Lr(JSON.stringify(e)),Lr(JSON.stringify(a)),""].join(".")}const On={};function Zd(){const n={prod:[],emulator:[]};for(const t of Object.keys(On))On[t]?n.emulator.push(t):n.prod.push(t);return n}function tf(n){let t=document.getElementById(n),e=!1;return t||(t=document.createElement("div"),t.setAttribute("id",n),e=!0),{created:e,element:t}}let xa=!1;function ef(n,t){if(typeof window>"u"||typeof document>"u"||!Oi(window.location.host)||On[n]===t||On[n]||xa)return;On[n]=t;function e(v){return`__firebase__banner__${v}`}const r="__firebase__banner",o=Zd().prod.length>0;function a(){const v=document.getElementById(r);v&&v.remove()}function l(v){v.style.display="flex",v.style.background="#7faaf0",v.style.position="fixed",v.style.bottom="5px",v.style.left="5px",v.style.padding=".5em",v.style.borderRadius="5px",v.style.alignItems="center"}function h(v,C){v.setAttribute("width","24"),v.setAttribute("id",C),v.setAttribute("height","24"),v.setAttribute("viewBox","0 0 24 24"),v.setAttribute("fill","none"),v.style.marginLeft="-6px"}function d(){const v=document.createElement("span");return v.style.cursor="pointer",v.style.marginLeft="16px",v.style.fontSize="24px",v.innerHTML=" &times;",v.onclick=()=>{xa=!0,a()},v}function m(v,C){v.setAttribute("id",C),v.innerText="Learn more",v.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",v.setAttribute("target","__blank"),v.style.paddingLeft="5px",v.style.textDecoration="underline"}function _(){const v=tf(r),C=e("text"),V=document.getElementById(C)||document.createElement("span"),k=e("learnmore"),P=document.getElementById(k)||document.createElement("a"),M=e("preprendIcon"),$=document.getElementById(M)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(v.created){const U=v.element;l(U),m(P,k);const q=d();h($,M),U.append($,V,P,q),document.body.appendChild(U)}o?(V.innerText="Preview backend disconnected.",$.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):($.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,V.innerText="Preview backend running in this workspace."),V.setAttribute("id",C)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",_):_()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nf(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function rf(){const n=ki()?.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function sf(){return!rf()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function of(){try{return typeof indexedDB=="object"}catch{return!1}}function af(){return new Promise((n,t)=>{try{let e=!0;const r="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(r);s.onsuccess=()=>{s.result.close(),e||self.indexedDB.deleteDatabase(r),n(!0)},s.onupgradeneeded=()=>{e=!1},s.onerror=()=>{t(s.error?.message||"")}}catch(e){t(e)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cf="FirebaseError";class hn extends Error{constructor(t,e,r){super(e),this.code=t,this.customData=r,this.name=cf,Object.setPrototypeOf(this,hn.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,nl.prototype.create)}}class nl{constructor(t,e,r){this.service=t,this.serviceName=e,this.errors=r}create(t,...e){const r=e[0]||{},s=`${this.service}/${t}`,o=this.errors[t],a=o?lf(o,r):"Error",l=`${this.serviceName}: ${a} (${s}).`;return new hn(s,l,r)}}function lf(n,t){return n.replace(uf,(e,r)=>{const s=t[r];return s!=null?String(s):`<${r}?>`})}const uf=/\{\$([^}]+)}/g;function Fr(n,t){if(n===t)return!0;const e=Object.keys(n),r=Object.keys(t);for(const s of e){if(!r.includes(s))return!1;const o=n[s],a=t[s];if(ka(o)&&ka(a)){if(!Fr(o,a))return!1}else if(o!==a)return!1}for(const s of r)if(!e.includes(s))return!1;return!0}function ka(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $t(n){return n&&n._delegate?n._delegate:n}class Un{constructor(t,e,r){this.name=t,this.instanceFactory=e,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const De="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hf{constructor(t,e){this.name=t,this.container=e,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){const e=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(e)){const r=new Xd;if(this.instancesDeferred.set(e,r),this.isInitialized(e)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:e});s&&r.resolve(s)}catch{}}return this.instancesDeferred.get(e).promise}getImmediate(t){const e=this.normalizeInstanceIdentifier(t?.identifier),r=t?.optional??!1;if(this.isInitialized(e)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:e})}catch(s){if(r)return null;throw s}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(ff(t))try{this.getOrInitializeService({instanceIdentifier:De})}catch{}for(const[e,r]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(e);try{const o=this.getOrInitializeService({instanceIdentifier:s});r.resolve(o)}catch{}}}}clearInstance(t=De){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){const t=Array.from(this.instances.values());await Promise.all([...t.filter(e=>"INTERNAL"in e).map(e=>e.INTERNAL.delete()),...t.filter(e=>"_delete"in e).map(e=>e._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=De){return this.instances.has(t)}getOptions(t=De){return this.instancesOptions.get(t)||{}}initialize(t={}){const{options:e={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:r,options:e});for(const[o,a]of this.instancesDeferred.entries()){const l=this.normalizeInstanceIdentifier(o);r===l&&a.resolve(s)}return s}onInit(t,e){const r=this.normalizeInstanceIdentifier(e),s=this.onInitCallbacks.get(r)??new Set;s.add(t),this.onInitCallbacks.set(r,s);const o=this.instances.get(r);return o&&t(o,r),()=>{s.delete(t)}}invokeOnInitCallbacks(t,e){const r=this.onInitCallbacks.get(e);if(r)for(const s of r)try{s(t,e)}catch{}}getOrInitializeService({instanceIdentifier:t,options:e={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:df(t),options:e}),this.instances.set(t,r),this.instancesOptions.set(t,e),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=De){return this.component?this.component.multipleInstances?t:De:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function df(n){return n===De?void 0:n}function ff(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mf{constructor(t){this.name=t,this.providers=new Map}addComponent(t){const e=this.getProvider(t.name);if(e.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);e.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);const e=new hf(t,this);return this.providers.set(t,e),e}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var K;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(K||(K={}));const pf={debug:K.DEBUG,verbose:K.VERBOSE,info:K.INFO,warn:K.WARN,error:K.ERROR,silent:K.SILENT},gf=K.INFO,_f={[K.DEBUG]:"log",[K.VERBOSE]:"log",[K.INFO]:"info",[K.WARN]:"warn",[K.ERROR]:"error"},yf=(n,t,...e)=>{if(t<n.logLevel)return;const r=new Date().toISOString(),s=_f[t];if(s)console[s](`[${r}]  ${n.name}:`,...e);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)};class rl{constructor(t){this.name=t,this._logLevel=gf,this._logHandler=yf,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in K))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?pf[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,K.DEBUG,...t),this._logHandler(this,K.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,K.VERBOSE,...t),this._logHandler(this,K.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,K.INFO,...t),this._logHandler(this,K.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,K.WARN,...t),this._logHandler(this,K.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,K.ERROR,...t),this._logHandler(this,K.ERROR,...t)}}const Ef=(n,t)=>t.some(e=>n instanceof e);let Oa,Ma;function vf(){return Oa||(Oa=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Tf(){return Ma||(Ma=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const sl=new WeakMap,ai=new WeakMap,il=new WeakMap,Js=new WeakMap,Mi=new WeakMap;function wf(n){const t=new Promise((e,r)=>{const s=()=>{n.removeEventListener("success",o),n.removeEventListener("error",a)},o=()=>{e(fe(n.result)),s()},a=()=>{r(n.error),s()};n.addEventListener("success",o),n.addEventListener("error",a)});return t.then(e=>{e instanceof IDBCursor&&sl.set(e,n)}).catch(()=>{}),Mi.set(t,n),t}function If(n){if(ai.has(n))return;const t=new Promise((e,r)=>{const s=()=>{n.removeEventListener("complete",o),n.removeEventListener("error",a),n.removeEventListener("abort",a)},o=()=>{e(),s()},a=()=>{r(n.error||new DOMException("AbortError","AbortError")),s()};n.addEventListener("complete",o),n.addEventListener("error",a),n.addEventListener("abort",a)});ai.set(n,t)}let ci={get(n,t,e){if(n instanceof IDBTransaction){if(t==="done")return ai.get(n);if(t==="objectStoreNames")return n.objectStoreNames||il.get(n);if(t==="store")return e.objectStoreNames[1]?void 0:e.objectStore(e.objectStoreNames[0])}return fe(n[t])},set(n,t,e){return n[t]=e,!0},has(n,t){return n instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in n}};function Af(n){ci=n(ci)}function Cf(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...e){const r=n.call(Zs(this),t,...e);return il.set(r,t.sort?t.sort():[t]),fe(r)}:Tf().includes(n)?function(...t){return n.apply(Zs(this),t),fe(sl.get(this))}:function(...t){return fe(n.apply(Zs(this),t))}}function Rf(n){return typeof n=="function"?Cf(n):(n instanceof IDBTransaction&&If(n),Ef(n,vf())?new Proxy(n,ci):n)}function fe(n){if(n instanceof IDBRequest)return wf(n);if(Js.has(n))return Js.get(n);const t=Rf(n);return t!==n&&(Js.set(n,t),Mi.set(t,n)),t}const Zs=n=>Mi.get(n);function bf(n,t,{blocked:e,upgrade:r,blocking:s,terminated:o}={}){const a=indexedDB.open(n,t),l=fe(a);return r&&a.addEventListener("upgradeneeded",h=>{r(fe(a.result),h.oldVersion,h.newVersion,fe(a.transaction),h)}),e&&a.addEventListener("blocked",h=>e(h.oldVersion,h.newVersion,h)),l.then(h=>{o&&h.addEventListener("close",()=>o()),s&&h.addEventListener("versionchange",d=>s(d.oldVersion,d.newVersion,d))}).catch(()=>{}),l}const Sf=["get","getKey","getAll","getAllKeys","count"],Pf=["put","add","delete","clear"],ti=new Map;function La(n,t){if(!(n instanceof IDBDatabase&&!(t in n)&&typeof t=="string"))return;if(ti.get(t))return ti.get(t);const e=t.replace(/FromIndex$/,""),r=t!==e,s=Pf.includes(e);if(!(e in(r?IDBIndex:IDBObjectStore).prototype)||!(s||Sf.includes(e)))return;const o=async function(a,...l){const h=this.transaction(a,s?"readwrite":"readonly");let d=h.store;return r&&(d=d.index(l.shift())),(await Promise.all([d[e](...l),s&&h.done]))[0]};return ti.set(t,o),o}Af(n=>({...n,get:(t,e,r)=>La(t,e)||n.get(t,e,r),has:(t,e)=>!!La(t,e)||n.has(t,e)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vf{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(e=>{if(Df(e)){const r=e.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(e=>e).join(" ")}}function Df(n){return n.getComponent()?.type==="VERSION"}const li="@firebase/app",Fa="0.14.2";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ee=new rl("@firebase/app"),Nf="@firebase/app-compat",xf="@firebase/analytics-compat",kf="@firebase/analytics",Of="@firebase/app-check-compat",Mf="@firebase/app-check",Lf="@firebase/auth",Ff="@firebase/auth-compat",$f="@firebase/database",jf="@firebase/data-connect",Uf="@firebase/database-compat",Bf="@firebase/functions",qf="@firebase/functions-compat",zf="@firebase/installations",Hf="@firebase/installations-compat",Gf="@firebase/messaging",Wf="@firebase/messaging-compat",Kf="@firebase/performance",Qf="@firebase/performance-compat",Xf="@firebase/remote-config",Yf="@firebase/remote-config-compat",Jf="@firebase/storage",Zf="@firebase/storage-compat",tm="@firebase/firestore",em="@firebase/ai",nm="@firebase/firestore-compat",rm="firebase",sm="12.2.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ui="[DEFAULT]",im={[li]:"fire-core",[Nf]:"fire-core-compat",[kf]:"fire-analytics",[xf]:"fire-analytics-compat",[Mf]:"fire-app-check",[Of]:"fire-app-check-compat",[Lf]:"fire-auth",[Ff]:"fire-auth-compat",[$f]:"fire-rtdb",[jf]:"fire-data-connect",[Uf]:"fire-rtdb-compat",[Bf]:"fire-fn",[qf]:"fire-fn-compat",[zf]:"fire-iid",[Hf]:"fire-iid-compat",[Gf]:"fire-fcm",[Wf]:"fire-fcm-compat",[Kf]:"fire-perf",[Qf]:"fire-perf-compat",[Xf]:"fire-rc",[Yf]:"fire-rc-compat",[Jf]:"fire-gcs",[Zf]:"fire-gcs-compat",[tm]:"fire-fst",[nm]:"fire-fst-compat",[em]:"fire-vertex","fire-js":"fire-js",[rm]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $r=new Map,om=new Map,hi=new Map;function $a(n,t){try{n.container.addComponent(t)}catch(e){ee.debug(`Component ${t.name} failed to register with FirebaseApp ${n.name}`,e)}}function jr(n){const t=n.name;if(hi.has(t))return ee.debug(`There were multiple attempts to register component ${t}.`),!1;hi.set(t,n);for(const e of $r.values())$a(e,n);for(const e of om.values())$a(e,n);return!0}function am(n,t){const e=n.container.getProvider("heartbeat").getImmediate({optional:!0});return e&&e.triggerHeartbeat(),n.container.getProvider(t)}function cm(n){return n==null?!1:n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lm={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},me=new nl("app","Firebase",lm);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class um{constructor(t,e,r){this._isDeleted=!1,this._options={...t},this._config={...e},this._name=e.name,this._automaticDataCollectionEnabled=e.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new Un("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw me.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const hm=sm;function ol(n,t={}){let e=n;typeof t!="object"&&(t={name:t});const r={name:ui,automaticDataCollectionEnabled:!0,...t},s=r.name;if(typeof s!="string"||!s)throw me.create("bad-app-name",{appName:String(s)});if(e||(e=el()),!e)throw me.create("no-options");const o=$r.get(s);if(o){if(Fr(e,o.options)&&Fr(r,o.config))return o;throw me.create("duplicate-app",{appName:s})}const a=new mf(s);for(const h of hi.values())a.addComponent(h);const l=new um(e,r,a);return $r.set(s,l),l}function dm(n=ui){const t=$r.get(n);if(!t&&n===ui&&el())return ol();if(!t)throw me.create("no-app",{appName:n});return t}function tn(n,t,e){let r=im[n]??n;e&&(r+=`-${e}`);const s=r.match(/\s|\//),o=t.match(/\s|\//);if(s||o){const a=[`Unable to register library "${r}" with version "${t}":`];s&&a.push(`library name "${r}" contains illegal characters (whitespace or "/")`),s&&o&&a.push("and"),o&&a.push(`version name "${t}" contains illegal characters (whitespace or "/")`),ee.warn(a.join(" "));return}jr(new Un(`${r}-version`,()=>({library:r,version:t}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fm="firebase-heartbeat-database",mm=1,Bn="firebase-heartbeat-store";let ei=null;function al(){return ei||(ei=bf(fm,mm,{upgrade:(n,t)=>{switch(t){case 0:try{n.createObjectStore(Bn)}catch(e){console.warn(e)}}}}).catch(n=>{throw me.create("idb-open",{originalErrorMessage:n.message})})),ei}async function pm(n){try{const e=(await al()).transaction(Bn),r=await e.objectStore(Bn).get(cl(n));return await e.done,r}catch(t){if(t instanceof hn)ee.warn(t.message);else{const e=me.create("idb-get",{originalErrorMessage:t?.message});ee.warn(e.message)}}}async function ja(n,t){try{const r=(await al()).transaction(Bn,"readwrite");await r.objectStore(Bn).put(t,cl(n)),await r.done}catch(e){if(e instanceof hn)ee.warn(e.message);else{const r=me.create("idb-set",{originalErrorMessage:e?.message});ee.warn(r.message)}}}function cl(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gm=1024,_m=30;class ym{constructor(t){this.container=t,this._heartbeatsCache=null;const e=this.container.getProvider("app").getImmediate();this._storage=new vm(e),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){try{const e=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),r=Ua();if(this._heartbeatsCache?.heartbeats==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null)||this._heartbeatsCache.lastSentHeartbeatDate===r||this._heartbeatsCache.heartbeats.some(s=>s.date===r))return;if(this._heartbeatsCache.heartbeats.push({date:r,agent:e}),this._heartbeatsCache.heartbeats.length>_m){const s=Tm(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(s,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(t){ee.warn(t)}}async getHeartbeatsHeader(){try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=Ua(),{heartbeatsToSend:e,unsentEntries:r}=Em(this._heartbeatsCache.heartbeats),s=Lr(JSON.stringify({version:2,heartbeats:e}));return this._heartbeatsCache.lastSentHeartbeatDate=t,r.length>0?(this._heartbeatsCache.heartbeats=r,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),s}catch(t){return ee.warn(t),""}}}function Ua(){return new Date().toISOString().substring(0,10)}function Em(n,t=gm){const e=[];let r=n.slice();for(const s of n){const o=e.find(a=>a.agent===s.agent);if(o){if(o.dates.push(s.date),Ba(e)>t){o.dates.pop();break}}else if(e.push({agent:s.agent,dates:[s.date]}),Ba(e)>t){e.pop();break}r=r.slice(1)}return{heartbeatsToSend:e,unsentEntries:r}}class vm{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return of()?af().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const e=await pm(this.app);return e?.heartbeats?e:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){if(await this._canUseIndexedDBPromise){const r=await this.read();return ja(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){if(await this._canUseIndexedDBPromise){const r=await this.read();return ja(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...t.heartbeats]})}else return}}function Ba(n){return Lr(JSON.stringify({version:2,heartbeats:n})).length}function Tm(n){if(n.length===0)return-1;let t=0,e=n[0].date;for(let r=1;r<n.length;r++)n[r].date<e&&(e=n[r].date,t=r);return t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wm(n){jr(new Un("platform-logger",t=>new Vf(t),"PRIVATE")),jr(new Un("heartbeat",t=>new ym(t),"PRIVATE")),tn(li,Fa,n),tn(li,Fa,"esm2020"),tn("fire-js","")}wm("");var qa=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var pe,ll;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function t(w,p){function g(){}g.prototype=p.prototype,w.D=p.prototype,w.prototype=new g,w.prototype.constructor=w,w.C=function(E,T,I){for(var y=Array(arguments.length-2),bt=2;bt<arguments.length;bt++)y[bt-2]=arguments[bt];return p.prototype[T].apply(E,y)}}function e(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.B=Array(this.blockSize),this.o=this.h=0,this.s()}t(r,e),r.prototype.s=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function s(w,p,g){g||(g=0);var E=Array(16);if(typeof p=="string")for(var T=0;16>T;++T)E[T]=p.charCodeAt(g++)|p.charCodeAt(g++)<<8|p.charCodeAt(g++)<<16|p.charCodeAt(g++)<<24;else for(T=0;16>T;++T)E[T]=p[g++]|p[g++]<<8|p[g++]<<16|p[g++]<<24;p=w.g[0],g=w.g[1],T=w.g[2];var I=w.g[3],y=p+(I^g&(T^I))+E[0]+3614090360&4294967295;p=g+(y<<7&4294967295|y>>>25),y=I+(T^p&(g^T))+E[1]+3905402710&4294967295,I=p+(y<<12&4294967295|y>>>20),y=T+(g^I&(p^g))+E[2]+606105819&4294967295,T=I+(y<<17&4294967295|y>>>15),y=g+(p^T&(I^p))+E[3]+3250441966&4294967295,g=T+(y<<22&4294967295|y>>>10),y=p+(I^g&(T^I))+E[4]+4118548399&4294967295,p=g+(y<<7&4294967295|y>>>25),y=I+(T^p&(g^T))+E[5]+1200080426&4294967295,I=p+(y<<12&4294967295|y>>>20),y=T+(g^I&(p^g))+E[6]+2821735955&4294967295,T=I+(y<<17&4294967295|y>>>15),y=g+(p^T&(I^p))+E[7]+4249261313&4294967295,g=T+(y<<22&4294967295|y>>>10),y=p+(I^g&(T^I))+E[8]+1770035416&4294967295,p=g+(y<<7&4294967295|y>>>25),y=I+(T^p&(g^T))+E[9]+2336552879&4294967295,I=p+(y<<12&4294967295|y>>>20),y=T+(g^I&(p^g))+E[10]+4294925233&4294967295,T=I+(y<<17&4294967295|y>>>15),y=g+(p^T&(I^p))+E[11]+2304563134&4294967295,g=T+(y<<22&4294967295|y>>>10),y=p+(I^g&(T^I))+E[12]+1804603682&4294967295,p=g+(y<<7&4294967295|y>>>25),y=I+(T^p&(g^T))+E[13]+4254626195&4294967295,I=p+(y<<12&4294967295|y>>>20),y=T+(g^I&(p^g))+E[14]+2792965006&4294967295,T=I+(y<<17&4294967295|y>>>15),y=g+(p^T&(I^p))+E[15]+1236535329&4294967295,g=T+(y<<22&4294967295|y>>>10),y=p+(T^I&(g^T))+E[1]+4129170786&4294967295,p=g+(y<<5&4294967295|y>>>27),y=I+(g^T&(p^g))+E[6]+3225465664&4294967295,I=p+(y<<9&4294967295|y>>>23),y=T+(p^g&(I^p))+E[11]+643717713&4294967295,T=I+(y<<14&4294967295|y>>>18),y=g+(I^p&(T^I))+E[0]+3921069994&4294967295,g=T+(y<<20&4294967295|y>>>12),y=p+(T^I&(g^T))+E[5]+3593408605&4294967295,p=g+(y<<5&4294967295|y>>>27),y=I+(g^T&(p^g))+E[10]+38016083&4294967295,I=p+(y<<9&4294967295|y>>>23),y=T+(p^g&(I^p))+E[15]+3634488961&4294967295,T=I+(y<<14&4294967295|y>>>18),y=g+(I^p&(T^I))+E[4]+3889429448&4294967295,g=T+(y<<20&4294967295|y>>>12),y=p+(T^I&(g^T))+E[9]+568446438&4294967295,p=g+(y<<5&4294967295|y>>>27),y=I+(g^T&(p^g))+E[14]+3275163606&4294967295,I=p+(y<<9&4294967295|y>>>23),y=T+(p^g&(I^p))+E[3]+4107603335&4294967295,T=I+(y<<14&4294967295|y>>>18),y=g+(I^p&(T^I))+E[8]+1163531501&4294967295,g=T+(y<<20&4294967295|y>>>12),y=p+(T^I&(g^T))+E[13]+2850285829&4294967295,p=g+(y<<5&4294967295|y>>>27),y=I+(g^T&(p^g))+E[2]+4243563512&4294967295,I=p+(y<<9&4294967295|y>>>23),y=T+(p^g&(I^p))+E[7]+1735328473&4294967295,T=I+(y<<14&4294967295|y>>>18),y=g+(I^p&(T^I))+E[12]+2368359562&4294967295,g=T+(y<<20&4294967295|y>>>12),y=p+(g^T^I)+E[5]+4294588738&4294967295,p=g+(y<<4&4294967295|y>>>28),y=I+(p^g^T)+E[8]+2272392833&4294967295,I=p+(y<<11&4294967295|y>>>21),y=T+(I^p^g)+E[11]+1839030562&4294967295,T=I+(y<<16&4294967295|y>>>16),y=g+(T^I^p)+E[14]+4259657740&4294967295,g=T+(y<<23&4294967295|y>>>9),y=p+(g^T^I)+E[1]+2763975236&4294967295,p=g+(y<<4&4294967295|y>>>28),y=I+(p^g^T)+E[4]+1272893353&4294967295,I=p+(y<<11&4294967295|y>>>21),y=T+(I^p^g)+E[7]+4139469664&4294967295,T=I+(y<<16&4294967295|y>>>16),y=g+(T^I^p)+E[10]+3200236656&4294967295,g=T+(y<<23&4294967295|y>>>9),y=p+(g^T^I)+E[13]+681279174&4294967295,p=g+(y<<4&4294967295|y>>>28),y=I+(p^g^T)+E[0]+3936430074&4294967295,I=p+(y<<11&4294967295|y>>>21),y=T+(I^p^g)+E[3]+3572445317&4294967295,T=I+(y<<16&4294967295|y>>>16),y=g+(T^I^p)+E[6]+76029189&4294967295,g=T+(y<<23&4294967295|y>>>9),y=p+(g^T^I)+E[9]+3654602809&4294967295,p=g+(y<<4&4294967295|y>>>28),y=I+(p^g^T)+E[12]+3873151461&4294967295,I=p+(y<<11&4294967295|y>>>21),y=T+(I^p^g)+E[15]+530742520&4294967295,T=I+(y<<16&4294967295|y>>>16),y=g+(T^I^p)+E[2]+3299628645&4294967295,g=T+(y<<23&4294967295|y>>>9),y=p+(T^(g|~I))+E[0]+4096336452&4294967295,p=g+(y<<6&4294967295|y>>>26),y=I+(g^(p|~T))+E[7]+1126891415&4294967295,I=p+(y<<10&4294967295|y>>>22),y=T+(p^(I|~g))+E[14]+2878612391&4294967295,T=I+(y<<15&4294967295|y>>>17),y=g+(I^(T|~p))+E[5]+4237533241&4294967295,g=T+(y<<21&4294967295|y>>>11),y=p+(T^(g|~I))+E[12]+1700485571&4294967295,p=g+(y<<6&4294967295|y>>>26),y=I+(g^(p|~T))+E[3]+2399980690&4294967295,I=p+(y<<10&4294967295|y>>>22),y=T+(p^(I|~g))+E[10]+4293915773&4294967295,T=I+(y<<15&4294967295|y>>>17),y=g+(I^(T|~p))+E[1]+2240044497&4294967295,g=T+(y<<21&4294967295|y>>>11),y=p+(T^(g|~I))+E[8]+1873313359&4294967295,p=g+(y<<6&4294967295|y>>>26),y=I+(g^(p|~T))+E[15]+4264355552&4294967295,I=p+(y<<10&4294967295|y>>>22),y=T+(p^(I|~g))+E[6]+2734768916&4294967295,T=I+(y<<15&4294967295|y>>>17),y=g+(I^(T|~p))+E[13]+1309151649&4294967295,g=T+(y<<21&4294967295|y>>>11),y=p+(T^(g|~I))+E[4]+4149444226&4294967295,p=g+(y<<6&4294967295|y>>>26),y=I+(g^(p|~T))+E[11]+3174756917&4294967295,I=p+(y<<10&4294967295|y>>>22),y=T+(p^(I|~g))+E[2]+718787259&4294967295,T=I+(y<<15&4294967295|y>>>17),y=g+(I^(T|~p))+E[9]+3951481745&4294967295,w.g[0]=w.g[0]+p&4294967295,w.g[1]=w.g[1]+(T+(y<<21&4294967295|y>>>11))&4294967295,w.g[2]=w.g[2]+T&4294967295,w.g[3]=w.g[3]+I&4294967295}r.prototype.u=function(w,p){p===void 0&&(p=w.length);for(var g=p-this.blockSize,E=this.B,T=this.h,I=0;I<p;){if(T==0)for(;I<=g;)s(this,w,I),I+=this.blockSize;if(typeof w=="string"){for(;I<p;)if(E[T++]=w.charCodeAt(I++),T==this.blockSize){s(this,E),T=0;break}}else for(;I<p;)if(E[T++]=w[I++],T==this.blockSize){s(this,E),T=0;break}}this.h=T,this.o+=p},r.prototype.v=function(){var w=Array((56>this.h?this.blockSize:2*this.blockSize)-this.h);w[0]=128;for(var p=1;p<w.length-8;++p)w[p]=0;var g=8*this.o;for(p=w.length-8;p<w.length;++p)w[p]=g&255,g/=256;for(this.u(w),w=Array(16),p=g=0;4>p;++p)for(var E=0;32>E;E+=8)w[g++]=this.g[p]>>>E&255;return w};function o(w,p){var g=l;return Object.prototype.hasOwnProperty.call(g,w)?g[w]:g[w]=p(w)}function a(w,p){this.h=p;for(var g=[],E=!0,T=w.length-1;0<=T;T--){var I=w[T]|0;E&&I==p||(g[T]=I,E=!1)}this.g=g}var l={};function h(w){return-128<=w&&128>w?o(w,function(p){return new a([p|0],0>p?-1:0)}):new a([w|0],0>w?-1:0)}function d(w){if(isNaN(w)||!isFinite(w))return _;if(0>w)return P(d(-w));for(var p=[],g=1,E=0;w>=g;E++)p[E]=w/g|0,g*=4294967296;return new a(p,0)}function m(w,p){if(w.length==0)throw Error("number format error: empty string");if(p=p||10,2>p||36<p)throw Error("radix out of range: "+p);if(w.charAt(0)=="-")return P(m(w.substring(1),p));if(0<=w.indexOf("-"))throw Error('number format error: interior "-" character');for(var g=d(Math.pow(p,8)),E=_,T=0;T<w.length;T+=8){var I=Math.min(8,w.length-T),y=parseInt(w.substring(T,T+I),p);8>I?(I=d(Math.pow(p,I)),E=E.j(I).add(d(y))):(E=E.j(g),E=E.add(d(y)))}return E}var _=h(0),v=h(1),C=h(16777216);n=a.prototype,n.m=function(){if(k(this))return-P(this).m();for(var w=0,p=1,g=0;g<this.g.length;g++){var E=this.i(g);w+=(0<=E?E:4294967296+E)*p,p*=4294967296}return w},n.toString=function(w){if(w=w||10,2>w||36<w)throw Error("radix out of range: "+w);if(V(this))return"0";if(k(this))return"-"+P(this).toString(w);for(var p=d(Math.pow(w,6)),g=this,E="";;){var T=q(g,p).g;g=M(g,T.j(p));var I=((0<g.g.length?g.g[0]:g.h)>>>0).toString(w);if(g=T,V(g))return I+E;for(;6>I.length;)I="0"+I;E=I+E}},n.i=function(w){return 0>w?0:w<this.g.length?this.g[w]:this.h};function V(w){if(w.h!=0)return!1;for(var p=0;p<w.g.length;p++)if(w.g[p]!=0)return!1;return!0}function k(w){return w.h==-1}n.l=function(w){return w=M(this,w),k(w)?-1:V(w)?0:1};function P(w){for(var p=w.g.length,g=[],E=0;E<p;E++)g[E]=~w.g[E];return new a(g,~w.h).add(v)}n.abs=function(){return k(this)?P(this):this},n.add=function(w){for(var p=Math.max(this.g.length,w.g.length),g=[],E=0,T=0;T<=p;T++){var I=E+(this.i(T)&65535)+(w.i(T)&65535),y=(I>>>16)+(this.i(T)>>>16)+(w.i(T)>>>16);E=y>>>16,I&=65535,y&=65535,g[T]=y<<16|I}return new a(g,g[g.length-1]&-2147483648?-1:0)};function M(w,p){return w.add(P(p))}n.j=function(w){if(V(this)||V(w))return _;if(k(this))return k(w)?P(this).j(P(w)):P(P(this).j(w));if(k(w))return P(this.j(P(w)));if(0>this.l(C)&&0>w.l(C))return d(this.m()*w.m());for(var p=this.g.length+w.g.length,g=[],E=0;E<2*p;E++)g[E]=0;for(E=0;E<this.g.length;E++)for(var T=0;T<w.g.length;T++){var I=this.i(E)>>>16,y=this.i(E)&65535,bt=w.i(T)>>>16,mt=w.i(T)&65535;g[2*E+2*T]+=y*mt,$(g,2*E+2*T),g[2*E+2*T+1]+=I*mt,$(g,2*E+2*T+1),g[2*E+2*T+1]+=y*bt,$(g,2*E+2*T+1),g[2*E+2*T+2]+=I*bt,$(g,2*E+2*T+2)}for(E=0;E<p;E++)g[E]=g[2*E+1]<<16|g[2*E];for(E=p;E<2*p;E++)g[E]=0;return new a(g,0)};function $(w,p){for(;(w[p]&65535)!=w[p];)w[p+1]+=w[p]>>>16,w[p]&=65535,p++}function U(w,p){this.g=w,this.h=p}function q(w,p){if(V(p))throw Error("division by zero");if(V(w))return new U(_,_);if(k(w))return p=q(P(w),p),new U(P(p.g),P(p.h));if(k(p))return p=q(w,P(p)),new U(P(p.g),p.h);if(30<w.g.length){if(k(w)||k(p))throw Error("slowDivide_ only works with positive integers.");for(var g=v,E=p;0>=E.l(w);)g=Y(g),E=Y(E);var T=z(g,1),I=z(E,1);for(E=z(E,2),g=z(g,2);!V(E);){var y=I.add(E);0>=y.l(w)&&(T=T.add(g),I=y),E=z(E,1),g=z(g,1)}return p=M(w,T.j(p)),new U(T,p)}for(T=_;0<=w.l(p);){for(g=Math.max(1,Math.floor(w.m()/p.m())),E=Math.ceil(Math.log(g)/Math.LN2),E=48>=E?1:Math.pow(2,E-48),I=d(g),y=I.j(p);k(y)||0<y.l(w);)g-=E,I=d(g),y=I.j(p);V(I)&&(I=v),T=T.add(I),w=M(w,y)}return new U(T,w)}n.A=function(w){return q(this,w).h},n.and=function(w){for(var p=Math.max(this.g.length,w.g.length),g=[],E=0;E<p;E++)g[E]=this.i(E)&w.i(E);return new a(g,this.h&w.h)},n.or=function(w){for(var p=Math.max(this.g.length,w.g.length),g=[],E=0;E<p;E++)g[E]=this.i(E)|w.i(E);return new a(g,this.h|w.h)},n.xor=function(w){for(var p=Math.max(this.g.length,w.g.length),g=[],E=0;E<p;E++)g[E]=this.i(E)^w.i(E);return new a(g,this.h^w.h)};function Y(w){for(var p=w.g.length+1,g=[],E=0;E<p;E++)g[E]=w.i(E)<<1|w.i(E-1)>>>31;return new a(g,w.h)}function z(w,p){var g=p>>5;p%=32;for(var E=w.g.length-g,T=[],I=0;I<E;I++)T[I]=0<p?w.i(I+g)>>>p|w.i(I+g+1)<<32-p:w.i(I+g);return new a(T,w.h)}r.prototype.digest=r.prototype.v,r.prototype.reset=r.prototype.s,r.prototype.update=r.prototype.u,ll=r,a.prototype.add=a.prototype.add,a.prototype.multiply=a.prototype.j,a.prototype.modulo=a.prototype.A,a.prototype.compare=a.prototype.l,a.prototype.toNumber=a.prototype.m,a.prototype.toString=a.prototype.toString,a.prototype.getBits=a.prototype.i,a.fromNumber=d,a.fromString=m,pe=a}).apply(typeof qa<"u"?qa:typeof self<"u"?self:typeof window<"u"?window:{});var Cr=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var ul,Nn,hl,Dr,di,dl,fl,ml;(function(){var n,t=typeof Object.defineProperties=="function"?Object.defineProperty:function(i,c,u){return i==Array.prototype||i==Object.prototype||(i[c]=u.value),i};function e(i){i=[typeof globalThis=="object"&&globalThis,i,typeof window=="object"&&window,typeof self=="object"&&self,typeof Cr=="object"&&Cr];for(var c=0;c<i.length;++c){var u=i[c];if(u&&u.Math==Math)return u}throw Error("Cannot find global object")}var r=e(this);function s(i,c){if(c)t:{var u=r;i=i.split(".");for(var f=0;f<i.length-1;f++){var A=i[f];if(!(A in u))break t;u=u[A]}i=i[i.length-1],f=u[i],c=c(f),c!=f&&c!=null&&t(u,i,{configurable:!0,writable:!0,value:c})}}function o(i,c){i instanceof String&&(i+="");var u=0,f=!1,A={next:function(){if(!f&&u<i.length){var R=u++;return{value:c(R,i[R]),done:!1}}return f=!0,{done:!0,value:void 0}}};return A[Symbol.iterator]=function(){return A},A}s("Array.prototype.values",function(i){return i||function(){return o(this,function(c,u){return u})}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var a=a||{},l=this||self;function h(i){var c=typeof i;return c=c!="object"?c:i?Array.isArray(i)?"array":c:"null",c=="array"||c=="object"&&typeof i.length=="number"}function d(i){var c=typeof i;return c=="object"&&i!=null||c=="function"}function m(i,c,u){return i.call.apply(i.bind,arguments)}function _(i,c,u){if(!i)throw Error();if(2<arguments.length){var f=Array.prototype.slice.call(arguments,2);return function(){var A=Array.prototype.slice.call(arguments);return Array.prototype.unshift.apply(A,f),i.apply(c,A)}}return function(){return i.apply(c,arguments)}}function v(i,c,u){return v=Function.prototype.bind&&Function.prototype.bind.toString().indexOf("native code")!=-1?m:_,v.apply(null,arguments)}function C(i,c){var u=Array.prototype.slice.call(arguments,1);return function(){var f=u.slice();return f.push.apply(f,arguments),i.apply(this,f)}}function V(i,c){function u(){}u.prototype=c.prototype,i.aa=c.prototype,i.prototype=new u,i.prototype.constructor=i,i.Qb=function(f,A,R){for(var N=Array(arguments.length-2),Z=2;Z<arguments.length;Z++)N[Z-2]=arguments[Z];return c.prototype[A].apply(f,N)}}function k(i){const c=i.length;if(0<c){const u=Array(c);for(let f=0;f<c;f++)u[f]=i[f];return u}return[]}function P(i,c){for(let u=1;u<arguments.length;u++){const f=arguments[u];if(h(f)){const A=i.length||0,R=f.length||0;i.length=A+R;for(let N=0;N<R;N++)i[A+N]=f[N]}else i.push(f)}}class M{constructor(c,u){this.i=c,this.j=u,this.h=0,this.g=null}get(){let c;return 0<this.h?(this.h--,c=this.g,this.g=c.next,c.next=null):c=this.i(),c}}function $(i){return/^[\s\xa0]*$/.test(i)}function U(){var i=l.navigator;return i&&(i=i.userAgent)?i:""}function q(i){return q[" "](i),i}q[" "]=function(){};var Y=U().indexOf("Gecko")!=-1&&!(U().toLowerCase().indexOf("webkit")!=-1&&U().indexOf("Edge")==-1)&&!(U().indexOf("Trident")!=-1||U().indexOf("MSIE")!=-1)&&U().indexOf("Edge")==-1;function z(i,c,u){for(const f in i)c.call(u,i[f],f,i)}function w(i,c){for(const u in i)c.call(void 0,i[u],u,i)}function p(i){const c={};for(const u in i)c[u]=i[u];return c}const g="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function E(i,c){let u,f;for(let A=1;A<arguments.length;A++){f=arguments[A];for(u in f)i[u]=f[u];for(let R=0;R<g.length;R++)u=g[R],Object.prototype.hasOwnProperty.call(f,u)&&(i[u]=f[u])}}function T(i){var c=1;i=i.split(":");const u=[];for(;0<c&&i.length;)u.push(i.shift()),c--;return i.length&&u.push(i.join(":")),u}function I(i){l.setTimeout(()=>{throw i},0)}function y(){var i=ie;let c=null;return i.g&&(c=i.g,i.g=i.g.next,i.g||(i.h=null),c.next=null),c}class bt{constructor(){this.h=this.g=null}add(c,u){const f=mt.get();f.set(c,u),this.h?this.h.next=f:this.g=f,this.h=f}}var mt=new M(()=>new je,i=>i.reset());class je{constructor(){this.next=this.g=this.h=null}set(c,u){this.h=c,this.g=u,this.next=null}reset(){this.next=this.g=this.h=null}}let zt,Ht=!1,ie=new bt,Re=()=>{const i=l.Promise.resolve(void 0);zt=()=>{i.then(oe)}};var oe=()=>{for(var i;i=y();){try{i.h.call(i.g)}catch(u){I(u)}var c=mt;c.j(i),100>c.h&&(c.h++,i.next=c.g,c.g=i)}Ht=!1};function jt(){this.s=this.s,this.C=this.C}jt.prototype.s=!1,jt.prototype.ma=function(){this.s||(this.s=!0,this.N())},jt.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function ct(i,c){this.type=i,this.g=this.target=c,this.defaultPrevented=!1}ct.prototype.h=function(){this.defaultPrevented=!0};var ae=(function(){if(!l.addEventListener||!Object.defineProperty)return!1;var i=!1,c=Object.defineProperty({},"passive",{get:function(){i=!0}});try{const u=()=>{};l.addEventListener("test",u,c),l.removeEventListener("test",u,c)}catch{}return i})();function Dt(i,c){if(ct.call(this,i?i.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,i){var u=this.type=i.type,f=i.changedTouches&&i.changedTouches.length?i.changedTouches[0]:null;if(this.target=i.target||i.srcElement,this.g=c,c=i.relatedTarget){if(Y){t:{try{q(c.nodeName);var A=!0;break t}catch{}A=!1}A||(c=null)}}else u=="mouseover"?c=i.fromElement:u=="mouseout"&&(c=i.toElement);this.relatedTarget=c,f?(this.clientX=f.clientX!==void 0?f.clientX:f.pageX,this.clientY=f.clientY!==void 0?f.clientY:f.pageY,this.screenX=f.screenX||0,this.screenY=f.screenY||0):(this.clientX=i.clientX!==void 0?i.clientX:i.pageX,this.clientY=i.clientY!==void 0?i.clientY:i.pageY,this.screenX=i.screenX||0,this.screenY=i.screenY||0),this.button=i.button,this.key=i.key||"",this.ctrlKey=i.ctrlKey,this.altKey=i.altKey,this.shiftKey=i.shiftKey,this.metaKey=i.metaKey,this.pointerId=i.pointerId||0,this.pointerType=typeof i.pointerType=="string"?i.pointerType:Jt[i.pointerType]||"",this.state=i.state,this.i=i,i.defaultPrevented&&Dt.aa.h.call(this)}}V(Dt,ct);var Jt={2:"touch",3:"pen",4:"mouse"};Dt.prototype.h=function(){Dt.aa.h.call(this);var i=this.i;i.preventDefault?i.preventDefault():i.returnValue=!1};var Nt="closure_listenable_"+(1e6*Math.random()|0),kt=0;function Ue(i,c,u,f,A){this.listener=i,this.proxy=null,this.src=c,this.type=u,this.capture=!!f,this.ha=A,this.key=++kt,this.da=this.fa=!1}function ar(i){i.da=!0,i.listener=null,i.proxy=null,i.src=null,i.ha=null}function cr(i){this.src=i,this.g={},this.h=0}cr.prototype.add=function(i,c,u,f,A){var R=i.toString();i=this.g[R],i||(i=this.g[R]=[],this.h++);var N=Rs(i,c,f,A);return-1<N?(c=i[N],u||(c.fa=!1)):(c=new Ue(c,this.src,R,!!f,A),c.fa=u,i.push(c)),c};function Cs(i,c){var u=c.type;if(u in i.g){var f=i.g[u],A=Array.prototype.indexOf.call(f,c,void 0),R;(R=0<=A)&&Array.prototype.splice.call(f,A,1),R&&(ar(c),i.g[u].length==0&&(delete i.g[u],i.h--))}}function Rs(i,c,u,f){for(var A=0;A<i.length;++A){var R=i[A];if(!R.da&&R.listener==c&&R.capture==!!u&&R.ha==f)return A}return-1}var bs="closure_lm_"+(1e6*Math.random()|0),Ss={};function Co(i,c,u,f,A){if(Array.isArray(c)){for(var R=0;R<c.length;R++)Co(i,c[R],u,f,A);return null}return u=So(u),i&&i[Nt]?i.K(c,u,d(f)?!!f.capture:!1,A):Lu(i,c,u,!1,f,A)}function Lu(i,c,u,f,A,R){if(!c)throw Error("Invalid event type");var N=d(A)?!!A.capture:!!A,Z=Vs(i);if(Z||(i[bs]=Z=new cr(i)),u=Z.add(c,u,f,N,R),u.proxy)return u;if(f=Fu(),u.proxy=f,f.src=i,f.listener=u,i.addEventListener)ae||(A=N),A===void 0&&(A=!1),i.addEventListener(c.toString(),f,A);else if(i.attachEvent)i.attachEvent(bo(c.toString()),f);else if(i.addListener&&i.removeListener)i.addListener(f);else throw Error("addEventListener and attachEvent are unavailable.");return u}function Fu(){function i(u){return c.call(i.src,i.listener,u)}const c=$u;return i}function Ro(i,c,u,f,A){if(Array.isArray(c))for(var R=0;R<c.length;R++)Ro(i,c[R],u,f,A);else f=d(f)?!!f.capture:!!f,u=So(u),i&&i[Nt]?(i=i.i,c=String(c).toString(),c in i.g&&(R=i.g[c],u=Rs(R,u,f,A),-1<u&&(ar(R[u]),Array.prototype.splice.call(R,u,1),R.length==0&&(delete i.g[c],i.h--)))):i&&(i=Vs(i))&&(c=i.g[c.toString()],i=-1,c&&(i=Rs(c,u,f,A)),(u=-1<i?c[i]:null)&&Ps(u))}function Ps(i){if(typeof i!="number"&&i&&!i.da){var c=i.src;if(c&&c[Nt])Cs(c.i,i);else{var u=i.type,f=i.proxy;c.removeEventListener?c.removeEventListener(u,f,i.capture):c.detachEvent?c.detachEvent(bo(u),f):c.addListener&&c.removeListener&&c.removeListener(f),(u=Vs(c))?(Cs(u,i),u.h==0&&(u.src=null,c[bs]=null)):ar(i)}}}function bo(i){return i in Ss?Ss[i]:Ss[i]="on"+i}function $u(i,c){if(i.da)i=!0;else{c=new Dt(c,this);var u=i.listener,f=i.ha||i.src;i.fa&&Ps(i),i=u.call(f,c)}return i}function Vs(i){return i=i[bs],i instanceof cr?i:null}var Ds="__closure_events_fn_"+(1e9*Math.random()>>>0);function So(i){return typeof i=="function"?i:(i[Ds]||(i[Ds]=function(c){return i.handleEvent(c)}),i[Ds])}function Tt(){jt.call(this),this.i=new cr(this),this.M=this,this.F=null}V(Tt,jt),Tt.prototype[Nt]=!0,Tt.prototype.removeEventListener=function(i,c,u,f){Ro(this,i,c,u,f)};function St(i,c){var u,f=i.F;if(f)for(u=[];f;f=f.F)u.push(f);if(i=i.M,f=c.type||c,typeof c=="string")c=new ct(c,i);else if(c instanceof ct)c.target=c.target||i;else{var A=c;c=new ct(f,i),E(c,A)}if(A=!0,u)for(var R=u.length-1;0<=R;R--){var N=c.g=u[R];A=lr(N,f,!0,c)&&A}if(N=c.g=i,A=lr(N,f,!0,c)&&A,A=lr(N,f,!1,c)&&A,u)for(R=0;R<u.length;R++)N=c.g=u[R],A=lr(N,f,!1,c)&&A}Tt.prototype.N=function(){if(Tt.aa.N.call(this),this.i){var i=this.i,c;for(c in i.g){for(var u=i.g[c],f=0;f<u.length;f++)ar(u[f]);delete i.g[c],i.h--}}this.F=null},Tt.prototype.K=function(i,c,u,f){return this.i.add(String(i),c,!1,u,f)},Tt.prototype.L=function(i,c,u,f){return this.i.add(String(i),c,!0,u,f)};function lr(i,c,u,f){if(c=i.i.g[String(c)],!c)return!0;c=c.concat();for(var A=!0,R=0;R<c.length;++R){var N=c[R];if(N&&!N.da&&N.capture==u){var Z=N.listener,_t=N.ha||N.src;N.fa&&Cs(i.i,N),A=Z.call(_t,f)!==!1&&A}}return A&&!f.defaultPrevented}function Po(i,c,u){if(typeof i=="function")u&&(i=v(i,u));else if(i&&typeof i.handleEvent=="function")i=v(i.handleEvent,i);else throw Error("Invalid listener argument");return 2147483647<Number(c)?-1:l.setTimeout(i,c||0)}function Vo(i){i.g=Po(()=>{i.g=null,i.i&&(i.i=!1,Vo(i))},i.l);const c=i.h;i.h=null,i.m.apply(null,c)}class ju extends jt{constructor(c,u){super(),this.m=c,this.l=u,this.h=null,this.i=!1,this.g=null}j(c){this.h=arguments,this.g?this.i=!0:Vo(this)}N(){super.N(),this.g&&(l.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function En(i){jt.call(this),this.h=i,this.g={}}V(En,jt);var Do=[];function No(i){z(i.g,function(c,u){this.g.hasOwnProperty(u)&&Ps(c)},i),i.g={}}En.prototype.N=function(){En.aa.N.call(this),No(this)},En.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Ns=l.JSON.stringify,Uu=l.JSON.parse,Bu=class{stringify(i){return l.JSON.stringify(i,void 0)}parse(i){return l.JSON.parse(i,void 0)}};function xs(){}xs.prototype.h=null;function xo(i){return i.h||(i.h=i.i())}function ko(){}var vn={OPEN:"a",kb:"b",Ja:"c",wb:"d"};function ks(){ct.call(this,"d")}V(ks,ct);function Os(){ct.call(this,"c")}V(Os,ct);var be={},Oo=null;function ur(){return Oo=Oo||new Tt}be.La="serverreachability";function Mo(i){ct.call(this,be.La,i)}V(Mo,ct);function Tn(i){const c=ur();St(c,new Mo(c))}be.STAT_EVENT="statevent";function Lo(i,c){ct.call(this,be.STAT_EVENT,i),this.stat=c}V(Lo,ct);function Pt(i){const c=ur();St(c,new Lo(c,i))}be.Ma="timingevent";function Fo(i,c){ct.call(this,be.Ma,i),this.size=c}V(Fo,ct);function wn(i,c){if(typeof i!="function")throw Error("Fn must not be null and must be a function");return l.setTimeout(function(){i()},c)}function In(){this.g=!0}In.prototype.xa=function(){this.g=!1};function qu(i,c,u,f,A,R){i.info(function(){if(i.g)if(R)for(var N="",Z=R.split("&"),_t=0;_t<Z.length;_t++){var X=Z[_t].split("=");if(1<X.length){var wt=X[0];X=X[1];var It=wt.split("_");N=2<=It.length&&It[1]=="type"?N+(wt+"="+X+"&"):N+(wt+"=redacted&")}}else N=null;else N=R;return"XMLHTTP REQ ("+f+") [attempt "+A+"]: "+c+`
`+u+`
`+N})}function zu(i,c,u,f,A,R,N){i.info(function(){return"XMLHTTP RESP ("+f+") [ attempt "+A+"]: "+c+`
`+u+`
`+R+" "+N})}function Be(i,c,u,f){i.info(function(){return"XMLHTTP TEXT ("+c+"): "+Gu(i,u)+(f?" "+f:"")})}function Hu(i,c){i.info(function(){return"TIMEOUT: "+c})}In.prototype.info=function(){};function Gu(i,c){if(!i.g)return c;if(!c)return null;try{var u=JSON.parse(c);if(u){for(i=0;i<u.length;i++)if(Array.isArray(u[i])){var f=u[i];if(!(2>f.length)){var A=f[1];if(Array.isArray(A)&&!(1>A.length)){var R=A[0];if(R!="noop"&&R!="stop"&&R!="close")for(var N=1;N<A.length;N++)A[N]=""}}}}return Ns(u)}catch{return c}}var hr={NO_ERROR:0,gb:1,tb:2,sb:3,nb:4,rb:5,ub:6,Ia:7,TIMEOUT:8,xb:9},$o={lb:"complete",Hb:"success",Ja:"error",Ia:"abort",zb:"ready",Ab:"readystatechange",TIMEOUT:"timeout",vb:"incrementaldata",yb:"progress",ob:"downloadprogress",Pb:"uploadprogress"},Ms;function dr(){}V(dr,xs),dr.prototype.g=function(){return new XMLHttpRequest},dr.prototype.i=function(){return{}},Ms=new dr;function ce(i,c,u,f){this.j=i,this.i=c,this.l=u,this.R=f||1,this.U=new En(this),this.I=45e3,this.H=null,this.o=!1,this.m=this.A=this.v=this.L=this.F=this.S=this.B=null,this.D=[],this.g=null,this.C=0,this.s=this.u=null,this.X=-1,this.J=!1,this.O=0,this.M=null,this.W=this.K=this.T=this.P=!1,this.h=new jo}function jo(){this.i=null,this.g="",this.h=!1}var Uo={},Ls={};function Fs(i,c,u){i.L=1,i.v=gr(Zt(c)),i.m=u,i.P=!0,Bo(i,null)}function Bo(i,c){i.F=Date.now(),fr(i),i.A=Zt(i.v);var u=i.A,f=i.R;Array.isArray(f)||(f=[String(f)]),na(u.i,"t",f),i.C=0,u=i.j.J,i.h=new jo,i.g=va(i.j,u?c:null,!i.m),0<i.O&&(i.M=new ju(v(i.Y,i,i.g),i.O)),c=i.U,u=i.g,f=i.ca;var A="readystatechange";Array.isArray(A)||(A&&(Do[0]=A.toString()),A=Do);for(var R=0;R<A.length;R++){var N=Co(u,A[R],f||c.handleEvent,!1,c.h||c);if(!N)break;c.g[N.key]=N}c=i.H?p(i.H):{},i.m?(i.u||(i.u="POST"),c["Content-Type"]="application/x-www-form-urlencoded",i.g.ea(i.A,i.u,i.m,c)):(i.u="GET",i.g.ea(i.A,i.u,null,c)),Tn(),qu(i.i,i.u,i.A,i.l,i.R,i.m)}ce.prototype.ca=function(i){i=i.target;const c=this.M;c&&te(i)==3?c.j():this.Y(i)},ce.prototype.Y=function(i){try{if(i==this.g)t:{const It=te(this.g);var c=this.g.Ba();const He=this.g.Z();if(!(3>It)&&(It!=3||this.g&&(this.h.h||this.g.oa()||la(this.g)))){this.J||It!=4||c==7||(c==8||0>=He?Tn(3):Tn(2)),$s(this);var u=this.g.Z();this.X=u;e:if(qo(this)){var f=la(this.g);i="";var A=f.length,R=te(this.g)==4;if(!this.h.i){if(typeof TextDecoder>"u"){Se(this),An(this);var N="";break e}this.h.i=new l.TextDecoder}for(c=0;c<A;c++)this.h.h=!0,i+=this.h.i.decode(f[c],{stream:!(R&&c==A-1)});f.length=0,this.h.g+=i,this.C=0,N=this.h.g}else N=this.g.oa();if(this.o=u==200,zu(this.i,this.u,this.A,this.l,this.R,It,u),this.o){if(this.T&&!this.K){e:{if(this.g){var Z,_t=this.g;if((Z=_t.g?_t.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!$(Z)){var X=Z;break e}}X=null}if(u=X)Be(this.i,this.l,u,"Initial handshake response via X-HTTP-Initial-Response"),this.K=!0,js(this,u);else{this.o=!1,this.s=3,Pt(12),Se(this),An(this);break t}}if(this.P){u=!0;let Ut;for(;!this.J&&this.C<N.length;)if(Ut=Wu(this,N),Ut==Ls){It==4&&(this.s=4,Pt(14),u=!1),Be(this.i,this.l,null,"[Incomplete Response]");break}else if(Ut==Uo){this.s=4,Pt(15),Be(this.i,this.l,N,"[Invalid Chunk]"),u=!1;break}else Be(this.i,this.l,Ut,null),js(this,Ut);if(qo(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),It!=4||N.length!=0||this.h.h||(this.s=1,Pt(16),u=!1),this.o=this.o&&u,!u)Be(this.i,this.l,N,"[Invalid Chunked Response]"),Se(this),An(this);else if(0<N.length&&!this.W){this.W=!0;var wt=this.j;wt.g==this&&wt.ba&&!wt.M&&(wt.j.info("Great, no buffering proxy detected. Bytes received: "+N.length),Gs(wt),wt.M=!0,Pt(11))}}else Be(this.i,this.l,N,null),js(this,N);It==4&&Se(this),this.o&&!this.J&&(It==4?ga(this.j,this):(this.o=!1,fr(this)))}else uh(this.g),u==400&&0<N.indexOf("Unknown SID")?(this.s=3,Pt(12)):(this.s=0,Pt(13)),Se(this),An(this)}}}catch{}finally{}};function qo(i){return i.g?i.u=="GET"&&i.L!=2&&i.j.Ca:!1}function Wu(i,c){var u=i.C,f=c.indexOf(`
`,u);return f==-1?Ls:(u=Number(c.substring(u,f)),isNaN(u)?Uo:(f+=1,f+u>c.length?Ls:(c=c.slice(f,f+u),i.C=f+u,c)))}ce.prototype.cancel=function(){this.J=!0,Se(this)};function fr(i){i.S=Date.now()+i.I,zo(i,i.I)}function zo(i,c){if(i.B!=null)throw Error("WatchDog timer not null");i.B=wn(v(i.ba,i),c)}function $s(i){i.B&&(l.clearTimeout(i.B),i.B=null)}ce.prototype.ba=function(){this.B=null;const i=Date.now();0<=i-this.S?(Hu(this.i,this.A),this.L!=2&&(Tn(),Pt(17)),Se(this),this.s=2,An(this)):zo(this,this.S-i)};function An(i){i.j.G==0||i.J||ga(i.j,i)}function Se(i){$s(i);var c=i.M;c&&typeof c.ma=="function"&&c.ma(),i.M=null,No(i.U),i.g&&(c=i.g,i.g=null,c.abort(),c.ma())}function js(i,c){try{var u=i.j;if(u.G!=0&&(u.g==i||Us(u.h,i))){if(!i.K&&Us(u.h,i)&&u.G==3){try{var f=u.Da.g.parse(c)}catch{f=null}if(Array.isArray(f)&&f.length==3){var A=f;if(A[0]==0){t:if(!u.u){if(u.g)if(u.g.F+3e3<i.F)wr(u),vr(u);else break t;Hs(u),Pt(18)}}else u.za=A[1],0<u.za-u.T&&37500>A[2]&&u.F&&u.v==0&&!u.C&&(u.C=wn(v(u.Za,u),6e3));if(1>=Wo(u.h)&&u.ca){try{u.ca()}catch{}u.ca=void 0}}else Ve(u,11)}else if((i.K||u.g==i)&&wr(u),!$(c))for(A=u.Da.g.parse(c),c=0;c<A.length;c++){let X=A[c];if(u.T=X[0],X=X[1],u.G==2)if(X[0]=="c"){u.K=X[1],u.ia=X[2];const wt=X[3];wt!=null&&(u.la=wt,u.j.info("VER="+u.la));const It=X[4];It!=null&&(u.Aa=It,u.j.info("SVER="+u.Aa));const He=X[5];He!=null&&typeof He=="number"&&0<He&&(f=1.5*He,u.L=f,u.j.info("backChannelRequestTimeoutMs_="+f)),f=u;const Ut=i.g;if(Ut){const Ar=Ut.g?Ut.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Ar){var R=f.h;R.g||Ar.indexOf("spdy")==-1&&Ar.indexOf("quic")==-1&&Ar.indexOf("h2")==-1||(R.j=R.l,R.g=new Set,R.h&&(Bs(R,R.h),R.h=null))}if(f.D){const Ws=Ut.g?Ut.g.getResponseHeader("X-HTTP-Session-Id"):null;Ws&&(f.ya=Ws,tt(f.I,f.D,Ws))}}u.G=3,u.l&&u.l.ua(),u.ba&&(u.R=Date.now()-i.F,u.j.info("Handshake RTT: "+u.R+"ms")),f=u;var N=i;if(f.qa=Ea(f,f.J?f.ia:null,f.W),N.K){Ko(f.h,N);var Z=N,_t=f.L;_t&&(Z.I=_t),Z.B&&($s(Z),fr(Z)),f.g=N}else ma(f);0<u.i.length&&Tr(u)}else X[0]!="stop"&&X[0]!="close"||Ve(u,7);else u.G==3&&(X[0]=="stop"||X[0]=="close"?X[0]=="stop"?Ve(u,7):zs(u):X[0]!="noop"&&u.l&&u.l.ta(X),u.v=0)}}Tn(4)}catch{}}var Ku=class{constructor(i,c){this.g=i,this.map=c}};function Ho(i){this.l=i||10,l.PerformanceNavigationTiming?(i=l.performance.getEntriesByType("navigation"),i=0<i.length&&(i[0].nextHopProtocol=="hq"||i[0].nextHopProtocol=="h2")):i=!!(l.chrome&&l.chrome.loadTimes&&l.chrome.loadTimes()&&l.chrome.loadTimes().wasFetchedViaSpdy),this.j=i?this.l:1,this.g=null,1<this.j&&(this.g=new Set),this.h=null,this.i=[]}function Go(i){return i.h?!0:i.g?i.g.size>=i.j:!1}function Wo(i){return i.h?1:i.g?i.g.size:0}function Us(i,c){return i.h?i.h==c:i.g?i.g.has(c):!1}function Bs(i,c){i.g?i.g.add(c):i.h=c}function Ko(i,c){i.h&&i.h==c?i.h=null:i.g&&i.g.has(c)&&i.g.delete(c)}Ho.prototype.cancel=function(){if(this.i=Qo(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const i of this.g.values())i.cancel();this.g.clear()}};function Qo(i){if(i.h!=null)return i.i.concat(i.h.D);if(i.g!=null&&i.g.size!==0){let c=i.i;for(const u of i.g.values())c=c.concat(u.D);return c}return k(i.i)}function Qu(i){if(i.V&&typeof i.V=="function")return i.V();if(typeof Map<"u"&&i instanceof Map||typeof Set<"u"&&i instanceof Set)return Array.from(i.values());if(typeof i=="string")return i.split("");if(h(i)){for(var c=[],u=i.length,f=0;f<u;f++)c.push(i[f]);return c}c=[],u=0;for(f in i)c[u++]=i[f];return c}function Xu(i){if(i.na&&typeof i.na=="function")return i.na();if(!i.V||typeof i.V!="function"){if(typeof Map<"u"&&i instanceof Map)return Array.from(i.keys());if(!(typeof Set<"u"&&i instanceof Set)){if(h(i)||typeof i=="string"){var c=[];i=i.length;for(var u=0;u<i;u++)c.push(u);return c}c=[],u=0;for(const f in i)c[u++]=f;return c}}}function Xo(i,c){if(i.forEach&&typeof i.forEach=="function")i.forEach(c,void 0);else if(h(i)||typeof i=="string")Array.prototype.forEach.call(i,c,void 0);else for(var u=Xu(i),f=Qu(i),A=f.length,R=0;R<A;R++)c.call(void 0,f[R],u&&u[R],i)}var Yo=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function Yu(i,c){if(i){i=i.split("&");for(var u=0;u<i.length;u++){var f=i[u].indexOf("="),A=null;if(0<=f){var R=i[u].substring(0,f);A=i[u].substring(f+1)}else R=i[u];c(R,A?decodeURIComponent(A.replace(/\+/g," ")):"")}}}function Pe(i){if(this.g=this.o=this.j="",this.s=null,this.m=this.l="",this.h=!1,i instanceof Pe){this.h=i.h,mr(this,i.j),this.o=i.o,this.g=i.g,pr(this,i.s),this.l=i.l;var c=i.i,u=new bn;u.i=c.i,c.g&&(u.g=new Map(c.g),u.h=c.h),Jo(this,u),this.m=i.m}else i&&(c=String(i).match(Yo))?(this.h=!1,mr(this,c[1]||"",!0),this.o=Cn(c[2]||""),this.g=Cn(c[3]||"",!0),pr(this,c[4]),this.l=Cn(c[5]||"",!0),Jo(this,c[6]||"",!0),this.m=Cn(c[7]||"")):(this.h=!1,this.i=new bn(null,this.h))}Pe.prototype.toString=function(){var i=[],c=this.j;c&&i.push(Rn(c,Zo,!0),":");var u=this.g;return(u||c=="file")&&(i.push("//"),(c=this.o)&&i.push(Rn(c,Zo,!0),"@"),i.push(encodeURIComponent(String(u)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),u=this.s,u!=null&&i.push(":",String(u))),(u=this.l)&&(this.g&&u.charAt(0)!="/"&&i.push("/"),i.push(Rn(u,u.charAt(0)=="/"?th:Zu,!0))),(u=this.i.toString())&&i.push("?",u),(u=this.m)&&i.push("#",Rn(u,nh)),i.join("")};function Zt(i){return new Pe(i)}function mr(i,c,u){i.j=u?Cn(c,!0):c,i.j&&(i.j=i.j.replace(/:$/,""))}function pr(i,c){if(c){if(c=Number(c),isNaN(c)||0>c)throw Error("Bad port number "+c);i.s=c}else i.s=null}function Jo(i,c,u){c instanceof bn?(i.i=c,rh(i.i,i.h)):(u||(c=Rn(c,eh)),i.i=new bn(c,i.h))}function tt(i,c,u){i.i.set(c,u)}function gr(i){return tt(i,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36)),i}function Cn(i,c){return i?c?decodeURI(i.replace(/%25/g,"%2525")):decodeURIComponent(i):""}function Rn(i,c,u){return typeof i=="string"?(i=encodeURI(i).replace(c,Ju),u&&(i=i.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),i):null}function Ju(i){return i=i.charCodeAt(0),"%"+(i>>4&15).toString(16)+(i&15).toString(16)}var Zo=/[#\/\?@]/g,Zu=/[#\?:]/g,th=/[#\?]/g,eh=/[#\?@]/g,nh=/#/g;function bn(i,c){this.h=this.g=null,this.i=i||null,this.j=!!c}function le(i){i.g||(i.g=new Map,i.h=0,i.i&&Yu(i.i,function(c,u){i.add(decodeURIComponent(c.replace(/\+/g," ")),u)}))}n=bn.prototype,n.add=function(i,c){le(this),this.i=null,i=qe(this,i);var u=this.g.get(i);return u||this.g.set(i,u=[]),u.push(c),this.h+=1,this};function ta(i,c){le(i),c=qe(i,c),i.g.has(c)&&(i.i=null,i.h-=i.g.get(c).length,i.g.delete(c))}function ea(i,c){return le(i),c=qe(i,c),i.g.has(c)}n.forEach=function(i,c){le(this),this.g.forEach(function(u,f){u.forEach(function(A){i.call(c,A,f,this)},this)},this)},n.na=function(){le(this);const i=Array.from(this.g.values()),c=Array.from(this.g.keys()),u=[];for(let f=0;f<c.length;f++){const A=i[f];for(let R=0;R<A.length;R++)u.push(c[f])}return u},n.V=function(i){le(this);let c=[];if(typeof i=="string")ea(this,i)&&(c=c.concat(this.g.get(qe(this,i))));else{i=Array.from(this.g.values());for(let u=0;u<i.length;u++)c=c.concat(i[u])}return c},n.set=function(i,c){return le(this),this.i=null,i=qe(this,i),ea(this,i)&&(this.h-=this.g.get(i).length),this.g.set(i,[c]),this.h+=1,this},n.get=function(i,c){return i?(i=this.V(i),0<i.length?String(i[0]):c):c};function na(i,c,u){ta(i,c),0<u.length&&(i.i=null,i.g.set(qe(i,c),k(u)),i.h+=u.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const i=[],c=Array.from(this.g.keys());for(var u=0;u<c.length;u++){var f=c[u];const R=encodeURIComponent(String(f)),N=this.V(f);for(f=0;f<N.length;f++){var A=R;N[f]!==""&&(A+="="+encodeURIComponent(String(N[f]))),i.push(A)}}return this.i=i.join("&")};function qe(i,c){return c=String(c),i.j&&(c=c.toLowerCase()),c}function rh(i,c){c&&!i.j&&(le(i),i.i=null,i.g.forEach(function(u,f){var A=f.toLowerCase();f!=A&&(ta(this,f),na(this,A,u))},i)),i.j=c}function sh(i,c){const u=new In;if(l.Image){const f=new Image;f.onload=C(ue,u,"TestLoadImage: loaded",!0,c,f),f.onerror=C(ue,u,"TestLoadImage: error",!1,c,f),f.onabort=C(ue,u,"TestLoadImage: abort",!1,c,f),f.ontimeout=C(ue,u,"TestLoadImage: timeout",!1,c,f),l.setTimeout(function(){f.ontimeout&&f.ontimeout()},1e4),f.src=i}else c(!1)}function ih(i,c){const u=new In,f=new AbortController,A=setTimeout(()=>{f.abort(),ue(u,"TestPingServer: timeout",!1,c)},1e4);fetch(i,{signal:f.signal}).then(R=>{clearTimeout(A),R.ok?ue(u,"TestPingServer: ok",!0,c):ue(u,"TestPingServer: server error",!1,c)}).catch(()=>{clearTimeout(A),ue(u,"TestPingServer: error",!1,c)})}function ue(i,c,u,f,A){try{A&&(A.onload=null,A.onerror=null,A.onabort=null,A.ontimeout=null),f(u)}catch{}}function oh(){this.g=new Bu}function ah(i,c,u){const f=u||"";try{Xo(i,function(A,R){let N=A;d(A)&&(N=Ns(A)),c.push(f+R+"="+encodeURIComponent(N))})}catch(A){throw c.push(f+"type="+encodeURIComponent("_badmap")),A}}function _r(i){this.l=i.Ub||null,this.j=i.eb||!1}V(_r,xs),_r.prototype.g=function(){return new yr(this.l,this.j)},_r.prototype.i=(function(i){return function(){return i}})({});function yr(i,c){Tt.call(this),this.D=i,this.o=c,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.u=new Headers,this.h=null,this.B="GET",this.A="",this.g=!1,this.v=this.j=this.l=null}V(yr,Tt),n=yr.prototype,n.open=function(i,c){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.B=i,this.A=c,this.readyState=1,Pn(this)},n.send=function(i){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");this.g=!0;const c={headers:this.u,method:this.B,credentials:this.m,cache:void 0};i&&(c.body=i),(this.D||l).fetch(new Request(this.A,c)).then(this.Sa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.u=new Headers,this.status=0,this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),1<=this.readyState&&this.g&&this.readyState!=4&&(this.g=!1,Sn(this)),this.readyState=0},n.Sa=function(i){if(this.g&&(this.l=i,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=i.headers,this.readyState=2,Pn(this)),this.g&&(this.readyState=3,Pn(this),this.g)))if(this.responseType==="arraybuffer")i.arrayBuffer().then(this.Qa.bind(this),this.ga.bind(this));else if(typeof l.ReadableStream<"u"&&"body"in i){if(this.j=i.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.v=new TextDecoder;ra(this)}else i.text().then(this.Ra.bind(this),this.ga.bind(this))};function ra(i){i.j.read().then(i.Pa.bind(i)).catch(i.ga.bind(i))}n.Pa=function(i){if(this.g){if(this.o&&i.value)this.response.push(i.value);else if(!this.o){var c=i.value?i.value:new Uint8Array(0);(c=this.v.decode(c,{stream:!i.done}))&&(this.response=this.responseText+=c)}i.done?Sn(this):Pn(this),this.readyState==3&&ra(this)}},n.Ra=function(i){this.g&&(this.response=this.responseText=i,Sn(this))},n.Qa=function(i){this.g&&(this.response=i,Sn(this))},n.ga=function(){this.g&&Sn(this)};function Sn(i){i.readyState=4,i.l=null,i.j=null,i.v=null,Pn(i)}n.setRequestHeader=function(i,c){this.u.append(i,c)},n.getResponseHeader=function(i){return this.h&&this.h.get(i.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const i=[],c=this.h.entries();for(var u=c.next();!u.done;)u=u.value,i.push(u[0]+": "+u[1]),u=c.next();return i.join(`\r
`)};function Pn(i){i.onreadystatechange&&i.onreadystatechange.call(i)}Object.defineProperty(yr.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(i){this.m=i?"include":"same-origin"}});function sa(i){let c="";return z(i,function(u,f){c+=f,c+=":",c+=u,c+=`\r
`}),c}function qs(i,c,u){t:{for(f in u){var f=!1;break t}f=!0}f||(u=sa(u),typeof i=="string"?u!=null&&encodeURIComponent(String(u)):tt(i,c,u))}function ot(i){Tt.call(this),this.headers=new Map,this.o=i||null,this.h=!1,this.v=this.g=null,this.D="",this.m=0,this.l="",this.j=this.B=this.u=this.A=!1,this.I=null,this.H="",this.J=!1}V(ot,Tt);var ch=/^https?$/i,lh=["POST","PUT"];n=ot.prototype,n.Ha=function(i){this.J=i},n.ea=function(i,c,u,f){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+i);c=c?c.toUpperCase():"GET",this.D=i,this.l="",this.m=0,this.A=!1,this.h=!0,this.g=this.o?this.o.g():Ms.g(),this.v=this.o?xo(this.o):xo(Ms),this.g.onreadystatechange=v(this.Ea,this);try{this.B=!0,this.g.open(c,String(i),!0),this.B=!1}catch(R){ia(this,R);return}if(i=u||"",u=new Map(this.headers),f)if(Object.getPrototypeOf(f)===Object.prototype)for(var A in f)u.set(A,f[A]);else if(typeof f.keys=="function"&&typeof f.get=="function")for(const R of f.keys())u.set(R,f.get(R));else throw Error("Unknown input type for opt_headers: "+String(f));f=Array.from(u.keys()).find(R=>R.toLowerCase()=="content-type"),A=l.FormData&&i instanceof l.FormData,!(0<=Array.prototype.indexOf.call(lh,c,void 0))||f||A||u.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[R,N]of u)this.g.setRequestHeader(R,N);this.H&&(this.g.responseType=this.H),"withCredentials"in this.g&&this.g.withCredentials!==this.J&&(this.g.withCredentials=this.J);try{ca(this),this.u=!0,this.g.send(i),this.u=!1}catch(R){ia(this,R)}};function ia(i,c){i.h=!1,i.g&&(i.j=!0,i.g.abort(),i.j=!1),i.l=c,i.m=5,oa(i),Er(i)}function oa(i){i.A||(i.A=!0,St(i,"complete"),St(i,"error"))}n.abort=function(i){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.m=i||7,St(this,"complete"),St(this,"abort"),Er(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Er(this,!0)),ot.aa.N.call(this)},n.Ea=function(){this.s||(this.B||this.u||this.j?aa(this):this.bb())},n.bb=function(){aa(this)};function aa(i){if(i.h&&typeof a<"u"&&(!i.v[1]||te(i)!=4||i.Z()!=2)){if(i.u&&te(i)==4)Po(i.Ea,0,i);else if(St(i,"readystatechange"),te(i)==4){i.h=!1;try{const N=i.Z();t:switch(N){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var c=!0;break t;default:c=!1}var u;if(!(u=c)){var f;if(f=N===0){var A=String(i.D).match(Yo)[1]||null;!A&&l.self&&l.self.location&&(A=l.self.location.protocol.slice(0,-1)),f=!ch.test(A?A.toLowerCase():"")}u=f}if(u)St(i,"complete"),St(i,"success");else{i.m=6;try{var R=2<te(i)?i.g.statusText:""}catch{R=""}i.l=R+" ["+i.Z()+"]",oa(i)}}finally{Er(i)}}}}function Er(i,c){if(i.g){ca(i);const u=i.g,f=i.v[0]?()=>{}:null;i.g=null,i.v=null,c||St(i,"ready");try{u.onreadystatechange=f}catch{}}}function ca(i){i.I&&(l.clearTimeout(i.I),i.I=null)}n.isActive=function(){return!!this.g};function te(i){return i.g?i.g.readyState:0}n.Z=function(){try{return 2<te(this)?this.g.status:-1}catch{return-1}},n.oa=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.Oa=function(i){if(this.g){var c=this.g.responseText;return i&&c.indexOf(i)==0&&(c=c.substring(i.length)),Uu(c)}};function la(i){try{if(!i.g)return null;if("response"in i.g)return i.g.response;switch(i.H){case"":case"text":return i.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in i.g)return i.g.mozResponseArrayBuffer}return null}catch{return null}}function uh(i){const c={};i=(i.g&&2<=te(i)&&i.g.getAllResponseHeaders()||"").split(`\r
`);for(let f=0;f<i.length;f++){if($(i[f]))continue;var u=T(i[f]);const A=u[0];if(u=u[1],typeof u!="string")continue;u=u.trim();const R=c[A]||[];c[A]=R,R.push(u)}w(c,function(f){return f.join(", ")})}n.Ba=function(){return this.m},n.Ka=function(){return typeof this.l=="string"?this.l:String(this.l)};function Vn(i,c,u){return u&&u.internalChannelParams&&u.internalChannelParams[i]||c}function ua(i){this.Aa=0,this.i=[],this.j=new In,this.ia=this.qa=this.I=this.W=this.g=this.ya=this.D=this.H=this.m=this.S=this.o=null,this.Ya=this.U=0,this.Va=Vn("failFast",!1,i),this.F=this.C=this.u=this.s=this.l=null,this.X=!0,this.za=this.T=-1,this.Y=this.v=this.B=0,this.Ta=Vn("baseRetryDelayMs",5e3,i),this.cb=Vn("retryDelaySeedMs",1e4,i),this.Wa=Vn("forwardChannelMaxRetries",2,i),this.wa=Vn("forwardChannelRequestTimeoutMs",2e4,i),this.pa=i&&i.xmlHttpFactory||void 0,this.Xa=i&&i.Tb||void 0,this.Ca=i&&i.useFetchStreams||!1,this.L=void 0,this.J=i&&i.supportsCrossDomainXhr||!1,this.K="",this.h=new Ho(i&&i.concurrentRequestLimit),this.Da=new oh,this.P=i&&i.fastHandshake||!1,this.O=i&&i.encodeInitMessageHeaders||!1,this.P&&this.O&&(this.O=!1),this.Ua=i&&i.Rb||!1,i&&i.xa&&this.j.xa(),i&&i.forceLongPolling&&(this.X=!1),this.ba=!this.P&&this.X&&i&&i.detectBufferingProxy||!1,this.ja=void 0,i&&i.longPollingTimeout&&0<i.longPollingTimeout&&(this.ja=i.longPollingTimeout),this.ca=void 0,this.R=0,this.M=!1,this.ka=this.A=null}n=ua.prototype,n.la=8,n.G=1,n.connect=function(i,c,u,f){Pt(0),this.W=i,this.H=c||{},u&&f!==void 0&&(this.H.OSID=u,this.H.OAID=f),this.F=this.X,this.I=Ea(this,null,this.W),Tr(this)};function zs(i){if(ha(i),i.G==3){var c=i.U++,u=Zt(i.I);if(tt(u,"SID",i.K),tt(u,"RID",c),tt(u,"TYPE","terminate"),Dn(i,u),c=new ce(i,i.j,c),c.L=2,c.v=gr(Zt(u)),u=!1,l.navigator&&l.navigator.sendBeacon)try{u=l.navigator.sendBeacon(c.v.toString(),"")}catch{}!u&&l.Image&&(new Image().src=c.v,u=!0),u||(c.g=va(c.j,null),c.g.ea(c.v)),c.F=Date.now(),fr(c)}ya(i)}function vr(i){i.g&&(Gs(i),i.g.cancel(),i.g=null)}function ha(i){vr(i),i.u&&(l.clearTimeout(i.u),i.u=null),wr(i),i.h.cancel(),i.s&&(typeof i.s=="number"&&l.clearTimeout(i.s),i.s=null)}function Tr(i){if(!Go(i.h)&&!i.s){i.s=!0;var c=i.Ga;zt||Re(),Ht||(zt(),Ht=!0),ie.add(c,i),i.B=0}}function hh(i,c){return Wo(i.h)>=i.h.j-(i.s?1:0)?!1:i.s?(i.i=c.D.concat(i.i),!0):i.G==1||i.G==2||i.B>=(i.Va?0:i.Wa)?!1:(i.s=wn(v(i.Ga,i,c),_a(i,i.B)),i.B++,!0)}n.Ga=function(i){if(this.s)if(this.s=null,this.G==1){if(!i){this.U=Math.floor(1e5*Math.random()),i=this.U++;const A=new ce(this,this.j,i);let R=this.o;if(this.S&&(R?(R=p(R),E(R,this.S)):R=this.S),this.m!==null||this.O||(A.H=R,R=null),this.P)t:{for(var c=0,u=0;u<this.i.length;u++){e:{var f=this.i[u];if("__data__"in f.map&&(f=f.map.__data__,typeof f=="string")){f=f.length;break e}f=void 0}if(f===void 0)break;if(c+=f,4096<c){c=u;break t}if(c===4096||u===this.i.length-1){c=u+1;break t}}c=1e3}else c=1e3;c=fa(this,A,c),u=Zt(this.I),tt(u,"RID",i),tt(u,"CVER",22),this.D&&tt(u,"X-HTTP-Session-Id",this.D),Dn(this,u),R&&(this.O?c="headers="+encodeURIComponent(String(sa(R)))+"&"+c:this.m&&qs(u,this.m,R)),Bs(this.h,A),this.Ua&&tt(u,"TYPE","init"),this.P?(tt(u,"$req",c),tt(u,"SID","null"),A.T=!0,Fs(A,u,null)):Fs(A,u,c),this.G=2}}else this.G==3&&(i?da(this,i):this.i.length==0||Go(this.h)||da(this))};function da(i,c){var u;c?u=c.l:u=i.U++;const f=Zt(i.I);tt(f,"SID",i.K),tt(f,"RID",u),tt(f,"AID",i.T),Dn(i,f),i.m&&i.o&&qs(f,i.m,i.o),u=new ce(i,i.j,u,i.B+1),i.m===null&&(u.H=i.o),c&&(i.i=c.D.concat(i.i)),c=fa(i,u,1e3),u.I=Math.round(.5*i.wa)+Math.round(.5*i.wa*Math.random()),Bs(i.h,u),Fs(u,f,c)}function Dn(i,c){i.H&&z(i.H,function(u,f){tt(c,f,u)}),i.l&&Xo({},function(u,f){tt(c,f,u)})}function fa(i,c,u){u=Math.min(i.i.length,u);var f=i.l?v(i.l.Na,i.l,i):null;t:{var A=i.i;let R=-1;for(;;){const N=["count="+u];R==-1?0<u?(R=A[0].g,N.push("ofs="+R)):R=0:N.push("ofs="+R);let Z=!0;for(let _t=0;_t<u;_t++){let X=A[_t].g;const wt=A[_t].map;if(X-=R,0>X)R=Math.max(0,A[_t].g-100),Z=!1;else try{ah(wt,N,"req"+X+"_")}catch{f&&f(wt)}}if(Z){f=N.join("&");break t}}}return i=i.i.splice(0,u),c.D=i,f}function ma(i){if(!i.g&&!i.u){i.Y=1;var c=i.Fa;zt||Re(),Ht||(zt(),Ht=!0),ie.add(c,i),i.v=0}}function Hs(i){return i.g||i.u||3<=i.v?!1:(i.Y++,i.u=wn(v(i.Fa,i),_a(i,i.v)),i.v++,!0)}n.Fa=function(){if(this.u=null,pa(this),this.ba&&!(this.M||this.g==null||0>=this.R)){var i=2*this.R;this.j.info("BP detection timer enabled: "+i),this.A=wn(v(this.ab,this),i)}},n.ab=function(){this.A&&(this.A=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.M=!0,Pt(10),vr(this),pa(this))};function Gs(i){i.A!=null&&(l.clearTimeout(i.A),i.A=null)}function pa(i){i.g=new ce(i,i.j,"rpc",i.Y),i.m===null&&(i.g.H=i.o),i.g.O=0;var c=Zt(i.qa);tt(c,"RID","rpc"),tt(c,"SID",i.K),tt(c,"AID",i.T),tt(c,"CI",i.F?"0":"1"),!i.F&&i.ja&&tt(c,"TO",i.ja),tt(c,"TYPE","xmlhttp"),Dn(i,c),i.m&&i.o&&qs(c,i.m,i.o),i.L&&(i.g.I=i.L);var u=i.g;i=i.ia,u.L=1,u.v=gr(Zt(c)),u.m=null,u.P=!0,Bo(u,i)}n.Za=function(){this.C!=null&&(this.C=null,vr(this),Hs(this),Pt(19))};function wr(i){i.C!=null&&(l.clearTimeout(i.C),i.C=null)}function ga(i,c){var u=null;if(i.g==c){wr(i),Gs(i),i.g=null;var f=2}else if(Us(i.h,c))u=c.D,Ko(i.h,c),f=1;else return;if(i.G!=0){if(c.o)if(f==1){u=c.m?c.m.length:0,c=Date.now()-c.F;var A=i.B;f=ur(),St(f,new Fo(f,u)),Tr(i)}else ma(i);else if(A=c.s,A==3||A==0&&0<c.X||!(f==1&&hh(i,c)||f==2&&Hs(i)))switch(u&&0<u.length&&(c=i.h,c.i=c.i.concat(u)),A){case 1:Ve(i,5);break;case 4:Ve(i,10);break;case 3:Ve(i,6);break;default:Ve(i,2)}}}function _a(i,c){let u=i.Ta+Math.floor(Math.random()*i.cb);return i.isActive()||(u*=2),u*c}function Ve(i,c){if(i.j.info("Error code "+c),c==2){var u=v(i.fb,i),f=i.Xa;const A=!f;f=new Pe(f||"//www.google.com/images/cleardot.gif"),l.location&&l.location.protocol=="http"||mr(f,"https"),gr(f),A?sh(f.toString(),u):ih(f.toString(),u)}else Pt(2);i.G=0,i.l&&i.l.sa(c),ya(i),ha(i)}n.fb=function(i){i?(this.j.info("Successfully pinged google.com"),Pt(2)):(this.j.info("Failed to ping google.com"),Pt(1))};function ya(i){if(i.G=0,i.ka=[],i.l){const c=Qo(i.h);(c.length!=0||i.i.length!=0)&&(P(i.ka,c),P(i.ka,i.i),i.h.i.length=0,k(i.i),i.i.length=0),i.l.ra()}}function Ea(i,c,u){var f=u instanceof Pe?Zt(u):new Pe(u);if(f.g!="")c&&(f.g=c+"."+f.g),pr(f,f.s);else{var A=l.location;f=A.protocol,c=c?c+"."+A.hostname:A.hostname,A=+A.port;var R=new Pe(null);f&&mr(R,f),c&&(R.g=c),A&&pr(R,A),u&&(R.l=u),f=R}return u=i.D,c=i.ya,u&&c&&tt(f,u,c),tt(f,"VER",i.la),Dn(i,f),f}function va(i,c,u){if(c&&!i.J)throw Error("Can't create secondary domain capable XhrIo object.");return c=i.Ca&&!i.pa?new ot(new _r({eb:u})):new ot(i.pa),c.Ha(i.J),c}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function Ta(){}n=Ta.prototype,n.ua=function(){},n.ta=function(){},n.sa=function(){},n.ra=function(){},n.isActive=function(){return!0},n.Na=function(){};function Ir(){}Ir.prototype.g=function(i,c){return new Ot(i,c)};function Ot(i,c){Tt.call(this),this.g=new ua(c),this.l=i,this.h=c&&c.messageUrlParams||null,i=c&&c.messageHeaders||null,c&&c.clientProtocolHeaderRequired&&(i?i["X-Client-Protocol"]="webchannel":i={"X-Client-Protocol":"webchannel"}),this.g.o=i,i=c&&c.initMessageHeaders||null,c&&c.messageContentType&&(i?i["X-WebChannel-Content-Type"]=c.messageContentType:i={"X-WebChannel-Content-Type":c.messageContentType}),c&&c.va&&(i?i["X-WebChannel-Client-Profile"]=c.va:i={"X-WebChannel-Client-Profile":c.va}),this.g.S=i,(i=c&&c.Sb)&&!$(i)&&(this.g.m=i),this.v=c&&c.supportsCrossDomainXhr||!1,this.u=c&&c.sendRawJson||!1,(c=c&&c.httpSessionIdParam)&&!$(c)&&(this.g.D=c,i=this.h,i!==null&&c in i&&(i=this.h,c in i&&delete i[c])),this.j=new ze(this)}V(Ot,Tt),Ot.prototype.m=function(){this.g.l=this.j,this.v&&(this.g.J=!0),this.g.connect(this.l,this.h||void 0)},Ot.prototype.close=function(){zs(this.g)},Ot.prototype.o=function(i){var c=this.g;if(typeof i=="string"){var u={};u.__data__=i,i=u}else this.u&&(u={},u.__data__=Ns(i),i=u);c.i.push(new Ku(c.Ya++,i)),c.G==3&&Tr(c)},Ot.prototype.N=function(){this.g.l=null,delete this.j,zs(this.g),delete this.g,Ot.aa.N.call(this)};function wa(i){ks.call(this),i.__headers__&&(this.headers=i.__headers__,this.statusCode=i.__status__,delete i.__headers__,delete i.__status__);var c=i.__sm__;if(c){t:{for(const u in c){i=u;break t}i=void 0}(this.i=i)&&(i=this.i,c=c!==null&&i in c?c[i]:void 0),this.data=c}else this.data=i}V(wa,ks);function Ia(){Os.call(this),this.status=1}V(Ia,Os);function ze(i){this.g=i}V(ze,Ta),ze.prototype.ua=function(){St(this.g,"a")},ze.prototype.ta=function(i){St(this.g,new wa(i))},ze.prototype.sa=function(i){St(this.g,new Ia)},ze.prototype.ra=function(){St(this.g,"b")},Ir.prototype.createWebChannel=Ir.prototype.g,Ot.prototype.send=Ot.prototype.o,Ot.prototype.open=Ot.prototype.m,Ot.prototype.close=Ot.prototype.close,ml=function(){return new Ir},fl=function(){return ur()},dl=be,di={mb:0,pb:1,qb:2,Jb:3,Ob:4,Lb:5,Mb:6,Kb:7,Ib:8,Nb:9,PROXY:10,NOPROXY:11,Gb:12,Cb:13,Db:14,Bb:15,Eb:16,Fb:17,ib:18,hb:19,jb:20},hr.NO_ERROR=0,hr.TIMEOUT=8,hr.HTTP_ERROR=6,Dr=hr,$o.COMPLETE="complete",hl=$o,ko.EventType=vn,vn.OPEN="a",vn.CLOSE="b",vn.ERROR="c",vn.MESSAGE="d",Tt.prototype.listen=Tt.prototype.K,Nn=ko,ot.prototype.listenOnce=ot.prototype.L,ot.prototype.getLastError=ot.prototype.Ka,ot.prototype.getLastErrorCode=ot.prototype.Ba,ot.prototype.getStatus=ot.prototype.Z,ot.prototype.getResponseJson=ot.prototype.Oa,ot.prototype.getResponseText=ot.prototype.oa,ot.prototype.send=ot.prototype.ea,ot.prototype.setWithCredentials=ot.prototype.Ha,ul=ot}).apply(typeof Cr<"u"?Cr:typeof self<"u"?self:typeof window<"u"?window:{});const za="@firebase/firestore",Ha="4.9.1";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ct{constructor(t){this.uid=t}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(t){return t.uid===this.uid}}Ct.UNAUTHENTICATED=new Ct(null),Ct.GOOGLE_CREDENTIALS=new Ct("google-credentials-uid"),Ct.FIRST_PARTY=new Ct("first-party-uid"),Ct.MOCK_USER=new Ct("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let dn="12.2.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ke=new rl("@firebase/firestore");function Ke(){return ke.logLevel}function O(n,...t){if(ke.logLevel<=K.DEBUG){const e=t.map(Li);ke.debug(`Firestore (${dn}): ${n}`,...e)}}function ne(n,...t){if(ke.logLevel<=K.ERROR){const e=t.map(Li);ke.error(`Firestore (${dn}): ${n}`,...e)}}function rn(n,...t){if(ke.logLevel<=K.WARN){const e=t.map(Li);ke.warn(`Firestore (${dn}): ${n}`,...e)}}function Li(n){if(typeof n=="string")return n;try{/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return(function(e){return JSON.stringify(e)})(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function F(n,t,e){let r="Unexpected state";typeof t=="string"?r=t:e=t,pl(n,r,e)}function pl(n,t,e){let r=`FIRESTORE (${dn}) INTERNAL ASSERTION FAILED: ${t} (ID: ${n.toString(16)})`;if(e!==void 0)try{r+=" CONTEXT: "+JSON.stringify(e)}catch{r+=" CONTEXT: "+e}throw ne(r),new Error(r)}function Q(n,t,e,r){let s="Unexpected state";typeof e=="string"?s=e:r=e,n||pl(t,s,r)}function B(n,t){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const b={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class x extends hn{constructor(t,e){super(t,e),this.code=t,this.message=e,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wt{constructor(){this.promise=new Promise(((t,e)=>{this.resolve=t,this.reject=e}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gl{constructor(t,e){this.user=e,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${t}`)}}class Im{getToken(){return Promise.resolve(null)}invalidateToken(){}start(t,e){t.enqueueRetryable((()=>e(Ct.UNAUTHENTICATED)))}shutdown(){}}class Am{constructor(t){this.token=t,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(t,e){this.changeListener=e,t.enqueueRetryable((()=>e(this.token.user)))}shutdown(){this.changeListener=null}}class Cm{constructor(t){this.t=t,this.currentUser=Ct.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(t,e){Q(this.o===void 0,42304);let r=this.i;const s=h=>this.i!==r?(r=this.i,e(h)):Promise.resolve();let o=new Wt;this.o=()=>{this.i++,this.currentUser=this.u(),o.resolve(),o=new Wt,t.enqueueRetryable((()=>s(this.currentUser)))};const a=()=>{const h=o;t.enqueueRetryable((async()=>{await h.promise,await s(this.currentUser)}))},l=h=>{O("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=h,this.o&&(this.auth.addAuthTokenListener(this.o),a())};this.t.onInit((h=>l(h))),setTimeout((()=>{if(!this.auth){const h=this.t.getImmediate({optional:!0});h?l(h):(O("FirebaseAuthCredentialsProvider","Auth not yet detected"),o.resolve(),o=new Wt)}}),0),a()}getToken(){const t=this.i,e=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(e).then((r=>this.i!==t?(O("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(Q(typeof r.accessToken=="string",31837,{l:r}),new gl(r.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const t=this.auth&&this.auth.getUid();return Q(t===null||typeof t=="string",2055,{h:t}),new Ct(t)}}class Rm{constructor(t,e,r){this.P=t,this.T=e,this.I=r,this.type="FirstParty",this.user=Ct.FIRST_PARTY,this.A=new Map}R(){return this.I?this.I():null}get headers(){this.A.set("X-Goog-AuthUser",this.P);const t=this.R();return t&&this.A.set("Authorization",t),this.T&&this.A.set("X-Goog-Iam-Authorization-Token",this.T),this.A}}class bm{constructor(t,e,r){this.P=t,this.T=e,this.I=r}getToken(){return Promise.resolve(new Rm(this.P,this.T,this.I))}start(t,e){t.enqueueRetryable((()=>e(Ct.FIRST_PARTY)))}shutdown(){}invalidateToken(){}}class Ga{constructor(t){this.value=t,this.type="AppCheck",this.headers=new Map,t&&t.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class Sm{constructor(t,e){this.V=e,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,cm(t)&&t.settings.appCheckToken&&(this.p=t.settings.appCheckToken)}start(t,e){Q(this.o===void 0,3512);const r=o=>{o.error!=null&&O("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${o.error.message}`);const a=o.token!==this.m;return this.m=o.token,O("FirebaseAppCheckTokenProvider",`Received ${a?"new":"existing"} token.`),a?e(o.token):Promise.resolve()};this.o=o=>{t.enqueueRetryable((()=>r(o)))};const s=o=>{O("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=o,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit((o=>s(o))),setTimeout((()=>{if(!this.appCheck){const o=this.V.getImmediate({optional:!0});o?s(o):O("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){if(this.p)return Promise.resolve(new Ga(this.p));const t=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(t).then((e=>e?(Q(typeof e.token=="string",44558,{tokenResult:e}),this.m=e.token,new Ga(e.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pm(n){const t=typeof self<"u"&&(self.crypto||self.msCrypto),e=new Uint8Array(n);if(t&&typeof t.getRandomValues=="function")t.getRandomValues(e);else for(let r=0;r<n;r++)e[r]=Math.floor(256*Math.random());return e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fi{static newId(){const t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",e=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const s=Pm(40);for(let o=0;o<s.length;++o)r.length<20&&s[o]<e&&(r+=t.charAt(s[o]%62))}return r}}function H(n,t){return n<t?-1:n>t?1:0}function fi(n,t){const e=Math.min(n.length,t.length);for(let r=0;r<e;r++){const s=n.charAt(r),o=t.charAt(r);if(s!==o)return ni(s)===ni(o)?H(s,o):ni(s)?1:-1}return H(n.length,t.length)}const Vm=55296,Dm=57343;function ni(n){const t=n.charCodeAt(0);return t>=Vm&&t<=Dm}function sn(n,t,e){return n.length===t.length&&n.every(((r,s)=>e(r,t[s])))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mi="__name__";class Gt{constructor(t,e,r){e===void 0?e=0:e>t.length&&F(637,{offset:e,range:t.length}),r===void 0?r=t.length-e:r>t.length-e&&F(1746,{length:r,range:t.length-e}),this.segments=t,this.offset=e,this.len=r}get length(){return this.len}isEqual(t){return Gt.comparator(this,t)===0}child(t){const e=this.segments.slice(this.offset,this.limit());return t instanceof Gt?t.forEach((r=>{e.push(r)})):e.push(t),this.construct(e)}limit(){return this.offset+this.length}popFirst(t){return t=t===void 0?1:t,this.construct(this.segments,this.offset+t,this.length-t)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(t){return this.segments[this.offset+t]}isEmpty(){return this.length===0}isPrefixOf(t){if(t.length<this.length)return!1;for(let e=0;e<this.length;e++)if(this.get(e)!==t.get(e))return!1;return!0}isImmediateParentOf(t){if(this.length+1!==t.length)return!1;for(let e=0;e<this.length;e++)if(this.get(e)!==t.get(e))return!1;return!0}forEach(t){for(let e=this.offset,r=this.limit();e<r;e++)t(this.segments[e])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(t,e){const r=Math.min(t.length,e.length);for(let s=0;s<r;s++){const o=Gt.compareSegments(t.get(s),e.get(s));if(o!==0)return o}return H(t.length,e.length)}static compareSegments(t,e){const r=Gt.isNumericId(t),s=Gt.isNumericId(e);return r&&!s?-1:!r&&s?1:r&&s?Gt.extractNumericId(t).compare(Gt.extractNumericId(e)):fi(t,e)}static isNumericId(t){return t.startsWith("__id")&&t.endsWith("__")}static extractNumericId(t){return pe.fromString(t.substring(4,t.length-2))}}class J extends Gt{construct(t,e,r){return new J(t,e,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...t){const e=[];for(const r of t){if(r.indexOf("//")>=0)throw new x(b.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);e.push(...r.split("/").filter((s=>s.length>0)))}return new J(e)}static emptyPath(){return new J([])}}const Nm=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class Et extends Gt{construct(t,e,r){return new Et(t,e,r)}static isValidIdentifier(t){return Nm.test(t)}canonicalString(){return this.toArray().map((t=>(t=t.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),Et.isValidIdentifier(t)||(t="`"+t+"`"),t))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===mi}static keyField(){return new Et([mi])}static fromServerFormat(t){const e=[];let r="",s=0;const o=()=>{if(r.length===0)throw new x(b.INVALID_ARGUMENT,`Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);e.push(r),r=""};let a=!1;for(;s<t.length;){const l=t[s];if(l==="\\"){if(s+1===t.length)throw new x(b.INVALID_ARGUMENT,"Path has trailing escape character: "+t);const h=t[s+1];if(h!=="\\"&&h!=="."&&h!=="`")throw new x(b.INVALID_ARGUMENT,"Path has invalid escape sequence: "+t);r+=h,s+=2}else l==="`"?(a=!a,s++):l!=="."||a?(r+=l,s++):(o(),s++)}if(o(),a)throw new x(b.INVALID_ARGUMENT,"Unterminated ` in path: "+t);return new Et(e)}static emptyPath(){return new Et([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class L{constructor(t){this.path=t}static fromPath(t){return new L(J.fromString(t))}static fromName(t){return new L(J.fromString(t).popFirst(5))}static empty(){return new L(J.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(t){return this.path.length>=2&&this.path.get(this.path.length-2)===t}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(t){return t!==null&&J.comparator(this.path,t.path)===0}toString(){return this.path.toString()}static comparator(t,e){return J.comparator(t.path,e.path)}static isDocumentKey(t){return t.length%2==0}static fromSegments(t){return new L(new J(t.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _l(n,t,e){if(!e)throw new x(b.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${t}.`)}function xm(n,t,e,r){if(t===!0&&r===!0)throw new x(b.INVALID_ARGUMENT,`${n} and ${e} cannot be used together.`)}function Wa(n){if(!L.isDocumentKey(n))throw new x(b.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function Ka(n){if(L.isDocumentKey(n))throw new x(b.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function yl(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function is(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const t=(function(r){return r.constructor?r.constructor.name:null})(n);return t?`a custom ${t} object`:"an object"}}return typeof n=="function"?"a function":F(12329,{type:typeof n})}function Rt(n,t){if("_delegate"in n&&(n=n._delegate),!(n instanceof t)){if(t.name===n.constructor.name)throw new x(b.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const e=is(n);throw new x(b.INVALID_ARGUMENT,`Expected type '${t.name}', but it was: ${e}`)}}return n}function km(n,t){if(t<=0)throw new x(b.INVALID_ARGUMENT,`Function ${n}() requires a positive number, but it was: ${t}.`)}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dt(n,t){const e={typeString:n};return t&&(e.value=t),e}function Jn(n,t){if(!yl(n))throw new x(b.INVALID_ARGUMENT,"JSON must be an object");let e;for(const r in t)if(t[r]){const s=t[r].typeString,o="value"in t[r]?{value:t[r].value}:void 0;if(!(r in n)){e=`JSON missing required field: '${r}'`;break}const a=n[r];if(s&&typeof a!==s){e=`JSON field '${r}' must be a ${s}.`;break}if(o!==void 0&&a!==o.value){e=`Expected '${r}' field to equal '${o.value}'`;break}}if(e)throw new x(b.INVALID_ARGUMENT,e);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qa=-62135596800,Xa=1e6;class et{static now(){return et.fromMillis(Date.now())}static fromDate(t){return et.fromMillis(t.getTime())}static fromMillis(t){const e=Math.floor(t/1e3),r=Math.floor((t-1e3*e)*Xa);return new et(e,r)}constructor(t,e){if(this.seconds=t,this.nanoseconds=e,e<0)throw new x(b.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+e);if(e>=1e9)throw new x(b.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+e);if(t<Qa)throw new x(b.INVALID_ARGUMENT,"Timestamp seconds out of range: "+t);if(t>=253402300800)throw new x(b.INVALID_ARGUMENT,"Timestamp seconds out of range: "+t)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/Xa}_compareTo(t){return this.seconds===t.seconds?H(this.nanoseconds,t.nanoseconds):H(this.seconds,t.seconds)}isEqual(t){return t.seconds===this.seconds&&t.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:et._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(t){if(Jn(t,et._jsonSchema))return new et(t.seconds,t.nanoseconds)}valueOf(){const t=this.seconds-Qa;return String(t).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}et._jsonSchemaVersion="firestore/timestamp/1.0",et._jsonSchema={type:dt("string",et._jsonSchemaVersion),seconds:dt("number"),nanoseconds:dt("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class j{static fromTimestamp(t){return new j(t)}static min(){return new j(new et(0,0))}static max(){return new j(new et(253402300799,999999999))}constructor(t){this.timestamp=t}compareTo(t){return this.timestamp._compareTo(t.timestamp)}isEqual(t){return this.timestamp.isEqual(t.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qn=-1;function Om(n,t){const e=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,s=j.fromTimestamp(r===1e9?new et(e+1,0):new et(e,r));return new ye(s,L.empty(),t)}function Mm(n){return new ye(n.readTime,n.key,qn)}class ye{constructor(t,e,r){this.readTime=t,this.documentKey=e,this.largestBatchId=r}static min(){return new ye(j.min(),L.empty(),qn)}static max(){return new ye(j.max(),L.empty(),qn)}}function Lm(n,t){let e=n.readTime.compareTo(t.readTime);return e!==0?e:(e=L.comparator(n.documentKey,t.documentKey),e!==0?e:H(n.largestBatchId,t.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fm="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class $m{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(t){this.onCommittedListeners.push(t)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((t=>t()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fn(n){if(n.code!==b.FAILED_PRECONDITION||n.message!==Fm)throw n;O("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class S{constructor(t){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,t((e=>{this.isDone=!0,this.result=e,this.nextCallback&&this.nextCallback(e)}),(e=>{this.isDone=!0,this.error=e,this.catchCallback&&this.catchCallback(e)}))}catch(t){return this.next(void 0,t)}next(t,e){return this.callbackAttached&&F(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(e,this.error):this.wrapSuccess(t,this.result):new S(((r,s)=>{this.nextCallback=o=>{this.wrapSuccess(t,o).next(r,s)},this.catchCallback=o=>{this.wrapFailure(e,o).next(r,s)}}))}toPromise(){return new Promise(((t,e)=>{this.next(t,e)}))}wrapUserFunction(t){try{const e=t();return e instanceof S?e:S.resolve(e)}catch(e){return S.reject(e)}}wrapSuccess(t,e){return t?this.wrapUserFunction((()=>t(e))):S.resolve(e)}wrapFailure(t,e){return t?this.wrapUserFunction((()=>t(e))):S.reject(e)}static resolve(t){return new S(((e,r)=>{e(t)}))}static reject(t){return new S(((e,r)=>{r(t)}))}static waitFor(t){return new S(((e,r)=>{let s=0,o=0,a=!1;t.forEach((l=>{++s,l.next((()=>{++o,a&&o===s&&e()}),(h=>r(h)))})),a=!0,o===s&&e()}))}static or(t){let e=S.resolve(!1);for(const r of t)e=e.next((s=>s?S.resolve(s):r()));return e}static forEach(t,e){const r=[];return t.forEach(((s,o)=>{r.push(e.call(this,s,o))})),this.waitFor(r)}static mapArray(t,e){return new S(((r,s)=>{const o=t.length,a=new Array(o);let l=0;for(let h=0;h<o;h++){const d=h;e(t[d]).next((m=>{a[d]=m,++l,l===o&&r(a)}),(m=>s(m)))}}))}static doWhile(t,e){return new S(((r,s)=>{const o=()=>{t()===!0?e().next((()=>{o()}),s):r()};o()}))}}function jm(n){const t=n.match(/Android ([\d.]+)/i),e=t?t[1].split(".").slice(0,2).join("."):"-1";return Number(e)}function mn(n){return n.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class os{constructor(t,e){this.previousValue=t,e&&(e.sequenceNumberHandler=r=>this.ae(r),this.ue=r=>e.writeSequenceNumber(r))}ae(t){return this.previousValue=Math.max(t,this.previousValue),this.previousValue}next(){const t=++this.previousValue;return this.ue&&this.ue(t),t}}os.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $i=-1;function Zn(n){return n==null}function Ur(n){return n===0&&1/n==-1/0}function Um(n){return typeof n=="number"&&Number.isInteger(n)&&!Ur(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const El="";function Bm(n){let t="";for(let e=0;e<n.length;e++)t.length>0&&(t=Ya(t)),t=qm(n.get(e),t);return Ya(t)}function qm(n,t){let e=t;const r=n.length;for(let s=0;s<r;s++){const o=n.charAt(s);switch(o){case"\0":e+="";break;case El:e+="";break;default:e+=o}}return e}function Ya(n){return n+El+""}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ja(n){let t=0;for(const e in n)Object.prototype.hasOwnProperty.call(n,e)&&t++;return t}function Ae(n,t){for(const e in n)Object.prototype.hasOwnProperty.call(n,e)&&t(e,n[e])}function vl(n){for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class it{constructor(t,e){this.comparator=t,this.root=e||yt.EMPTY}insert(t,e){return new it(this.comparator,this.root.insert(t,e,this.comparator).copy(null,null,yt.BLACK,null,null))}remove(t){return new it(this.comparator,this.root.remove(t,this.comparator).copy(null,null,yt.BLACK,null,null))}get(t){let e=this.root;for(;!e.isEmpty();){const r=this.comparator(t,e.key);if(r===0)return e.value;r<0?e=e.left:r>0&&(e=e.right)}return null}indexOf(t){let e=0,r=this.root;for(;!r.isEmpty();){const s=this.comparator(t,r.key);if(s===0)return e+r.left.size;s<0?r=r.left:(e+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(t){return this.root.inorderTraversal(t)}forEach(t){this.inorderTraversal(((e,r)=>(t(e,r),!1)))}toString(){const t=[];return this.inorderTraversal(((e,r)=>(t.push(`${e}:${r}`),!1))),`{${t.join(", ")}}`}reverseTraversal(t){return this.root.reverseTraversal(t)}getIterator(){return new Rr(this.root,null,this.comparator,!1)}getIteratorFrom(t){return new Rr(this.root,t,this.comparator,!1)}getReverseIterator(){return new Rr(this.root,null,this.comparator,!0)}getReverseIteratorFrom(t){return new Rr(this.root,t,this.comparator,!0)}}class Rr{constructor(t,e,r,s){this.isReverse=s,this.nodeStack=[];let o=1;for(;!t.isEmpty();)if(o=e?r(t.key,e):1,e&&s&&(o*=-1),o<0)t=this.isReverse?t.left:t.right;else{if(o===0){this.nodeStack.push(t);break}this.nodeStack.push(t),t=this.isReverse?t.right:t.left}}getNext(){let t=this.nodeStack.pop();const e={key:t.key,value:t.value};if(this.isReverse)for(t=t.left;!t.isEmpty();)this.nodeStack.push(t),t=t.right;else for(t=t.right;!t.isEmpty();)this.nodeStack.push(t),t=t.left;return e}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const t=this.nodeStack[this.nodeStack.length-1];return{key:t.key,value:t.value}}}class yt{constructor(t,e,r,s,o){this.key=t,this.value=e,this.color=r??yt.RED,this.left=s??yt.EMPTY,this.right=o??yt.EMPTY,this.size=this.left.size+1+this.right.size}copy(t,e,r,s,o){return new yt(t??this.key,e??this.value,r??this.color,s??this.left,o??this.right)}isEmpty(){return!1}inorderTraversal(t){return this.left.inorderTraversal(t)||t(this.key,this.value)||this.right.inorderTraversal(t)}reverseTraversal(t){return this.right.reverseTraversal(t)||t(this.key,this.value)||this.left.reverseTraversal(t)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(t,e,r){let s=this;const o=r(t,s.key);return s=o<0?s.copy(null,null,null,s.left.insert(t,e,r),null):o===0?s.copy(null,e,null,null,null):s.copy(null,null,null,null,s.right.insert(t,e,r)),s.fixUp()}removeMin(){if(this.left.isEmpty())return yt.EMPTY;let t=this;return t.left.isRed()||t.left.left.isRed()||(t=t.moveRedLeft()),t=t.copy(null,null,null,t.left.removeMin(),null),t.fixUp()}remove(t,e){let r,s=this;if(e(t,s.key)<0)s.left.isEmpty()||s.left.isRed()||s.left.left.isRed()||(s=s.moveRedLeft()),s=s.copy(null,null,null,s.left.remove(t,e),null);else{if(s.left.isRed()&&(s=s.rotateRight()),s.right.isEmpty()||s.right.isRed()||s.right.left.isRed()||(s=s.moveRedRight()),e(t,s.key)===0){if(s.right.isEmpty())return yt.EMPTY;r=s.right.min(),s=s.copy(r.key,r.value,null,null,s.right.removeMin())}s=s.copy(null,null,null,null,s.right.remove(t,e))}return s.fixUp()}isRed(){return this.color}fixUp(){let t=this;return t.right.isRed()&&!t.left.isRed()&&(t=t.rotateLeft()),t.left.isRed()&&t.left.left.isRed()&&(t=t.rotateRight()),t.left.isRed()&&t.right.isRed()&&(t=t.colorFlip()),t}moveRedLeft(){let t=this.colorFlip();return t.right.left.isRed()&&(t=t.copy(null,null,null,null,t.right.rotateRight()),t=t.rotateLeft(),t=t.colorFlip()),t}moveRedRight(){let t=this.colorFlip();return t.left.left.isRed()&&(t=t.rotateRight(),t=t.colorFlip()),t}rotateLeft(){const t=this.copy(null,null,yt.RED,null,this.right.left);return this.right.copy(null,null,this.color,t,null)}rotateRight(){const t=this.copy(null,null,yt.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,t)}colorFlip(){const t=this.left.copy(null,null,!this.left.color,null,null),e=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,t,e)}checkMaxDepth(){const t=this.check();return Math.pow(2,t)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw F(43730,{key:this.key,value:this.value});if(this.right.isRed())throw F(14113,{key:this.key,value:this.value});const t=this.left.check();if(t!==this.right.check())throw F(27949);return t+(this.isRed()?0:1)}}yt.EMPTY=null,yt.RED=!0,yt.BLACK=!1;yt.EMPTY=new class{constructor(){this.size=0}get key(){throw F(57766)}get value(){throw F(16141)}get color(){throw F(16727)}get left(){throw F(29726)}get right(){throw F(36894)}copy(t,e,r,s,o){return this}insert(t,e,r){return new yt(t,e)}remove(t,e){return this}isEmpty(){return!0}inorderTraversal(t){return!1}reverseTraversal(t){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ft{constructor(t){this.comparator=t,this.data=new it(this.comparator)}has(t){return this.data.get(t)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(t){return this.data.indexOf(t)}forEach(t){this.data.inorderTraversal(((e,r)=>(t(e),!1)))}forEachInRange(t,e){const r=this.data.getIteratorFrom(t[0]);for(;r.hasNext();){const s=r.getNext();if(this.comparator(s.key,t[1])>=0)return;e(s.key)}}forEachWhile(t,e){let r;for(r=e!==void 0?this.data.getIteratorFrom(e):this.data.getIterator();r.hasNext();)if(!t(r.getNext().key))return}firstAfterOrEqual(t){const e=this.data.getIteratorFrom(t);return e.hasNext()?e.getNext().key:null}getIterator(){return new Za(this.data.getIterator())}getIteratorFrom(t){return new Za(this.data.getIteratorFrom(t))}add(t){return this.copy(this.data.remove(t).insert(t,!0))}delete(t){return this.has(t)?this.copy(this.data.remove(t)):this}isEmpty(){return this.data.isEmpty()}unionWith(t){let e=this;return e.size<t.size&&(e=t,t=this),t.forEach((r=>{e=e.add(r)})),e}isEqual(t){if(!(t instanceof ft)||this.size!==t.size)return!1;const e=this.data.getIterator(),r=t.data.getIterator();for(;e.hasNext();){const s=e.getNext().key,o=r.getNext().key;if(this.comparator(s,o)!==0)return!1}return!0}toArray(){const t=[];return this.forEach((e=>{t.push(e)})),t}toString(){const t=[];return this.forEach((e=>t.push(e))),"SortedSet("+t.toString()+")"}copy(t){const e=new ft(this.comparator);return e.data=t,e}}class Za{constructor(t){this.iter=t}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lt{constructor(t){this.fields=t,t.sort(Et.comparator)}static empty(){return new Lt([])}unionWith(t){let e=new ft(Et.comparator);for(const r of this.fields)e=e.add(r);for(const r of t)e=e.add(r);return new Lt(e.toArray())}covers(t){for(const e of this.fields)if(e.isPrefixOf(t))return!0;return!1}isEqual(t){return sn(this.fields,t.fields,((e,r)=>e.isEqual(r)))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tl extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vt{constructor(t){this.binaryString=t}static fromBase64String(t){const e=(function(s){try{return atob(s)}catch(o){throw typeof DOMException<"u"&&o instanceof DOMException?new Tl("Invalid base64 string: "+o):o}})(t);return new vt(e)}static fromUint8Array(t){const e=(function(s){let o="";for(let a=0;a<s.length;++a)o+=String.fromCharCode(s[a]);return o})(t);return new vt(e)}[Symbol.iterator](){let t=0;return{next:()=>t<this.binaryString.length?{value:this.binaryString.charCodeAt(t++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(e){return btoa(e)})(this.binaryString)}toUint8Array(){return(function(e){const r=new Uint8Array(e.length);for(let s=0;s<e.length;s++)r[s]=e.charCodeAt(s);return r})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(t){return H(this.binaryString,t.binaryString)}isEqual(t){return this.binaryString===t.binaryString}}vt.EMPTY_BYTE_STRING=new vt("");const zm=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Ee(n){if(Q(!!n,39018),typeof n=="string"){let t=0;const e=zm.exec(n);if(Q(!!e,46558,{timestamp:n}),e[1]){let s=e[1];s=(s+"000000000").substr(0,9),t=Number(s)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:t}}return{seconds:at(n.seconds),nanos:at(n.nanos)}}function at(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function ve(n){return typeof n=="string"?vt.fromBase64String(n):vt.fromUint8Array(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wl="server_timestamp",Il="__type__",Al="__previous_value__",Cl="__local_write_time__";function ji(n){return(n?.mapValue?.fields||{})[Il]?.stringValue===wl}function as(n){const t=n.mapValue.fields[Al];return ji(t)?as(t):t}function zn(n){const t=Ee(n.mapValue.fields[Cl].timestampValue);return new et(t.seconds,t.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hm{constructor(t,e,r,s,o,a,l,h,d,m){this.databaseId=t,this.appId=e,this.persistenceKey=r,this.host=s,this.ssl=o,this.forceLongPolling=a,this.autoDetectLongPolling=l,this.longPollingOptions=h,this.useFetchStreams=d,this.isUsingEmulator=m}}const Br="(default)";class Hn{constructor(t,e){this.projectId=t,this.database=e||Br}static empty(){return new Hn("","")}get isDefaultDatabase(){return this.database===Br}isEqual(t){return t instanceof Hn&&t.projectId===this.projectId&&t.database===this.database}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rl="__type__",Gm="__max__",br={mapValue:{}},bl="__vector__",qr="value";function Te(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?ji(n)?4:Km(n)?9007199254740991:Wm(n)?10:11:F(28295,{value:n})}function Yt(n,t){if(n===t)return!0;const e=Te(n);if(e!==Te(t))return!1;switch(e){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===t.booleanValue;case 4:return zn(n).isEqual(zn(t));case 3:return(function(s,o){if(typeof s.timestampValue=="string"&&typeof o.timestampValue=="string"&&s.timestampValue.length===o.timestampValue.length)return s.timestampValue===o.timestampValue;const a=Ee(s.timestampValue),l=Ee(o.timestampValue);return a.seconds===l.seconds&&a.nanos===l.nanos})(n,t);case 5:return n.stringValue===t.stringValue;case 6:return(function(s,o){return ve(s.bytesValue).isEqual(ve(o.bytesValue))})(n,t);case 7:return n.referenceValue===t.referenceValue;case 8:return(function(s,o){return at(s.geoPointValue.latitude)===at(o.geoPointValue.latitude)&&at(s.geoPointValue.longitude)===at(o.geoPointValue.longitude)})(n,t);case 2:return(function(s,o){if("integerValue"in s&&"integerValue"in o)return at(s.integerValue)===at(o.integerValue);if("doubleValue"in s&&"doubleValue"in o){const a=at(s.doubleValue),l=at(o.doubleValue);return a===l?Ur(a)===Ur(l):isNaN(a)&&isNaN(l)}return!1})(n,t);case 9:return sn(n.arrayValue.values||[],t.arrayValue.values||[],Yt);case 10:case 11:return(function(s,o){const a=s.mapValue.fields||{},l=o.mapValue.fields||{};if(Ja(a)!==Ja(l))return!1;for(const h in a)if(a.hasOwnProperty(h)&&(l[h]===void 0||!Yt(a[h],l[h])))return!1;return!0})(n,t);default:return F(52216,{left:n})}}function Gn(n,t){return(n.values||[]).find((e=>Yt(e,t)))!==void 0}function on(n,t){if(n===t)return 0;const e=Te(n),r=Te(t);if(e!==r)return H(e,r);switch(e){case 0:case 9007199254740991:return 0;case 1:return H(n.booleanValue,t.booleanValue);case 2:return(function(o,a){const l=at(o.integerValue||o.doubleValue),h=at(a.integerValue||a.doubleValue);return l<h?-1:l>h?1:l===h?0:isNaN(l)?isNaN(h)?0:-1:1})(n,t);case 3:return tc(n.timestampValue,t.timestampValue);case 4:return tc(zn(n),zn(t));case 5:return fi(n.stringValue,t.stringValue);case 6:return(function(o,a){const l=ve(o),h=ve(a);return l.compareTo(h)})(n.bytesValue,t.bytesValue);case 7:return(function(o,a){const l=o.split("/"),h=a.split("/");for(let d=0;d<l.length&&d<h.length;d++){const m=H(l[d],h[d]);if(m!==0)return m}return H(l.length,h.length)})(n.referenceValue,t.referenceValue);case 8:return(function(o,a){const l=H(at(o.latitude),at(a.latitude));return l!==0?l:H(at(o.longitude),at(a.longitude))})(n.geoPointValue,t.geoPointValue);case 9:return ec(n.arrayValue,t.arrayValue);case 10:return(function(o,a){const l=o.fields||{},h=a.fields||{},d=l[qr]?.arrayValue,m=h[qr]?.arrayValue,_=H(d?.values?.length||0,m?.values?.length||0);return _!==0?_:ec(d,m)})(n.mapValue,t.mapValue);case 11:return(function(o,a){if(o===br.mapValue&&a===br.mapValue)return 0;if(o===br.mapValue)return 1;if(a===br.mapValue)return-1;const l=o.fields||{},h=Object.keys(l),d=a.fields||{},m=Object.keys(d);h.sort(),m.sort();for(let _=0;_<h.length&&_<m.length;++_){const v=fi(h[_],m[_]);if(v!==0)return v;const C=on(l[h[_]],d[m[_]]);if(C!==0)return C}return H(h.length,m.length)})(n.mapValue,t.mapValue);default:throw F(23264,{he:e})}}function tc(n,t){if(typeof n=="string"&&typeof t=="string"&&n.length===t.length)return H(n,t);const e=Ee(n),r=Ee(t),s=H(e.seconds,r.seconds);return s!==0?s:H(e.nanos,r.nanos)}function ec(n,t){const e=n.values||[],r=t.values||[];for(let s=0;s<e.length&&s<r.length;++s){const o=on(e[s],r[s]);if(o)return o}return H(e.length,r.length)}function an(n){return pi(n)}function pi(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?(function(e){const r=Ee(e);return`time(${r.seconds},${r.nanos})`})(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?(function(e){return ve(e).toBase64()})(n.bytesValue):"referenceValue"in n?(function(e){return L.fromName(e).toString()})(n.referenceValue):"geoPointValue"in n?(function(e){return`geo(${e.latitude},${e.longitude})`})(n.geoPointValue):"arrayValue"in n?(function(e){let r="[",s=!0;for(const o of e.values||[])s?s=!1:r+=",",r+=pi(o);return r+"]"})(n.arrayValue):"mapValue"in n?(function(e){const r=Object.keys(e.fields||{}).sort();let s="{",o=!0;for(const a of r)o?o=!1:s+=",",s+=`${a}:${pi(e.fields[a])}`;return s+"}"})(n.mapValue):F(61005,{value:n})}function Nr(n){switch(Te(n)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const t=as(n);return t?16+Nr(t):16;case 5:return 2*n.stringValue.length;case 6:return ve(n.bytesValue).approximateByteSize();case 7:return n.referenceValue.length;case 9:return(function(r){return(r.values||[]).reduce(((s,o)=>s+Nr(o)),0)})(n.arrayValue);case 10:case 11:return(function(r){let s=0;return Ae(r.fields,((o,a)=>{s+=o.length+Nr(a)})),s})(n.mapValue);default:throw F(13486,{value:n})}}function nc(n,t){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${t.path.canonicalString()}`}}function gi(n){return!!n&&"integerValue"in n}function Ui(n){return!!n&&"arrayValue"in n}function rc(n){return!!n&&"nullValue"in n}function sc(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function xr(n){return!!n&&"mapValue"in n}function Wm(n){return(n?.mapValue?.fields||{})[Rl]?.stringValue===bl}function Mn(n){if(n.geoPointValue)return{geoPointValue:{...n.geoPointValue}};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:{...n.timestampValue}};if(n.mapValue){const t={mapValue:{fields:{}}};return Ae(n.mapValue.fields,((e,r)=>t.mapValue.fields[e]=Mn(r))),t}if(n.arrayValue){const t={arrayValue:{values:[]}};for(let e=0;e<(n.arrayValue.values||[]).length;++e)t.arrayValue.values[e]=Mn(n.arrayValue.values[e]);return t}return{...n}}function Km(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue===Gm}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vt{constructor(t){this.value=t}static empty(){return new Vt({mapValue:{}})}field(t){if(t.isEmpty())return this.value;{let e=this.value;for(let r=0;r<t.length-1;++r)if(e=(e.mapValue.fields||{})[t.get(r)],!xr(e))return null;return e=(e.mapValue.fields||{})[t.lastSegment()],e||null}}set(t,e){this.getFieldsMap(t.popLast())[t.lastSegment()]=Mn(e)}setAll(t){let e=Et.emptyPath(),r={},s=[];t.forEach(((a,l)=>{if(!e.isImmediateParentOf(l)){const h=this.getFieldsMap(e);this.applyChanges(h,r,s),r={},s=[],e=l.popLast()}a?r[l.lastSegment()]=Mn(a):s.push(l.lastSegment())}));const o=this.getFieldsMap(e);this.applyChanges(o,r,s)}delete(t){const e=this.field(t.popLast());xr(e)&&e.mapValue.fields&&delete e.mapValue.fields[t.lastSegment()]}isEqual(t){return Yt(this.value,t.value)}getFieldsMap(t){let e=this.value;e.mapValue.fields||(e.mapValue={fields:{}});for(let r=0;r<t.length;++r){let s=e.mapValue.fields[t.get(r)];xr(s)&&s.mapValue.fields||(s={mapValue:{fields:{}}},e.mapValue.fields[t.get(r)]=s),e=s}return e.mapValue.fields}applyChanges(t,e,r){Ae(e,((s,o)=>t[s]=o));for(const s of r)delete t[s]}clone(){return new Vt(Mn(this.value))}}function Sl(n){const t=[];return Ae(n.fields,((e,r)=>{const s=new Et([e]);if(xr(r)){const o=Sl(r.mapValue).fields;if(o.length===0)t.push(s);else for(const a of o)t.push(s.child(a))}else t.push(s)})),new Lt(t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gt{constructor(t,e,r,s,o,a,l){this.key=t,this.documentType=e,this.version=r,this.readTime=s,this.createTime=o,this.data=a,this.documentState=l}static newInvalidDocument(t){return new gt(t,0,j.min(),j.min(),j.min(),Vt.empty(),0)}static newFoundDocument(t,e,r,s){return new gt(t,1,e,j.min(),r,s,0)}static newNoDocument(t,e){return new gt(t,2,e,j.min(),j.min(),Vt.empty(),0)}static newUnknownDocument(t,e){return new gt(t,3,e,j.min(),j.min(),Vt.empty(),2)}convertToFoundDocument(t,e){return!this.createTime.isEqual(j.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=t),this.version=t,this.documentType=1,this.data=e,this.documentState=0,this}convertToNoDocument(t){return this.version=t,this.documentType=2,this.data=Vt.empty(),this.documentState=0,this}convertToUnknownDocument(t){return this.version=t,this.documentType=3,this.data=Vt.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=j.min(),this}setReadTime(t){return this.readTime=t,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(t){return t instanceof gt&&this.key.isEqual(t.key)&&this.version.isEqual(t.version)&&this.documentType===t.documentType&&this.documentState===t.documentState&&this.data.isEqual(t.data)}mutableCopy(){return new gt(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zr{constructor(t,e){this.position=t,this.inclusive=e}}function ic(n,t,e){let r=0;for(let s=0;s<n.position.length;s++){const o=t[s],a=n.position[s];if(o.field.isKeyField()?r=L.comparator(L.fromName(a.referenceValue),e.key):r=on(a,e.data.field(o.field)),o.dir==="desc"&&(r*=-1),r!==0)break}return r}function oc(n,t){if(n===null)return t===null;if(t===null||n.inclusive!==t.inclusive||n.position.length!==t.position.length)return!1;for(let e=0;e<n.position.length;e++)if(!Yt(n.position[e],t.position[e]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wn{constructor(t,e="asc"){this.field=t,this.dir=e}}function Qm(n,t){return n.dir===t.dir&&n.field.isEqual(t.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pl{}class ut extends Pl{constructor(t,e,r){super(),this.field=t,this.op=e,this.value=r}static create(t,e,r){return t.isKeyField()?e==="in"||e==="not-in"?this.createKeyFieldInFilter(t,e,r):new Ym(t,e,r):e==="array-contains"?new tp(t,r):e==="in"?new ep(t,r):e==="not-in"?new np(t,r):e==="array-contains-any"?new rp(t,r):new ut(t,e,r)}static createKeyFieldInFilter(t,e,r){return e==="in"?new Jm(t,r):new Zm(t,r)}matches(t){const e=t.data.field(this.field);return this.op==="!="?e!==null&&e.nullValue===void 0&&this.matchesComparison(on(e,this.value)):e!==null&&Te(this.value)===Te(e)&&this.matchesComparison(on(e,this.value))}matchesComparison(t){switch(this.op){case"<":return t<0;case"<=":return t<=0;case"==":return t===0;case"!=":return t!==0;case">":return t>0;case">=":return t>=0;default:return F(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class Bt extends Pl{constructor(t,e){super(),this.filters=t,this.op=e,this.Pe=null}static create(t,e){return new Bt(t,e)}matches(t){return Vl(this)?this.filters.find((e=>!e.matches(t)))===void 0:this.filters.find((e=>e.matches(t)))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce(((t,e)=>t.concat(e.getFlattenedFilters())),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function Vl(n){return n.op==="and"}function Dl(n){return Xm(n)&&Vl(n)}function Xm(n){for(const t of n.filters)if(t instanceof Bt)return!1;return!0}function _i(n){if(n instanceof ut)return n.field.canonicalString()+n.op.toString()+an(n.value);if(Dl(n))return n.filters.map((t=>_i(t))).join(",");{const t=n.filters.map((e=>_i(e))).join(",");return`${n.op}(${t})`}}function Nl(n,t){return n instanceof ut?(function(r,s){return s instanceof ut&&r.op===s.op&&r.field.isEqual(s.field)&&Yt(r.value,s.value)})(n,t):n instanceof Bt?(function(r,s){return s instanceof Bt&&r.op===s.op&&r.filters.length===s.filters.length?r.filters.reduce(((o,a,l)=>o&&Nl(a,s.filters[l])),!0):!1})(n,t):void F(19439)}function xl(n){return n instanceof ut?(function(e){return`${e.field.canonicalString()} ${e.op} ${an(e.value)}`})(n):n instanceof Bt?(function(e){return e.op.toString()+" {"+e.getFilters().map(xl).join(" ,")+"}"})(n):"Filter"}class Ym extends ut{constructor(t,e,r){super(t,e,r),this.key=L.fromName(r.referenceValue)}matches(t){const e=L.comparator(t.key,this.key);return this.matchesComparison(e)}}class Jm extends ut{constructor(t,e){super(t,"in",e),this.keys=kl("in",e)}matches(t){return this.keys.some((e=>e.isEqual(t.key)))}}class Zm extends ut{constructor(t,e){super(t,"not-in",e),this.keys=kl("not-in",e)}matches(t){return!this.keys.some((e=>e.isEqual(t.key)))}}function kl(n,t){return(t.arrayValue?.values||[]).map((e=>L.fromName(e.referenceValue)))}class tp extends ut{constructor(t,e){super(t,"array-contains",e)}matches(t){const e=t.data.field(this.field);return Ui(e)&&Gn(e.arrayValue,this.value)}}class ep extends ut{constructor(t,e){super(t,"in",e)}matches(t){const e=t.data.field(this.field);return e!==null&&Gn(this.value.arrayValue,e)}}class np extends ut{constructor(t,e){super(t,"not-in",e)}matches(t){if(Gn(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const e=t.data.field(this.field);return e!==null&&e.nullValue===void 0&&!Gn(this.value.arrayValue,e)}}class rp extends ut{constructor(t,e){super(t,"array-contains-any",e)}matches(t){const e=t.data.field(this.field);return!(!Ui(e)||!e.arrayValue.values)&&e.arrayValue.values.some((r=>Gn(this.value.arrayValue,r)))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sp{constructor(t,e=null,r=[],s=[],o=null,a=null,l=null){this.path=t,this.collectionGroup=e,this.orderBy=r,this.filters=s,this.limit=o,this.startAt=a,this.endAt=l,this.Te=null}}function ac(n,t=null,e=[],r=[],s=null,o=null,a=null){return new sp(n,t,e,r,s,o,a)}function Bi(n){const t=B(n);if(t.Te===null){let e=t.path.canonicalString();t.collectionGroup!==null&&(e+="|cg:"+t.collectionGroup),e+="|f:",e+=t.filters.map((r=>_i(r))).join(","),e+="|ob:",e+=t.orderBy.map((r=>(function(o){return o.field.canonicalString()+o.dir})(r))).join(","),Zn(t.limit)||(e+="|l:",e+=t.limit),t.startAt&&(e+="|lb:",e+=t.startAt.inclusive?"b:":"a:",e+=t.startAt.position.map((r=>an(r))).join(",")),t.endAt&&(e+="|ub:",e+=t.endAt.inclusive?"a:":"b:",e+=t.endAt.position.map((r=>an(r))).join(",")),t.Te=e}return t.Te}function qi(n,t){if(n.limit!==t.limit||n.orderBy.length!==t.orderBy.length)return!1;for(let e=0;e<n.orderBy.length;e++)if(!Qm(n.orderBy[e],t.orderBy[e]))return!1;if(n.filters.length!==t.filters.length)return!1;for(let e=0;e<n.filters.length;e++)if(!Nl(n.filters[e],t.filters[e]))return!1;return n.collectionGroup===t.collectionGroup&&!!n.path.isEqual(t.path)&&!!oc(n.startAt,t.startAt)&&oc(n.endAt,t.endAt)}function yi(n){return L.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pn{constructor(t,e=null,r=[],s=[],o=null,a="F",l=null,h=null){this.path=t,this.collectionGroup=e,this.explicitOrderBy=r,this.filters=s,this.limit=o,this.limitType=a,this.startAt=l,this.endAt=h,this.Ie=null,this.Ee=null,this.de=null,this.startAt,this.endAt}}function ip(n,t,e,r,s,o,a,l){return new pn(n,t,e,r,s,o,a,l)}function cs(n){return new pn(n)}function cc(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function Ol(n){return n.collectionGroup!==null}function Ln(n){const t=B(n);if(t.Ie===null){t.Ie=[];const e=new Set;for(const o of t.explicitOrderBy)t.Ie.push(o),e.add(o.field.canonicalString());const r=t.explicitOrderBy.length>0?t.explicitOrderBy[t.explicitOrderBy.length-1].dir:"asc";(function(a){let l=new ft(Et.comparator);return a.filters.forEach((h=>{h.getFlattenedFilters().forEach((d=>{d.isInequality()&&(l=l.add(d.field))}))})),l})(t).forEach((o=>{e.has(o.canonicalString())||o.isKeyField()||t.Ie.push(new Wn(o,r))})),e.has(Et.keyField().canonicalString())||t.Ie.push(new Wn(Et.keyField(),r))}return t.Ie}function Kt(n){const t=B(n);return t.Ee||(t.Ee=op(t,Ln(n))),t.Ee}function op(n,t){if(n.limitType==="F")return ac(n.path,n.collectionGroup,t,n.filters,n.limit,n.startAt,n.endAt);{t=t.map((s=>{const o=s.dir==="desc"?"asc":"desc";return new Wn(s.field,o)}));const e=n.endAt?new zr(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new zr(n.startAt.position,n.startAt.inclusive):null;return ac(n.path,n.collectionGroup,t,n.filters,n.limit,e,r)}}function Ei(n,t){const e=n.filters.concat([t]);return new pn(n.path,n.collectionGroup,n.explicitOrderBy.slice(),e,n.limit,n.limitType,n.startAt,n.endAt)}function Hr(n,t,e){return new pn(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),t,e,n.startAt,n.endAt)}function ls(n,t){return qi(Kt(n),Kt(t))&&n.limitType===t.limitType}function Ml(n){return`${Bi(Kt(n))}|lt:${n.limitType}`}function Qe(n){return`Query(target=${(function(e){let r=e.path.canonicalString();return e.collectionGroup!==null&&(r+=" collectionGroup="+e.collectionGroup),e.filters.length>0&&(r+=`, filters: [${e.filters.map((s=>xl(s))).join(", ")}]`),Zn(e.limit)||(r+=", limit: "+e.limit),e.orderBy.length>0&&(r+=`, orderBy: [${e.orderBy.map((s=>(function(a){return`${a.field.canonicalString()} (${a.dir})`})(s))).join(", ")}]`),e.startAt&&(r+=", startAt: ",r+=e.startAt.inclusive?"b:":"a:",r+=e.startAt.position.map((s=>an(s))).join(",")),e.endAt&&(r+=", endAt: ",r+=e.endAt.inclusive?"a:":"b:",r+=e.endAt.position.map((s=>an(s))).join(",")),`Target(${r})`})(Kt(n))}; limitType=${n.limitType})`}function us(n,t){return t.isFoundDocument()&&(function(r,s){const o=s.key.path;return r.collectionGroup!==null?s.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(o):L.isDocumentKey(r.path)?r.path.isEqual(o):r.path.isImmediateParentOf(o)})(n,t)&&(function(r,s){for(const o of Ln(r))if(!o.field.isKeyField()&&s.data.field(o.field)===null)return!1;return!0})(n,t)&&(function(r,s){for(const o of r.filters)if(!o.matches(s))return!1;return!0})(n,t)&&(function(r,s){return!(r.startAt&&!(function(a,l,h){const d=ic(a,l,h);return a.inclusive?d<=0:d<0})(r.startAt,Ln(r),s)||r.endAt&&!(function(a,l,h){const d=ic(a,l,h);return a.inclusive?d>=0:d>0})(r.endAt,Ln(r),s))})(n,t)}function ap(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function Ll(n){return(t,e)=>{let r=!1;for(const s of Ln(n)){const o=cp(s,t,e);if(o!==0)return o;r=r||s.field.isKeyField()}return 0}}function cp(n,t,e){const r=n.field.isKeyField()?L.comparator(t.key,e.key):(function(o,a,l){const h=a.data.field(o),d=l.data.field(o);return h!==null&&d!==null?on(h,d):F(42886)})(n.field,t,e);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return F(19790,{direction:n.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Le{constructor(t,e){this.mapKeyFn=t,this.equalsFn=e,this.inner={},this.innerSize=0}get(t){const e=this.mapKeyFn(t),r=this.inner[e];if(r!==void 0){for(const[s,o]of r)if(this.equalsFn(s,t))return o}}has(t){return this.get(t)!==void 0}set(t,e){const r=this.mapKeyFn(t),s=this.inner[r];if(s===void 0)return this.inner[r]=[[t,e]],void this.innerSize++;for(let o=0;o<s.length;o++)if(this.equalsFn(s[o][0],t))return void(s[o]=[t,e]);s.push([t,e]),this.innerSize++}delete(t){const e=this.mapKeyFn(t),r=this.inner[e];if(r===void 0)return!1;for(let s=0;s<r.length;s++)if(this.equalsFn(r[s][0],t))return r.length===1?delete this.inner[e]:r.splice(s,1),this.innerSize--,!0;return!1}forEach(t){Ae(this.inner,((e,r)=>{for(const[s,o]of r)t(s,o)}))}isEmpty(){return vl(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lp=new it(L.comparator);function re(){return lp}const Fl=new it(L.comparator);function xn(...n){let t=Fl;for(const e of n)t=t.insert(e.key,e);return t}function $l(n){let t=Fl;return n.forEach(((e,r)=>t=t.insert(e,r.overlayedDocument))),t}function Ne(){return Fn()}function jl(){return Fn()}function Fn(){return new Le((n=>n.toString()),((n,t)=>n.isEqual(t)))}const up=new it(L.comparator),hp=new ft(L.comparator);function G(...n){let t=hp;for(const e of n)t=t.add(e);return t}const dp=new ft(H);function fp(){return dp}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zi(n,t){if(n.useProto3Json){if(isNaN(t))return{doubleValue:"NaN"};if(t===1/0)return{doubleValue:"Infinity"};if(t===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:Ur(t)?"-0":t}}function Ul(n){return{integerValue:""+n}}function mp(n,t){return Um(t)?Ul(t):zi(n,t)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hs{constructor(){this._=void 0}}function pp(n,t,e){return n instanceof Kn?(function(s,o){const a={fields:{[Il]:{stringValue:wl},[Cl]:{timestampValue:{seconds:s.seconds,nanos:s.nanoseconds}}}};return o&&ji(o)&&(o=as(o)),o&&(a.fields[Al]=o),{mapValue:a}})(e,t):n instanceof Qn?ql(n,t):n instanceof Xn?zl(n,t):(function(s,o){const a=Bl(s,o),l=lc(a)+lc(s.Ae);return gi(a)&&gi(s.Ae)?Ul(l):zi(s.serializer,l)})(n,t)}function gp(n,t,e){return n instanceof Qn?ql(n,t):n instanceof Xn?zl(n,t):e}function Bl(n,t){return n instanceof Gr?(function(r){return gi(r)||(function(o){return!!o&&"doubleValue"in o})(r)})(t)?t:{integerValue:0}:null}class Kn extends hs{}class Qn extends hs{constructor(t){super(),this.elements=t}}function ql(n,t){const e=Hl(t);for(const r of n.elements)e.some((s=>Yt(s,r)))||e.push(r);return{arrayValue:{values:e}}}class Xn extends hs{constructor(t){super(),this.elements=t}}function zl(n,t){let e=Hl(t);for(const r of n.elements)e=e.filter((s=>!Yt(s,r)));return{arrayValue:{values:e}}}class Gr extends hs{constructor(t,e){super(),this.serializer=t,this.Ae=e}}function lc(n){return at(n.integerValue||n.doubleValue)}function Hl(n){return Ui(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _p{constructor(t,e){this.field=t,this.transform=e}}function yp(n,t){return n.field.isEqual(t.field)&&(function(r,s){return r instanceof Qn&&s instanceof Qn||r instanceof Xn&&s instanceof Xn?sn(r.elements,s.elements,Yt):r instanceof Gr&&s instanceof Gr?Yt(r.Ae,s.Ae):r instanceof Kn&&s instanceof Kn})(n.transform,t.transform)}class Ep{constructor(t,e){this.version=t,this.transformResults=e}}class ht{constructor(t,e){this.updateTime=t,this.exists=e}static none(){return new ht}static exists(t){return new ht(void 0,t)}static updateTime(t){return new ht(t)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(t){return this.exists===t.exists&&(this.updateTime?!!t.updateTime&&this.updateTime.isEqual(t.updateTime):!t.updateTime)}}function kr(n,t){return n.updateTime!==void 0?t.isFoundDocument()&&t.version.isEqual(n.updateTime):n.exists===void 0||n.exists===t.isFoundDocument()}class ds{}function Gl(n,t){if(!n.hasLocalMutations||t&&t.fields.length===0)return null;if(t===null)return n.isNoDocument()?new er(n.key,ht.none()):new tr(n.key,n.data,ht.none());{const e=n.data,r=Vt.empty();let s=new ft(Et.comparator);for(let o of t.fields)if(!s.has(o)){let a=e.field(o);a===null&&o.length>1&&(o=o.popLast(),a=e.field(o)),a===null?r.delete(o):r.set(o,a),s=s.add(o)}return new Ce(n.key,r,new Lt(s.toArray()),ht.none())}}function vp(n,t,e){n instanceof tr?(function(s,o,a){const l=s.value.clone(),h=hc(s.fieldTransforms,o,a.transformResults);l.setAll(h),o.convertToFoundDocument(a.version,l).setHasCommittedMutations()})(n,t,e):n instanceof Ce?(function(s,o,a){if(!kr(s.precondition,o))return void o.convertToUnknownDocument(a.version);const l=hc(s.fieldTransforms,o,a.transformResults),h=o.data;h.setAll(Wl(s)),h.setAll(l),o.convertToFoundDocument(a.version,h).setHasCommittedMutations()})(n,t,e):(function(s,o,a){o.convertToNoDocument(a.version).setHasCommittedMutations()})(0,t,e)}function $n(n,t,e,r){return n instanceof tr?(function(o,a,l,h){if(!kr(o.precondition,a))return l;const d=o.value.clone(),m=dc(o.fieldTransforms,h,a);return d.setAll(m),a.convertToFoundDocument(a.version,d).setHasLocalMutations(),null})(n,t,e,r):n instanceof Ce?(function(o,a,l,h){if(!kr(o.precondition,a))return l;const d=dc(o.fieldTransforms,h,a),m=a.data;return m.setAll(Wl(o)),m.setAll(d),a.convertToFoundDocument(a.version,m).setHasLocalMutations(),l===null?null:l.unionWith(o.fieldMask.fields).unionWith(o.fieldTransforms.map((_=>_.field)))})(n,t,e,r):(function(o,a,l){return kr(o.precondition,a)?(a.convertToNoDocument(a.version).setHasLocalMutations(),null):l})(n,t,e)}function Tp(n,t){let e=null;for(const r of n.fieldTransforms){const s=t.data.field(r.field),o=Bl(r.transform,s||null);o!=null&&(e===null&&(e=Vt.empty()),e.set(r.field,o))}return e||null}function uc(n,t){return n.type===t.type&&!!n.key.isEqual(t.key)&&!!n.precondition.isEqual(t.precondition)&&!!(function(r,s){return r===void 0&&s===void 0||!(!r||!s)&&sn(r,s,((o,a)=>yp(o,a)))})(n.fieldTransforms,t.fieldTransforms)&&(n.type===0?n.value.isEqual(t.value):n.type!==1||n.data.isEqual(t.data)&&n.fieldMask.isEqual(t.fieldMask))}class tr extends ds{constructor(t,e,r,s=[]){super(),this.key=t,this.value=e,this.precondition=r,this.fieldTransforms=s,this.type=0}getFieldMask(){return null}}class Ce extends ds{constructor(t,e,r,s,o=[]){super(),this.key=t,this.data=e,this.fieldMask=r,this.precondition=s,this.fieldTransforms=o,this.type=1}getFieldMask(){return this.fieldMask}}function Wl(n){const t=new Map;return n.fieldMask.fields.forEach((e=>{if(!e.isEmpty()){const r=n.data.field(e);t.set(e,r)}})),t}function hc(n,t,e){const r=new Map;Q(n.length===e.length,32656,{Re:e.length,Ve:n.length});for(let s=0;s<e.length;s++){const o=n[s],a=o.transform,l=t.data.field(o.field);r.set(o.field,gp(a,l,e[s]))}return r}function dc(n,t,e){const r=new Map;for(const s of n){const o=s.transform,a=e.data.field(s.field);r.set(s.field,pp(o,a,t))}return r}class er extends ds{constructor(t,e){super(),this.key=t,this.precondition=e,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class Kl extends ds{constructor(t,e){super(),this.key=t,this.precondition=e,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wp{constructor(t,e,r,s){this.batchId=t,this.localWriteTime=e,this.baseMutations=r,this.mutations=s}applyToRemoteDocument(t,e){const r=e.mutationResults;for(let s=0;s<this.mutations.length;s++){const o=this.mutations[s];o.key.isEqual(t.key)&&vp(o,t,r[s])}}applyToLocalView(t,e){for(const r of this.baseMutations)r.key.isEqual(t.key)&&(e=$n(r,t,e,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(t.key)&&(e=$n(r,t,e,this.localWriteTime));return e}applyToLocalDocumentSet(t,e){const r=jl();return this.mutations.forEach((s=>{const o=t.get(s.key),a=o.overlayedDocument;let l=this.applyToLocalView(a,o.mutatedFields);l=e.has(s.key)?null:l;const h=Gl(a,l);h!==null&&r.set(s.key,h),a.isValidDocument()||a.convertToNoDocument(j.min())})),r}keys(){return this.mutations.reduce(((t,e)=>t.add(e.key)),G())}isEqual(t){return this.batchId===t.batchId&&sn(this.mutations,t.mutations,((e,r)=>uc(e,r)))&&sn(this.baseMutations,t.baseMutations,((e,r)=>uc(e,r)))}}class Hi{constructor(t,e,r,s){this.batch=t,this.commitVersion=e,this.mutationResults=r,this.docVersions=s}static from(t,e,r){Q(t.mutations.length===r.length,58842,{me:t.mutations.length,fe:r.length});let s=(function(){return up})();const o=t.mutations;for(let a=0;a<o.length;a++)s=s.insert(o[a].key,r[a].version);return new Hi(t,e,r,s)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ip{constructor(t,e){this.largestBatchId=t,this.mutation=e}getKey(){return this.mutation.key}isEqual(t){return t!==null&&this.mutation===t.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ap{constructor(t,e){this.count=t,this.unchangedNames=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var lt,W;function Ql(n){switch(n){case b.OK:return F(64938);case b.CANCELLED:case b.UNKNOWN:case b.DEADLINE_EXCEEDED:case b.RESOURCE_EXHAUSTED:case b.INTERNAL:case b.UNAVAILABLE:case b.UNAUTHENTICATED:return!1;case b.INVALID_ARGUMENT:case b.NOT_FOUND:case b.ALREADY_EXISTS:case b.PERMISSION_DENIED:case b.FAILED_PRECONDITION:case b.ABORTED:case b.OUT_OF_RANGE:case b.UNIMPLEMENTED:case b.DATA_LOSS:return!0;default:return F(15467,{code:n})}}function Xl(n){if(n===void 0)return ne("GRPC error has no .code"),b.UNKNOWN;switch(n){case lt.OK:return b.OK;case lt.CANCELLED:return b.CANCELLED;case lt.UNKNOWN:return b.UNKNOWN;case lt.DEADLINE_EXCEEDED:return b.DEADLINE_EXCEEDED;case lt.RESOURCE_EXHAUSTED:return b.RESOURCE_EXHAUSTED;case lt.INTERNAL:return b.INTERNAL;case lt.UNAVAILABLE:return b.UNAVAILABLE;case lt.UNAUTHENTICATED:return b.UNAUTHENTICATED;case lt.INVALID_ARGUMENT:return b.INVALID_ARGUMENT;case lt.NOT_FOUND:return b.NOT_FOUND;case lt.ALREADY_EXISTS:return b.ALREADY_EXISTS;case lt.PERMISSION_DENIED:return b.PERMISSION_DENIED;case lt.FAILED_PRECONDITION:return b.FAILED_PRECONDITION;case lt.ABORTED:return b.ABORTED;case lt.OUT_OF_RANGE:return b.OUT_OF_RANGE;case lt.UNIMPLEMENTED:return b.UNIMPLEMENTED;case lt.DATA_LOSS:return b.DATA_LOSS;default:return F(39323,{code:n})}}(W=lt||(lt={}))[W.OK=0]="OK",W[W.CANCELLED=1]="CANCELLED",W[W.UNKNOWN=2]="UNKNOWN",W[W.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",W[W.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",W[W.NOT_FOUND=5]="NOT_FOUND",W[W.ALREADY_EXISTS=6]="ALREADY_EXISTS",W[W.PERMISSION_DENIED=7]="PERMISSION_DENIED",W[W.UNAUTHENTICATED=16]="UNAUTHENTICATED",W[W.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",W[W.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",W[W.ABORTED=10]="ABORTED",W[W.OUT_OF_RANGE=11]="OUT_OF_RANGE",W[W.UNIMPLEMENTED=12]="UNIMPLEMENTED",W[W.INTERNAL=13]="INTERNAL",W[W.UNAVAILABLE=14]="UNAVAILABLE",W[W.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Cp(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rp=new pe([4294967295,4294967295],0);function fc(n){const t=Cp().encode(n),e=new ll;return e.update(t),new Uint8Array(e.digest())}function mc(n){const t=new DataView(n.buffer),e=t.getUint32(0,!0),r=t.getUint32(4,!0),s=t.getUint32(8,!0),o=t.getUint32(12,!0);return[new pe([e,r],0),new pe([s,o],0)]}class Gi{constructor(t,e,r){if(this.bitmap=t,this.padding=e,this.hashCount=r,e<0||e>=8)throw new kn(`Invalid padding: ${e}`);if(r<0)throw new kn(`Invalid hash count: ${r}`);if(t.length>0&&this.hashCount===0)throw new kn(`Invalid hash count: ${r}`);if(t.length===0&&e!==0)throw new kn(`Invalid padding when bitmap length is 0: ${e}`);this.ge=8*t.length-e,this.pe=pe.fromNumber(this.ge)}ye(t,e,r){let s=t.add(e.multiply(pe.fromNumber(r)));return s.compare(Rp)===1&&(s=new pe([s.getBits(0),s.getBits(1)],0)),s.modulo(this.pe).toNumber()}we(t){return!!(this.bitmap[Math.floor(t/8)]&1<<t%8)}mightContain(t){if(this.ge===0)return!1;const e=fc(t),[r,s]=mc(e);for(let o=0;o<this.hashCount;o++){const a=this.ye(r,s,o);if(!this.we(a))return!1}return!0}static create(t,e,r){const s=t%8==0?0:8-t%8,o=new Uint8Array(Math.ceil(t/8)),a=new Gi(o,s,e);return r.forEach((l=>a.insert(l))),a}insert(t){if(this.ge===0)return;const e=fc(t),[r,s]=mc(e);for(let o=0;o<this.hashCount;o++){const a=this.ye(r,s,o);this.Se(a)}}Se(t){const e=Math.floor(t/8),r=t%8;this.bitmap[e]|=1<<r}}class kn extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fs{constructor(t,e,r,s,o){this.snapshotVersion=t,this.targetChanges=e,this.targetMismatches=r,this.documentUpdates=s,this.resolvedLimboDocuments=o}static createSynthesizedRemoteEventForCurrentChange(t,e,r){const s=new Map;return s.set(t,nr.createSynthesizedTargetChangeForCurrentChange(t,e,r)),new fs(j.min(),s,new it(H),re(),G())}}class nr{constructor(t,e,r,s,o){this.resumeToken=t,this.current=e,this.addedDocuments=r,this.modifiedDocuments=s,this.removedDocuments=o}static createSynthesizedTargetChangeForCurrentChange(t,e,r){return new nr(r,e,G(),G(),G())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Or{constructor(t,e,r,s){this.be=t,this.removedTargetIds=e,this.key=r,this.De=s}}class Yl{constructor(t,e){this.targetId=t,this.Ce=e}}class Jl{constructor(t,e,r=vt.EMPTY_BYTE_STRING,s=null){this.state=t,this.targetIds=e,this.resumeToken=r,this.cause=s}}class pc{constructor(){this.ve=0,this.Fe=gc(),this.Me=vt.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(t){t.approximateByteSize()>0&&(this.Oe=!0,this.Me=t)}ke(){let t=G(),e=G(),r=G();return this.Fe.forEach(((s,o)=>{switch(o){case 0:t=t.add(s);break;case 2:e=e.add(s);break;case 1:r=r.add(s);break;default:F(38017,{changeType:o})}})),new nr(this.Me,this.xe,t,e,r)}qe(){this.Oe=!1,this.Fe=gc()}Qe(t,e){this.Oe=!0,this.Fe=this.Fe.insert(t,e)}$e(t){this.Oe=!0,this.Fe=this.Fe.remove(t)}Ue(){this.ve+=1}Ke(){this.ve-=1,Q(this.ve>=0,3241,{ve:this.ve})}We(){this.Oe=!0,this.xe=!0}}class bp{constructor(t){this.Ge=t,this.ze=new Map,this.je=re(),this.Je=Sr(),this.He=Sr(),this.Ye=new it(H)}Ze(t){for(const e of t.be)t.De&&t.De.isFoundDocument()?this.Xe(e,t.De):this.et(e,t.key,t.De);for(const e of t.removedTargetIds)this.et(e,t.key,t.De)}tt(t){this.forEachTarget(t,(e=>{const r=this.nt(e);switch(t.state){case 0:this.rt(e)&&r.Le(t.resumeToken);break;case 1:r.Ke(),r.Ne||r.qe(),r.Le(t.resumeToken);break;case 2:r.Ke(),r.Ne||this.removeTarget(e);break;case 3:this.rt(e)&&(r.We(),r.Le(t.resumeToken));break;case 4:this.rt(e)&&(this.it(e),r.Le(t.resumeToken));break;default:F(56790,{state:t.state})}}))}forEachTarget(t,e){t.targetIds.length>0?t.targetIds.forEach(e):this.ze.forEach(((r,s)=>{this.rt(s)&&e(s)}))}st(t){const e=t.targetId,r=t.Ce.count,s=this.ot(e);if(s){const o=s.target;if(yi(o))if(r===0){const a=new L(o.path);this.et(e,a,gt.newNoDocument(a,j.min()))}else Q(r===1,20013,{expectedCount:r});else{const a=this._t(e);if(a!==r){const l=this.ut(t),h=l?this.ct(l,t,a):1;if(h!==0){this.it(e);const d=h===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ye=this.Ye.insert(e,d)}}}}}ut(t){const e=t.Ce.unchangedNames;if(!e||!e.bits)return null;const{bits:{bitmap:r="",padding:s=0},hashCount:o=0}=e;let a,l;try{a=ve(r).toUint8Array()}catch(h){if(h instanceof Tl)return rn("Decoding the base64 bloom filter in existence filter failed ("+h.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw h}try{l=new Gi(a,s,o)}catch(h){return rn(h instanceof kn?"BloomFilter error: ":"Applying bloom filter failed: ",h),null}return l.ge===0?null:l}ct(t,e,r){return e.Ce.count===r-this.Pt(t,e.targetId)?0:2}Pt(t,e){const r=this.Ge.getRemoteKeysForTarget(e);let s=0;return r.forEach((o=>{const a=this.Ge.ht(),l=`projects/${a.projectId}/databases/${a.database}/documents/${o.path.canonicalString()}`;t.mightContain(l)||(this.et(e,o,null),s++)})),s}Tt(t){const e=new Map;this.ze.forEach(((o,a)=>{const l=this.ot(a);if(l){if(o.current&&yi(l.target)){const h=new L(l.target.path);this.It(h).has(a)||this.Et(a,h)||this.et(a,h,gt.newNoDocument(h,t))}o.Be&&(e.set(a,o.ke()),o.qe())}}));let r=G();this.He.forEach(((o,a)=>{let l=!0;a.forEachWhile((h=>{const d=this.ot(h);return!d||d.purpose==="TargetPurposeLimboResolution"||(l=!1,!1)})),l&&(r=r.add(o))})),this.je.forEach(((o,a)=>a.setReadTime(t)));const s=new fs(t,e,this.Ye,this.je,r);return this.je=re(),this.Je=Sr(),this.He=Sr(),this.Ye=new it(H),s}Xe(t,e){if(!this.rt(t))return;const r=this.Et(t,e.key)?2:0;this.nt(t).Qe(e.key,r),this.je=this.je.insert(e.key,e),this.Je=this.Je.insert(e.key,this.It(e.key).add(t)),this.He=this.He.insert(e.key,this.dt(e.key).add(t))}et(t,e,r){if(!this.rt(t))return;const s=this.nt(t);this.Et(t,e)?s.Qe(e,1):s.$e(e),this.He=this.He.insert(e,this.dt(e).delete(t)),this.He=this.He.insert(e,this.dt(e).add(t)),r&&(this.je=this.je.insert(e,r))}removeTarget(t){this.ze.delete(t)}_t(t){const e=this.nt(t).ke();return this.Ge.getRemoteKeysForTarget(t).size+e.addedDocuments.size-e.removedDocuments.size}Ue(t){this.nt(t).Ue()}nt(t){let e=this.ze.get(t);return e||(e=new pc,this.ze.set(t,e)),e}dt(t){let e=this.He.get(t);return e||(e=new ft(H),this.He=this.He.insert(t,e)),e}It(t){let e=this.Je.get(t);return e||(e=new ft(H),this.Je=this.Je.insert(t,e)),e}rt(t){const e=this.ot(t)!==null;return e||O("WatchChangeAggregator","Detected inactive target",t),e}ot(t){const e=this.ze.get(t);return e&&e.Ne?null:this.Ge.At(t)}it(t){this.ze.set(t,new pc),this.Ge.getRemoteKeysForTarget(t).forEach((e=>{this.et(t,e,null)}))}Et(t,e){return this.Ge.getRemoteKeysForTarget(t).has(e)}}function Sr(){return new it(L.comparator)}function gc(){return new it(L.comparator)}const Sp={asc:"ASCENDING",desc:"DESCENDING"},Pp={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},Vp={and:"AND",or:"OR"};class Dp{constructor(t,e){this.databaseId=t,this.useProto3Json=e}}function vi(n,t){return n.useProto3Json||Zn(t)?t:{value:t}}function Wr(n,t){return n.useProto3Json?`${new Date(1e3*t.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+t.nanoseconds).slice(-9)}Z`:{seconds:""+t.seconds,nanos:t.nanoseconds}}function Zl(n,t){return n.useProto3Json?t.toBase64():t.toUint8Array()}function Np(n,t){return Wr(n,t.toTimestamp())}function Ft(n){return Q(!!n,49232),j.fromTimestamp((function(e){const r=Ee(e);return new et(r.seconds,r.nanos)})(n))}function Wi(n,t){return Ti(n,t).canonicalString()}function Ti(n,t){const e=(function(s){return new J(["projects",s.projectId,"databases",s.database])})(n).child("documents");return t===void 0?e:e.child(t)}function tu(n){const t=J.fromString(n);return Q(ou(t),10190,{key:t.toString()}),t}function Kr(n,t){return Wi(n.databaseId,t.path)}function jn(n,t){const e=tu(t);if(e.get(1)!==n.databaseId.projectId)throw new x(b.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+e.get(1)+" vs "+n.databaseId.projectId);if(e.get(3)!==n.databaseId.database)throw new x(b.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+e.get(3)+" vs "+n.databaseId.database);return new L(nu(e))}function eu(n,t){return Wi(n.databaseId,t)}function xp(n){const t=tu(n);return t.length===4?J.emptyPath():nu(t)}function wi(n){return new J(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function nu(n){return Q(n.length>4&&n.get(4)==="documents",29091,{key:n.toString()}),n.popFirst(5)}function _c(n,t,e){return{name:Kr(n,t),fields:e.value.mapValue.fields}}function kp(n,t){return"found"in t?(function(r,s){Q(!!s.found,43571),s.found.name,s.found.updateTime;const o=jn(r,s.found.name),a=Ft(s.found.updateTime),l=s.found.createTime?Ft(s.found.createTime):j.min(),h=new Vt({mapValue:{fields:s.found.fields}});return gt.newFoundDocument(o,a,l,h)})(n,t):"missing"in t?(function(r,s){Q(!!s.missing,3894),Q(!!s.readTime,22933);const o=jn(r,s.missing),a=Ft(s.readTime);return gt.newNoDocument(o,a)})(n,t):F(7234,{result:t})}function Op(n,t){let e;if("targetChange"in t){t.targetChange;const r=(function(d){return d==="NO_CHANGE"?0:d==="ADD"?1:d==="REMOVE"?2:d==="CURRENT"?3:d==="RESET"?4:F(39313,{state:d})})(t.targetChange.targetChangeType||"NO_CHANGE"),s=t.targetChange.targetIds||[],o=(function(d,m){return d.useProto3Json?(Q(m===void 0||typeof m=="string",58123),vt.fromBase64String(m||"")):(Q(m===void 0||m instanceof Buffer||m instanceof Uint8Array,16193),vt.fromUint8Array(m||new Uint8Array))})(n,t.targetChange.resumeToken),a=t.targetChange.cause,l=a&&(function(d){const m=d.code===void 0?b.UNKNOWN:Xl(d.code);return new x(m,d.message||"")})(a);e=new Jl(r,s,o,l||null)}else if("documentChange"in t){t.documentChange;const r=t.documentChange;r.document,r.document.name,r.document.updateTime;const s=jn(n,r.document.name),o=Ft(r.document.updateTime),a=r.document.createTime?Ft(r.document.createTime):j.min(),l=new Vt({mapValue:{fields:r.document.fields}}),h=gt.newFoundDocument(s,o,a,l),d=r.targetIds||[],m=r.removedTargetIds||[];e=new Or(d,m,h.key,h)}else if("documentDelete"in t){t.documentDelete;const r=t.documentDelete;r.document;const s=jn(n,r.document),o=r.readTime?Ft(r.readTime):j.min(),a=gt.newNoDocument(s,o),l=r.removedTargetIds||[];e=new Or([],l,a.key,a)}else if("documentRemove"in t){t.documentRemove;const r=t.documentRemove;r.document;const s=jn(n,r.document),o=r.removedTargetIds||[];e=new Or([],o,s,null)}else{if(!("filter"in t))return F(11601,{Rt:t});{t.filter;const r=t.filter;r.targetId;const{count:s=0,unchangedNames:o}=r,a=new Ap(s,o),l=r.targetId;e=new Yl(l,a)}}return e}function ru(n,t){let e;if(t instanceof tr)e={update:_c(n,t.key,t.value)};else if(t instanceof er)e={delete:Kr(n,t.key)};else if(t instanceof Ce)e={update:_c(n,t.key,t.data),updateMask:zp(t.fieldMask)};else{if(!(t instanceof Kl))return F(16599,{Vt:t.type});e={verify:Kr(n,t.key)}}return t.fieldTransforms.length>0&&(e.updateTransforms=t.fieldTransforms.map((r=>(function(o,a){const l=a.transform;if(l instanceof Kn)return{fieldPath:a.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(l instanceof Qn)return{fieldPath:a.field.canonicalString(),appendMissingElements:{values:l.elements}};if(l instanceof Xn)return{fieldPath:a.field.canonicalString(),removeAllFromArray:{values:l.elements}};if(l instanceof Gr)return{fieldPath:a.field.canonicalString(),increment:l.Ae};throw F(20930,{transform:a.transform})})(0,r)))),t.precondition.isNone||(e.currentDocument=(function(s,o){return o.updateTime!==void 0?{updateTime:Np(s,o.updateTime)}:o.exists!==void 0?{exists:o.exists}:F(27497)})(n,t.precondition)),e}function Mp(n,t){return n&&n.length>0?(Q(t!==void 0,14353),n.map((e=>(function(s,o){let a=s.updateTime?Ft(s.updateTime):Ft(o);return a.isEqual(j.min())&&(a=Ft(o)),new Ep(a,s.transformResults||[])})(e,t)))):[]}function Lp(n,t){return{documents:[eu(n,t.path)]}}function Fp(n,t){const e={structuredQuery:{}},r=t.path;let s;t.collectionGroup!==null?(s=r,e.structuredQuery.from=[{collectionId:t.collectionGroup,allDescendants:!0}]):(s=r.popLast(),e.structuredQuery.from=[{collectionId:r.lastSegment()}]),e.parent=eu(n,s);const o=(function(d){if(d.length!==0)return iu(Bt.create(d,"and"))})(t.filters);o&&(e.structuredQuery.where=o);const a=(function(d){if(d.length!==0)return d.map((m=>(function(v){return{field:Xe(v.field),direction:Up(v.dir)}})(m)))})(t.orderBy);a&&(e.structuredQuery.orderBy=a);const l=vi(n,t.limit);return l!==null&&(e.structuredQuery.limit=l),t.startAt&&(e.structuredQuery.startAt=(function(d){return{before:d.inclusive,values:d.position}})(t.startAt)),t.endAt&&(e.structuredQuery.endAt=(function(d){return{before:!d.inclusive,values:d.position}})(t.endAt)),{ft:e,parent:s}}function $p(n){let t=xp(n.parent);const e=n.structuredQuery,r=e.from?e.from.length:0;let s=null;if(r>0){Q(r===1,65062);const m=e.from[0];m.allDescendants?s=m.collectionId:t=t.child(m.collectionId)}let o=[];e.where&&(o=(function(_){const v=su(_);return v instanceof Bt&&Dl(v)?v.getFilters():[v]})(e.where));let a=[];e.orderBy&&(a=(function(_){return _.map((v=>(function(V){return new Wn(Ye(V.field),(function(P){switch(P){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(V.direction))})(v)))})(e.orderBy));let l=null;e.limit&&(l=(function(_){let v;return v=typeof _=="object"?_.value:_,Zn(v)?null:v})(e.limit));let h=null;e.startAt&&(h=(function(_){const v=!!_.before,C=_.values||[];return new zr(C,v)})(e.startAt));let d=null;return e.endAt&&(d=(function(_){const v=!_.before,C=_.values||[];return new zr(C,v)})(e.endAt)),ip(t,s,a,o,l,"F",h,d)}function jp(n,t){const e=(function(s){switch(s){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return F(28987,{purpose:s})}})(t.purpose);return e==null?null:{"goog-listen-tags":e}}function su(n){return n.unaryFilter!==void 0?(function(e){switch(e.unaryFilter.op){case"IS_NAN":const r=Ye(e.unaryFilter.field);return ut.create(r,"==",{doubleValue:NaN});case"IS_NULL":const s=Ye(e.unaryFilter.field);return ut.create(s,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const o=Ye(e.unaryFilter.field);return ut.create(o,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const a=Ye(e.unaryFilter.field);return ut.create(a,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return F(61313);default:return F(60726)}})(n):n.fieldFilter!==void 0?(function(e){return ut.create(Ye(e.fieldFilter.field),(function(s){switch(s){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return F(58110);default:return F(50506)}})(e.fieldFilter.op),e.fieldFilter.value)})(n):n.compositeFilter!==void 0?(function(e){return Bt.create(e.compositeFilter.filters.map((r=>su(r))),(function(s){switch(s){case"AND":return"and";case"OR":return"or";default:return F(1026)}})(e.compositeFilter.op))})(n):F(30097,{filter:n})}function Up(n){return Sp[n]}function Bp(n){return Pp[n]}function qp(n){return Vp[n]}function Xe(n){return{fieldPath:n.canonicalString()}}function Ye(n){return Et.fromServerFormat(n.fieldPath)}function iu(n){return n instanceof ut?(function(e){if(e.op==="=="){if(sc(e.value))return{unaryFilter:{field:Xe(e.field),op:"IS_NAN"}};if(rc(e.value))return{unaryFilter:{field:Xe(e.field),op:"IS_NULL"}}}else if(e.op==="!="){if(sc(e.value))return{unaryFilter:{field:Xe(e.field),op:"IS_NOT_NAN"}};if(rc(e.value))return{unaryFilter:{field:Xe(e.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:Xe(e.field),op:Bp(e.op),value:e.value}}})(n):n instanceof Bt?(function(e){const r=e.getFilters().map((s=>iu(s)));return r.length===1?r[0]:{compositeFilter:{op:qp(e.op),filters:r}}})(n):F(54877,{filter:n})}function zp(n){const t=[];return n.fields.forEach((e=>t.push(e.canonicalString()))),{fieldPaths:t}}function ou(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class he{constructor(t,e,r,s,o=j.min(),a=j.min(),l=vt.EMPTY_BYTE_STRING,h=null){this.target=t,this.targetId=e,this.purpose=r,this.sequenceNumber=s,this.snapshotVersion=o,this.lastLimboFreeSnapshotVersion=a,this.resumeToken=l,this.expectedCount=h}withSequenceNumber(t){return new he(this.target,this.targetId,this.purpose,t,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(t,e){return new he(this.target,this.targetId,this.purpose,this.sequenceNumber,e,this.lastLimboFreeSnapshotVersion,t,null)}withExpectedCount(t){return new he(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,t)}withLastLimboFreeSnapshotVersion(t){return new he(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,t,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hp{constructor(t){this.yt=t}}function Gp(n){const t=$p({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?Hr(t,t.limit,"L"):t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wp{constructor(){this.Cn=new Kp}addToCollectionParentIndex(t,e){return this.Cn.add(e),S.resolve()}getCollectionParents(t,e){return S.resolve(this.Cn.getEntries(e))}addFieldIndex(t,e){return S.resolve()}deleteFieldIndex(t,e){return S.resolve()}deleteAllFieldIndexes(t){return S.resolve()}createTargetIndexes(t,e){return S.resolve()}getDocumentsMatchingTarget(t,e){return S.resolve(null)}getIndexType(t,e){return S.resolve(0)}getFieldIndexes(t,e){return S.resolve([])}getNextCollectionGroupToUpdate(t){return S.resolve(null)}getMinOffset(t,e){return S.resolve(ye.min())}getMinOffsetFromCollectionGroup(t,e){return S.resolve(ye.min())}updateCollectionGroup(t,e,r){return S.resolve()}updateIndexEntries(t,e){return S.resolve()}}class Kp{constructor(){this.index={}}add(t){const e=t.lastSegment(),r=t.popLast(),s=this.index[e]||new ft(J.comparator),o=!s.has(r);return this.index[e]=s.add(r),o}has(t){const e=t.lastSegment(),r=t.popLast(),s=this.index[e];return s&&s.has(r)}getEntries(t){return(this.index[t]||new ft(J.comparator)).toArray()}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yc={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},au=41943040;class xt{static withCacheSize(t){return new xt(t,xt.DEFAULT_COLLECTION_PERCENTILE,xt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(t,e,r){this.cacheSizeCollectionThreshold=t,this.percentileToCollect=e,this.maximumSequenceNumbersToCollect=r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */xt.DEFAULT_COLLECTION_PERCENTILE=10,xt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,xt.DEFAULT=new xt(au,xt.DEFAULT_COLLECTION_PERCENTILE,xt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),xt.DISABLED=new xt(-1,0,0);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cn{constructor(t){this.ar=t}next(){return this.ar+=2,this.ar}static ur(){return new cn(0)}static cr(){return new cn(-1)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ec="LruGarbageCollector",Qp=1048576;function vc([n,t],[e,r]){const s=H(n,e);return s===0?H(t,r):s}class Xp{constructor(t){this.Ir=t,this.buffer=new ft(vc),this.Er=0}dr(){return++this.Er}Ar(t){const e=[t,this.dr()];if(this.buffer.size<this.Ir)this.buffer=this.buffer.add(e);else{const r=this.buffer.last();vc(e,r)<0&&(this.buffer=this.buffer.delete(r).add(e))}}get maxValue(){return this.buffer.last()[0]}}class Yp{constructor(t,e,r){this.garbageCollector=t,this.asyncQueue=e,this.localStore=r,this.Rr=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Vr(6e4)}stop(){this.Rr&&(this.Rr.cancel(),this.Rr=null)}get started(){return this.Rr!==null}Vr(t){O(Ec,`Garbage collection scheduled in ${t}ms`),this.Rr=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",t,(async()=>{this.Rr=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(e){mn(e)?O(Ec,"Ignoring IndexedDB error during garbage collection: ",e):await fn(e)}await this.Vr(3e5)}))}}class Jp{constructor(t,e){this.mr=t,this.params=e}calculateTargetCount(t,e){return this.mr.gr(t).next((r=>Math.floor(e/100*r)))}nthSequenceNumber(t,e){if(e===0)return S.resolve(os.ce);const r=new Xp(e);return this.mr.forEachTarget(t,(s=>r.Ar(s.sequenceNumber))).next((()=>this.mr.pr(t,(s=>r.Ar(s))))).next((()=>r.maxValue))}removeTargets(t,e,r){return this.mr.removeTargets(t,e,r)}removeOrphanedDocuments(t,e){return this.mr.removeOrphanedDocuments(t,e)}collect(t,e){return this.params.cacheSizeCollectionThreshold===-1?(O("LruGarbageCollector","Garbage collection skipped; disabled"),S.resolve(yc)):this.getCacheSize(t).next((r=>r<this.params.cacheSizeCollectionThreshold?(O("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),yc):this.yr(t,e)))}getCacheSize(t){return this.mr.getCacheSize(t)}yr(t,e){let r,s,o,a,l,h,d;const m=Date.now();return this.calculateTargetCount(t,this.params.percentileToCollect).next((_=>(_>this.params.maximumSequenceNumbersToCollect?(O("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${_}`),s=this.params.maximumSequenceNumbersToCollect):s=_,a=Date.now(),this.nthSequenceNumber(t,s)))).next((_=>(r=_,l=Date.now(),this.removeTargets(t,r,e)))).next((_=>(o=_,h=Date.now(),this.removeOrphanedDocuments(t,r)))).next((_=>(d=Date.now(),Ke()<=K.DEBUG&&O("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${a-m}ms
	Determined least recently used ${s} in `+(l-a)+`ms
	Removed ${o} targets in `+(h-l)+`ms
	Removed ${_} documents in `+(d-h)+`ms
Total Duration: ${d-m}ms`),S.resolve({didRun:!0,sequenceNumbersCollected:s,targetsRemoved:o,documentsRemoved:_}))))}}function Zp(n,t){return new Jp(n,t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tg{constructor(){this.changes=new Le((t=>t.toString()),((t,e)=>t.isEqual(e))),this.changesApplied=!1}addEntry(t){this.assertNotApplied(),this.changes.set(t.key,t)}removeEntry(t,e){this.assertNotApplied(),this.changes.set(t,gt.newInvalidDocument(t).setReadTime(e))}getEntry(t,e){this.assertNotApplied();const r=this.changes.get(e);return r!==void 0?S.resolve(r):this.getFromCache(t,e)}getEntries(t,e){return this.getAllFromCache(t,e)}apply(t){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(t)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eg{constructor(t,e){this.overlayedDocument=t,this.mutatedFields=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ng{constructor(t,e,r,s){this.remoteDocumentCache=t,this.mutationQueue=e,this.documentOverlayCache=r,this.indexManager=s}getDocument(t,e){let r=null;return this.documentOverlayCache.getOverlay(t,e).next((s=>(r=s,this.remoteDocumentCache.getEntry(t,e)))).next((s=>(r!==null&&$n(r.mutation,s,Lt.empty(),et.now()),s)))}getDocuments(t,e){return this.remoteDocumentCache.getEntries(t,e).next((r=>this.getLocalViewOfDocuments(t,r,G()).next((()=>r))))}getLocalViewOfDocuments(t,e,r=G()){const s=Ne();return this.populateOverlays(t,s,e).next((()=>this.computeViews(t,e,s,r).next((o=>{let a=xn();return o.forEach(((l,h)=>{a=a.insert(l,h.overlayedDocument)})),a}))))}getOverlayedDocuments(t,e){const r=Ne();return this.populateOverlays(t,r,e).next((()=>this.computeViews(t,e,r,G())))}populateOverlays(t,e,r){const s=[];return r.forEach((o=>{e.has(o)||s.push(o)})),this.documentOverlayCache.getOverlays(t,s).next((o=>{o.forEach(((a,l)=>{e.set(a,l)}))}))}computeViews(t,e,r,s){let o=re();const a=Fn(),l=(function(){return Fn()})();return e.forEach(((h,d)=>{const m=r.get(d.key);s.has(d.key)&&(m===void 0||m.mutation instanceof Ce)?o=o.insert(d.key,d):m!==void 0?(a.set(d.key,m.mutation.getFieldMask()),$n(m.mutation,d,m.mutation.getFieldMask(),et.now())):a.set(d.key,Lt.empty())})),this.recalculateAndSaveOverlays(t,o).next((h=>(h.forEach(((d,m)=>a.set(d,m))),e.forEach(((d,m)=>l.set(d,new eg(m,a.get(d)??null)))),l)))}recalculateAndSaveOverlays(t,e){const r=Fn();let s=new it(((a,l)=>a-l)),o=G();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(t,e).next((a=>{for(const l of a)l.keys().forEach((h=>{const d=e.get(h);if(d===null)return;let m=r.get(h)||Lt.empty();m=l.applyToLocalView(d,m),r.set(h,m);const _=(s.get(l.batchId)||G()).add(h);s=s.insert(l.batchId,_)}))})).next((()=>{const a=[],l=s.getReverseIterator();for(;l.hasNext();){const h=l.getNext(),d=h.key,m=h.value,_=jl();m.forEach((v=>{if(!o.has(v)){const C=Gl(e.get(v),r.get(v));C!==null&&_.set(v,C),o=o.add(v)}})),a.push(this.documentOverlayCache.saveOverlays(t,d,_))}return S.waitFor(a)})).next((()=>r))}recalculateAndSaveOverlaysForDocumentKeys(t,e){return this.remoteDocumentCache.getEntries(t,e).next((r=>this.recalculateAndSaveOverlays(t,r)))}getDocumentsMatchingQuery(t,e,r,s){return(function(a){return L.isDocumentKey(a.path)&&a.collectionGroup===null&&a.filters.length===0})(e)?this.getDocumentsMatchingDocumentQuery(t,e.path):Ol(e)?this.getDocumentsMatchingCollectionGroupQuery(t,e,r,s):this.getDocumentsMatchingCollectionQuery(t,e,r,s)}getNextDocuments(t,e,r,s){return this.remoteDocumentCache.getAllFromCollectionGroup(t,e,r,s).next((o=>{const a=s-o.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(t,e,r.largestBatchId,s-o.size):S.resolve(Ne());let l=qn,h=o;return a.next((d=>S.forEach(d,((m,_)=>(l<_.largestBatchId&&(l=_.largestBatchId),o.get(m)?S.resolve():this.remoteDocumentCache.getEntry(t,m).next((v=>{h=h.insert(m,v)}))))).next((()=>this.populateOverlays(t,d,o))).next((()=>this.computeViews(t,h,d,G()))).next((m=>({batchId:l,changes:$l(m)})))))}))}getDocumentsMatchingDocumentQuery(t,e){return this.getDocument(t,new L(e)).next((r=>{let s=xn();return r.isFoundDocument()&&(s=s.insert(r.key,r)),s}))}getDocumentsMatchingCollectionGroupQuery(t,e,r,s){const o=e.collectionGroup;let a=xn();return this.indexManager.getCollectionParents(t,o).next((l=>S.forEach(l,(h=>{const d=(function(_,v){return new pn(v,null,_.explicitOrderBy.slice(),_.filters.slice(),_.limit,_.limitType,_.startAt,_.endAt)})(e,h.child(o));return this.getDocumentsMatchingCollectionQuery(t,d,r,s).next((m=>{m.forEach(((_,v)=>{a=a.insert(_,v)}))}))})).next((()=>a))))}getDocumentsMatchingCollectionQuery(t,e,r,s){let o;return this.documentOverlayCache.getOverlaysForCollection(t,e.path,r.largestBatchId).next((a=>(o=a,this.remoteDocumentCache.getDocumentsMatchingQuery(t,e,r,o,s)))).next((a=>{o.forEach(((h,d)=>{const m=d.getKey();a.get(m)===null&&(a=a.insert(m,gt.newInvalidDocument(m)))}));let l=xn();return a.forEach(((h,d)=>{const m=o.get(h);m!==void 0&&$n(m.mutation,d,Lt.empty(),et.now()),us(e,d)&&(l=l.insert(h,d))})),l}))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rg{constructor(t){this.serializer=t,this.Lr=new Map,this.kr=new Map}getBundleMetadata(t,e){return S.resolve(this.Lr.get(e))}saveBundleMetadata(t,e){return this.Lr.set(e.id,(function(s){return{id:s.id,version:s.version,createTime:Ft(s.createTime)}})(e)),S.resolve()}getNamedQuery(t,e){return S.resolve(this.kr.get(e))}saveNamedQuery(t,e){return this.kr.set(e.name,(function(s){return{name:s.name,query:Gp(s.bundledQuery),readTime:Ft(s.readTime)}})(e)),S.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sg{constructor(){this.overlays=new it(L.comparator),this.qr=new Map}getOverlay(t,e){return S.resolve(this.overlays.get(e))}getOverlays(t,e){const r=Ne();return S.forEach(e,(s=>this.getOverlay(t,s).next((o=>{o!==null&&r.set(s,o)})))).next((()=>r))}saveOverlays(t,e,r){return r.forEach(((s,o)=>{this.St(t,e,o)})),S.resolve()}removeOverlaysForBatchId(t,e,r){const s=this.qr.get(r);return s!==void 0&&(s.forEach((o=>this.overlays=this.overlays.remove(o))),this.qr.delete(r)),S.resolve()}getOverlaysForCollection(t,e,r){const s=Ne(),o=e.length+1,a=new L(e.child("")),l=this.overlays.getIteratorFrom(a);for(;l.hasNext();){const h=l.getNext().value,d=h.getKey();if(!e.isPrefixOf(d.path))break;d.path.length===o&&h.largestBatchId>r&&s.set(h.getKey(),h)}return S.resolve(s)}getOverlaysForCollectionGroup(t,e,r,s){let o=new it(((d,m)=>d-m));const a=this.overlays.getIterator();for(;a.hasNext();){const d=a.getNext().value;if(d.getKey().getCollectionGroup()===e&&d.largestBatchId>r){let m=o.get(d.largestBatchId);m===null&&(m=Ne(),o=o.insert(d.largestBatchId,m)),m.set(d.getKey(),d)}}const l=Ne(),h=o.getIterator();for(;h.hasNext()&&(h.getNext().value.forEach(((d,m)=>l.set(d,m))),!(l.size()>=s)););return S.resolve(l)}St(t,e,r){const s=this.overlays.get(r.key);if(s!==null){const a=this.qr.get(s.largestBatchId).delete(r.key);this.qr.set(s.largestBatchId,a)}this.overlays=this.overlays.insert(r.key,new Ip(e,r));let o=this.qr.get(e);o===void 0&&(o=G(),this.qr.set(e,o)),this.qr.set(e,o.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ig{constructor(){this.sessionToken=vt.EMPTY_BYTE_STRING}getSessionToken(t){return S.resolve(this.sessionToken)}setSessionToken(t,e){return this.sessionToken=e,S.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ki{constructor(){this.Qr=new ft(pt.$r),this.Ur=new ft(pt.Kr)}isEmpty(){return this.Qr.isEmpty()}addReference(t,e){const r=new pt(t,e);this.Qr=this.Qr.add(r),this.Ur=this.Ur.add(r)}Wr(t,e){t.forEach((r=>this.addReference(r,e)))}removeReference(t,e){this.Gr(new pt(t,e))}zr(t,e){t.forEach((r=>this.removeReference(r,e)))}jr(t){const e=new L(new J([])),r=new pt(e,t),s=new pt(e,t+1),o=[];return this.Ur.forEachInRange([r,s],(a=>{this.Gr(a),o.push(a.key)})),o}Jr(){this.Qr.forEach((t=>this.Gr(t)))}Gr(t){this.Qr=this.Qr.delete(t),this.Ur=this.Ur.delete(t)}Hr(t){const e=new L(new J([])),r=new pt(e,t),s=new pt(e,t+1);let o=G();return this.Ur.forEachInRange([r,s],(a=>{o=o.add(a.key)})),o}containsKey(t){const e=new pt(t,0),r=this.Qr.firstAfterOrEqual(e);return r!==null&&t.isEqual(r.key)}}class pt{constructor(t,e){this.key=t,this.Yr=e}static $r(t,e){return L.comparator(t.key,e.key)||H(t.Yr,e.Yr)}static Kr(t,e){return H(t.Yr,e.Yr)||L.comparator(t.key,e.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class og{constructor(t,e){this.indexManager=t,this.referenceDelegate=e,this.mutationQueue=[],this.tr=1,this.Zr=new ft(pt.$r)}checkEmpty(t){return S.resolve(this.mutationQueue.length===0)}addMutationBatch(t,e,r,s){const o=this.tr;this.tr++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const a=new wp(o,e,r,s);this.mutationQueue.push(a);for(const l of s)this.Zr=this.Zr.add(new pt(l.key,o)),this.indexManager.addToCollectionParentIndex(t,l.key.path.popLast());return S.resolve(a)}lookupMutationBatch(t,e){return S.resolve(this.Xr(e))}getNextMutationBatchAfterBatchId(t,e){const r=e+1,s=this.ei(r),o=s<0?0:s;return S.resolve(this.mutationQueue.length>o?this.mutationQueue[o]:null)}getHighestUnacknowledgedBatchId(){return S.resolve(this.mutationQueue.length===0?$i:this.tr-1)}getAllMutationBatches(t){return S.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(t,e){const r=new pt(e,0),s=new pt(e,Number.POSITIVE_INFINITY),o=[];return this.Zr.forEachInRange([r,s],(a=>{const l=this.Xr(a.Yr);o.push(l)})),S.resolve(o)}getAllMutationBatchesAffectingDocumentKeys(t,e){let r=new ft(H);return e.forEach((s=>{const o=new pt(s,0),a=new pt(s,Number.POSITIVE_INFINITY);this.Zr.forEachInRange([o,a],(l=>{r=r.add(l.Yr)}))})),S.resolve(this.ti(r))}getAllMutationBatchesAffectingQuery(t,e){const r=e.path,s=r.length+1;let o=r;L.isDocumentKey(o)||(o=o.child(""));const a=new pt(new L(o),0);let l=new ft(H);return this.Zr.forEachWhile((h=>{const d=h.key.path;return!!r.isPrefixOf(d)&&(d.length===s&&(l=l.add(h.Yr)),!0)}),a),S.resolve(this.ti(l))}ti(t){const e=[];return t.forEach((r=>{const s=this.Xr(r);s!==null&&e.push(s)})),e}removeMutationBatch(t,e){Q(this.ni(e.batchId,"removed")===0,55003),this.mutationQueue.shift();let r=this.Zr;return S.forEach(e.mutations,(s=>{const o=new pt(s.key,e.batchId);return r=r.delete(o),this.referenceDelegate.markPotentiallyOrphaned(t,s.key)})).next((()=>{this.Zr=r}))}ir(t){}containsKey(t,e){const r=new pt(e,0),s=this.Zr.firstAfterOrEqual(r);return S.resolve(e.isEqual(s&&s.key))}performConsistencyCheck(t){return this.mutationQueue.length,S.resolve()}ni(t,e){return this.ei(t)}ei(t){return this.mutationQueue.length===0?0:t-this.mutationQueue[0].batchId}Xr(t){const e=this.ei(t);return e<0||e>=this.mutationQueue.length?null:this.mutationQueue[e]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ag{constructor(t){this.ri=t,this.docs=(function(){return new it(L.comparator)})(),this.size=0}setIndexManager(t){this.indexManager=t}addEntry(t,e){const r=e.key,s=this.docs.get(r),o=s?s.size:0,a=this.ri(e);return this.docs=this.docs.insert(r,{document:e.mutableCopy(),size:a}),this.size+=a-o,this.indexManager.addToCollectionParentIndex(t,r.path.popLast())}removeEntry(t){const e=this.docs.get(t);e&&(this.docs=this.docs.remove(t),this.size-=e.size)}getEntry(t,e){const r=this.docs.get(e);return S.resolve(r?r.document.mutableCopy():gt.newInvalidDocument(e))}getEntries(t,e){let r=re();return e.forEach((s=>{const o=this.docs.get(s);r=r.insert(s,o?o.document.mutableCopy():gt.newInvalidDocument(s))})),S.resolve(r)}getDocumentsMatchingQuery(t,e,r,s){let o=re();const a=e.path,l=new L(a.child("__id-9223372036854775808__")),h=this.docs.getIteratorFrom(l);for(;h.hasNext();){const{key:d,value:{document:m}}=h.getNext();if(!a.isPrefixOf(d.path))break;d.path.length>a.length+1||Lm(Mm(m),r)<=0||(s.has(m.key)||us(e,m))&&(o=o.insert(m.key,m.mutableCopy()))}return S.resolve(o)}getAllFromCollectionGroup(t,e,r,s){F(9500)}ii(t,e){return S.forEach(this.docs,(r=>e(r)))}newChangeBuffer(t){return new cg(this)}getSize(t){return S.resolve(this.size)}}class cg extends tg{constructor(t){super(),this.Nr=t}applyChanges(t){const e=[];return this.changes.forEach(((r,s)=>{s.isValidDocument()?e.push(this.Nr.addEntry(t,s)):this.Nr.removeEntry(r)})),S.waitFor(e)}getFromCache(t,e){return this.Nr.getEntry(t,e)}getAllFromCache(t,e){return this.Nr.getEntries(t,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lg{constructor(t){this.persistence=t,this.si=new Le((e=>Bi(e)),qi),this.lastRemoteSnapshotVersion=j.min(),this.highestTargetId=0,this.oi=0,this._i=new Ki,this.targetCount=0,this.ai=cn.ur()}forEachTarget(t,e){return this.si.forEach(((r,s)=>e(s))),S.resolve()}getLastRemoteSnapshotVersion(t){return S.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(t){return S.resolve(this.oi)}allocateTargetId(t){return this.highestTargetId=this.ai.next(),S.resolve(this.highestTargetId)}setTargetsMetadata(t,e,r){return r&&(this.lastRemoteSnapshotVersion=r),e>this.oi&&(this.oi=e),S.resolve()}Pr(t){this.si.set(t.target,t);const e=t.targetId;e>this.highestTargetId&&(this.ai=new cn(e),this.highestTargetId=e),t.sequenceNumber>this.oi&&(this.oi=t.sequenceNumber)}addTargetData(t,e){return this.Pr(e),this.targetCount+=1,S.resolve()}updateTargetData(t,e){return this.Pr(e),S.resolve()}removeTargetData(t,e){return this.si.delete(e.target),this._i.jr(e.targetId),this.targetCount-=1,S.resolve()}removeTargets(t,e,r){let s=0;const o=[];return this.si.forEach(((a,l)=>{l.sequenceNumber<=e&&r.get(l.targetId)===null&&(this.si.delete(a),o.push(this.removeMatchingKeysForTargetId(t,l.targetId)),s++)})),S.waitFor(o).next((()=>s))}getTargetCount(t){return S.resolve(this.targetCount)}getTargetData(t,e){const r=this.si.get(e)||null;return S.resolve(r)}addMatchingKeys(t,e,r){return this._i.Wr(e,r),S.resolve()}removeMatchingKeys(t,e,r){this._i.zr(e,r);const s=this.persistence.referenceDelegate,o=[];return s&&e.forEach((a=>{o.push(s.markPotentiallyOrphaned(t,a))})),S.waitFor(o)}removeMatchingKeysForTargetId(t,e){return this._i.jr(e),S.resolve()}getMatchingKeysForTargetId(t,e){const r=this._i.Hr(e);return S.resolve(r)}containsKey(t,e){return S.resolve(this._i.containsKey(e))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cu{constructor(t,e){this.ui={},this.overlays={},this.ci=new os(0),this.li=!1,this.li=!0,this.hi=new ig,this.referenceDelegate=t(this),this.Pi=new lg(this),this.indexManager=new Wp,this.remoteDocumentCache=(function(s){return new ag(s)})((r=>this.referenceDelegate.Ti(r))),this.serializer=new Hp(e),this.Ii=new rg(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.li=!1,Promise.resolve()}get started(){return this.li}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(t){return this.indexManager}getDocumentOverlayCache(t){let e=this.overlays[t.toKey()];return e||(e=new sg,this.overlays[t.toKey()]=e),e}getMutationQueue(t,e){let r=this.ui[t.toKey()];return r||(r=new og(e,this.referenceDelegate),this.ui[t.toKey()]=r),r}getGlobalsCache(){return this.hi}getTargetCache(){return this.Pi}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Ii}runTransaction(t,e,r){O("MemoryPersistence","Starting transaction:",t);const s=new ug(this.ci.next());return this.referenceDelegate.Ei(),r(s).next((o=>this.referenceDelegate.di(s).next((()=>o)))).toPromise().then((o=>(s.raiseOnCommittedEvent(),o)))}Ai(t,e){return S.or(Object.values(this.ui).map((r=>()=>r.containsKey(t,e))))}}class ug extends $m{constructor(t){super(),this.currentSequenceNumber=t}}class Qi{constructor(t){this.persistence=t,this.Ri=new Ki,this.Vi=null}static mi(t){return new Qi(t)}get fi(){if(this.Vi)return this.Vi;throw F(60996)}addReference(t,e,r){return this.Ri.addReference(r,e),this.fi.delete(r.toString()),S.resolve()}removeReference(t,e,r){return this.Ri.removeReference(r,e),this.fi.add(r.toString()),S.resolve()}markPotentiallyOrphaned(t,e){return this.fi.add(e.toString()),S.resolve()}removeTarget(t,e){this.Ri.jr(e.targetId).forEach((s=>this.fi.add(s.toString())));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(t,e.targetId).next((s=>{s.forEach((o=>this.fi.add(o.toString())))})).next((()=>r.removeTargetData(t,e)))}Ei(){this.Vi=new Set}di(t){const e=this.persistence.getRemoteDocumentCache().newChangeBuffer();return S.forEach(this.fi,(r=>{const s=L.fromPath(r);return this.gi(t,s).next((o=>{o||e.removeEntry(s,j.min())}))})).next((()=>(this.Vi=null,e.apply(t))))}updateLimboDocument(t,e){return this.gi(t,e).next((r=>{r?this.fi.delete(e.toString()):this.fi.add(e.toString())}))}Ti(t){return 0}gi(t,e){return S.or([()=>S.resolve(this.Ri.containsKey(e)),()=>this.persistence.getTargetCache().containsKey(t,e),()=>this.persistence.Ai(t,e)])}}class Qr{constructor(t,e){this.persistence=t,this.pi=new Le((r=>Bm(r.path)),((r,s)=>r.isEqual(s))),this.garbageCollector=Zp(this,e)}static mi(t,e){return new Qr(t,e)}Ei(){}di(t){return S.resolve()}forEachTarget(t,e){return this.persistence.getTargetCache().forEachTarget(t,e)}gr(t){const e=this.wr(t);return this.persistence.getTargetCache().getTargetCount(t).next((r=>e.next((s=>r+s))))}wr(t){let e=0;return this.pr(t,(r=>{e++})).next((()=>e))}pr(t,e){return S.forEach(this.pi,((r,s)=>this.br(t,r,s).next((o=>o?S.resolve():e(s)))))}removeTargets(t,e,r){return this.persistence.getTargetCache().removeTargets(t,e,r)}removeOrphanedDocuments(t,e){let r=0;const s=this.persistence.getRemoteDocumentCache(),o=s.newChangeBuffer();return s.ii(t,(a=>this.br(t,a,e).next((l=>{l||(r++,o.removeEntry(a,j.min()))})))).next((()=>o.apply(t))).next((()=>r))}markPotentiallyOrphaned(t,e){return this.pi.set(e,t.currentSequenceNumber),S.resolve()}removeTarget(t,e){const r=e.withSequenceNumber(t.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(t,r)}addReference(t,e,r){return this.pi.set(r,t.currentSequenceNumber),S.resolve()}removeReference(t,e,r){return this.pi.set(r,t.currentSequenceNumber),S.resolve()}updateLimboDocument(t,e){return this.pi.set(e,t.currentSequenceNumber),S.resolve()}Ti(t){let e=t.key.toString().length;return t.isFoundDocument()&&(e+=Nr(t.data.value)),e}br(t,e,r){return S.or([()=>this.persistence.Ai(t,e),()=>this.persistence.getTargetCache().containsKey(t,e),()=>{const s=this.pi.get(e);return S.resolve(s!==void 0&&s>r)}])}getCacheSize(t){return this.persistence.getRemoteDocumentCache().getSize(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xi{constructor(t,e,r,s){this.targetId=t,this.fromCache=e,this.Es=r,this.ds=s}static As(t,e){let r=G(),s=G();for(const o of e.docChanges)switch(o.type){case 0:r=r.add(o.doc.key);break;case 1:s=s.add(o.doc.key)}return new Xi(t,e.fromCache,r,s)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hg{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(t){this._documentReadCount+=t}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dg{constructor(){this.Rs=!1,this.Vs=!1,this.fs=100,this.gs=(function(){return sf()?8:jm(nf())>0?6:4})()}initialize(t,e){this.ps=t,this.indexManager=e,this.Rs=!0}getDocumentsMatchingQuery(t,e,r,s){const o={result:null};return this.ys(t,e).next((a=>{o.result=a})).next((()=>{if(!o.result)return this.ws(t,e,s,r).next((a=>{o.result=a}))})).next((()=>{if(o.result)return;const a=new hg;return this.Ss(t,e,a).next((l=>{if(o.result=l,this.Vs)return this.bs(t,e,a,l.size)}))})).next((()=>o.result))}bs(t,e,r,s){return r.documentReadCount<this.fs?(Ke()<=K.DEBUG&&O("QueryEngine","SDK will not create cache indexes for query:",Qe(e),"since it only creates cache indexes for collection contains","more than or equal to",this.fs,"documents"),S.resolve()):(Ke()<=K.DEBUG&&O("QueryEngine","Query:",Qe(e),"scans",r.documentReadCount,"local documents and returns",s,"documents as results."),r.documentReadCount>this.gs*s?(Ke()<=K.DEBUG&&O("QueryEngine","The SDK decides to create cache indexes for query:",Qe(e),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(t,Kt(e))):S.resolve())}ys(t,e){if(cc(e))return S.resolve(null);let r=Kt(e);return this.indexManager.getIndexType(t,r).next((s=>s===0?null:(e.limit!==null&&s===1&&(e=Hr(e,null,"F"),r=Kt(e)),this.indexManager.getDocumentsMatchingTarget(t,r).next((o=>{const a=G(...o);return this.ps.getDocuments(t,a).next((l=>this.indexManager.getMinOffset(t,r).next((h=>{const d=this.Ds(e,l);return this.Cs(e,d,a,h.readTime)?this.ys(t,Hr(e,null,"F")):this.vs(t,d,e,h)}))))})))))}ws(t,e,r,s){return cc(e)||s.isEqual(j.min())?S.resolve(null):this.ps.getDocuments(t,r).next((o=>{const a=this.Ds(e,o);return this.Cs(e,a,r,s)?S.resolve(null):(Ke()<=K.DEBUG&&O("QueryEngine","Re-using previous result from %s to execute query: %s",s.toString(),Qe(e)),this.vs(t,a,e,Om(s,qn)).next((l=>l)))}))}Ds(t,e){let r=new ft(Ll(t));return e.forEach(((s,o)=>{us(t,o)&&(r=r.add(o))})),r}Cs(t,e,r,s){if(t.limit===null)return!1;if(r.size!==e.size)return!0;const o=t.limitType==="F"?e.last():e.first();return!!o&&(o.hasPendingWrites||o.version.compareTo(s)>0)}Ss(t,e,r){return Ke()<=K.DEBUG&&O("QueryEngine","Using full collection scan to execute query:",Qe(e)),this.ps.getDocumentsMatchingQuery(t,e,ye.min(),r)}vs(t,e,r,s){return this.ps.getDocumentsMatchingQuery(t,r,s).next((o=>(e.forEach((a=>{o=o.insert(a.key,a)})),o)))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Yi="LocalStore",fg=3e8;class mg{constructor(t,e,r,s){this.persistence=t,this.Fs=e,this.serializer=s,this.Ms=new it(H),this.xs=new Le((o=>Bi(o)),qi),this.Os=new Map,this.Ns=t.getRemoteDocumentCache(),this.Pi=t.getTargetCache(),this.Ii=t.getBundleCache(),this.Bs(r)}Bs(t){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(t),this.indexManager=this.persistence.getIndexManager(t),this.mutationQueue=this.persistence.getMutationQueue(t,this.indexManager),this.localDocuments=new ng(this.Ns,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.Ns.setIndexManager(this.indexManager),this.Fs.initialize(this.localDocuments,this.indexManager)}collectGarbage(t){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(e=>t.collect(e,this.Ms)))}}function pg(n,t,e,r){return new mg(n,t,e,r)}async function lu(n,t){const e=B(n);return await e.persistence.runTransaction("Handle user change","readonly",(r=>{let s;return e.mutationQueue.getAllMutationBatches(r).next((o=>(s=o,e.Bs(t),e.mutationQueue.getAllMutationBatches(r)))).next((o=>{const a=[],l=[];let h=G();for(const d of s){a.push(d.batchId);for(const m of d.mutations)h=h.add(m.key)}for(const d of o){l.push(d.batchId);for(const m of d.mutations)h=h.add(m.key)}return e.localDocuments.getDocuments(r,h).next((d=>({Ls:d,removedBatchIds:a,addedBatchIds:l})))}))}))}function gg(n,t){const e=B(n);return e.persistence.runTransaction("Acknowledge batch","readwrite-primary",(r=>{const s=t.batch.keys(),o=e.Ns.newChangeBuffer({trackRemovals:!0});return(function(l,h,d,m){const _=d.batch,v=_.keys();let C=S.resolve();return v.forEach((V=>{C=C.next((()=>m.getEntry(h,V))).next((k=>{const P=d.docVersions.get(V);Q(P!==null,48541),k.version.compareTo(P)<0&&(_.applyToRemoteDocument(k,d),k.isValidDocument()&&(k.setReadTime(d.commitVersion),m.addEntry(k)))}))})),C.next((()=>l.mutationQueue.removeMutationBatch(h,_)))})(e,r,t,o).next((()=>o.apply(r))).next((()=>e.mutationQueue.performConsistencyCheck(r))).next((()=>e.documentOverlayCache.removeOverlaysForBatchId(r,s,t.batch.batchId))).next((()=>e.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,(function(l){let h=G();for(let d=0;d<l.mutationResults.length;++d)l.mutationResults[d].transformResults.length>0&&(h=h.add(l.batch.mutations[d].key));return h})(t)))).next((()=>e.localDocuments.getDocuments(r,s)))}))}function uu(n){const t=B(n);return t.persistence.runTransaction("Get last remote snapshot version","readonly",(e=>t.Pi.getLastRemoteSnapshotVersion(e)))}function _g(n,t){const e=B(n),r=t.snapshotVersion;let s=e.Ms;return e.persistence.runTransaction("Apply remote event","readwrite-primary",(o=>{const a=e.Ns.newChangeBuffer({trackRemovals:!0});s=e.Ms;const l=[];t.targetChanges.forEach(((m,_)=>{const v=s.get(_);if(!v)return;l.push(e.Pi.removeMatchingKeys(o,m.removedDocuments,_).next((()=>e.Pi.addMatchingKeys(o,m.addedDocuments,_))));let C=v.withSequenceNumber(o.currentSequenceNumber);t.targetMismatches.get(_)!==null?C=C.withResumeToken(vt.EMPTY_BYTE_STRING,j.min()).withLastLimboFreeSnapshotVersion(j.min()):m.resumeToken.approximateByteSize()>0&&(C=C.withResumeToken(m.resumeToken,r)),s=s.insert(_,C),(function(k,P,M){return k.resumeToken.approximateByteSize()===0||P.snapshotVersion.toMicroseconds()-k.snapshotVersion.toMicroseconds()>=fg?!0:M.addedDocuments.size+M.modifiedDocuments.size+M.removedDocuments.size>0})(v,C,m)&&l.push(e.Pi.updateTargetData(o,C))}));let h=re(),d=G();if(t.documentUpdates.forEach((m=>{t.resolvedLimboDocuments.has(m)&&l.push(e.persistence.referenceDelegate.updateLimboDocument(o,m))})),l.push(yg(o,a,t.documentUpdates).next((m=>{h=m.ks,d=m.qs}))),!r.isEqual(j.min())){const m=e.Pi.getLastRemoteSnapshotVersion(o).next((_=>e.Pi.setTargetsMetadata(o,o.currentSequenceNumber,r)));l.push(m)}return S.waitFor(l).next((()=>a.apply(o))).next((()=>e.localDocuments.getLocalViewOfDocuments(o,h,d))).next((()=>h))})).then((o=>(e.Ms=s,o)))}function yg(n,t,e){let r=G(),s=G();return e.forEach((o=>r=r.add(o))),t.getEntries(n,r).next((o=>{let a=re();return e.forEach(((l,h)=>{const d=o.get(l);h.isFoundDocument()!==d.isFoundDocument()&&(s=s.add(l)),h.isNoDocument()&&h.version.isEqual(j.min())?(t.removeEntry(l,h.readTime),a=a.insert(l,h)):!d.isValidDocument()||h.version.compareTo(d.version)>0||h.version.compareTo(d.version)===0&&d.hasPendingWrites?(t.addEntry(h),a=a.insert(l,h)):O(Yi,"Ignoring outdated watch update for ",l,". Current version:",d.version," Watch version:",h.version)})),{ks:a,qs:s}}))}function Eg(n,t){const e=B(n);return e.persistence.runTransaction("Get next mutation batch","readonly",(r=>(t===void 0&&(t=$i),e.mutationQueue.getNextMutationBatchAfterBatchId(r,t))))}function vg(n,t){const e=B(n);return e.persistence.runTransaction("Allocate target","readwrite",(r=>{let s;return e.Pi.getTargetData(r,t).next((o=>o?(s=o,S.resolve(s)):e.Pi.allocateTargetId(r).next((a=>(s=new he(t,a,"TargetPurposeListen",r.currentSequenceNumber),e.Pi.addTargetData(r,s).next((()=>s)))))))})).then((r=>{const s=e.Ms.get(r.targetId);return(s===null||r.snapshotVersion.compareTo(s.snapshotVersion)>0)&&(e.Ms=e.Ms.insert(r.targetId,r),e.xs.set(t,r.targetId)),r}))}async function Ii(n,t,e){const r=B(n),s=r.Ms.get(t),o=e?"readwrite":"readwrite-primary";try{e||await r.persistence.runTransaction("Release target",o,(a=>r.persistence.referenceDelegate.removeTarget(a,s)))}catch(a){if(!mn(a))throw a;O(Yi,`Failed to update sequence numbers for target ${t}: ${a}`)}r.Ms=r.Ms.remove(t),r.xs.delete(s.target)}function Tc(n,t,e){const r=B(n);let s=j.min(),o=G();return r.persistence.runTransaction("Execute query","readwrite",(a=>(function(h,d,m){const _=B(h),v=_.xs.get(m);return v!==void 0?S.resolve(_.Ms.get(v)):_.Pi.getTargetData(d,m)})(r,a,Kt(t)).next((l=>{if(l)return s=l.lastLimboFreeSnapshotVersion,r.Pi.getMatchingKeysForTargetId(a,l.targetId).next((h=>{o=h}))})).next((()=>r.Fs.getDocumentsMatchingQuery(a,t,e?s:j.min(),e?o:G()))).next((l=>(Tg(r,ap(t),l),{documents:l,Qs:o})))))}function Tg(n,t,e){let r=n.Os.get(t)||j.min();e.forEach(((s,o)=>{o.readTime.compareTo(r)>0&&(r=o.readTime)})),n.Os.set(t,r)}class wc{constructor(){this.activeTargetIds=fp()}zs(t){this.activeTargetIds=this.activeTargetIds.add(t)}js(t){this.activeTargetIds=this.activeTargetIds.delete(t)}Gs(){const t={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(t)}}class wg{constructor(){this.Mo=new wc,this.xo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(t){}updateMutationState(t,e,r){}addLocalQueryTarget(t,e=!0){return e&&this.Mo.zs(t),this.xo[t]||"not-current"}updateQueryState(t,e,r){this.xo[t]=e}removeLocalQueryTarget(t){this.Mo.js(t)}isLocalQueryTarget(t){return this.Mo.activeTargetIds.has(t)}clearQueryState(t){delete this.xo[t]}getAllActiveQueryTargets(){return this.Mo.activeTargetIds}isActiveQueryTarget(t){return this.Mo.activeTargetIds.has(t)}start(){return this.Mo=new wc,Promise.resolve()}handleUserChange(t,e,r){}setOnlineState(t){}shutdown(){}writeSequenceNumber(t){}notifyBundleLoaded(t){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ig{Oo(t){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ic="ConnectivityMonitor";class Ac{constructor(){this.No=()=>this.Bo(),this.Lo=()=>this.ko(),this.qo=[],this.Qo()}Oo(t){this.qo.push(t)}shutdown(){window.removeEventListener("online",this.No),window.removeEventListener("offline",this.Lo)}Qo(){window.addEventListener("online",this.No),window.addEventListener("offline",this.Lo)}Bo(){O(Ic,"Network connectivity changed: AVAILABLE");for(const t of this.qo)t(0)}ko(){O(Ic,"Network connectivity changed: UNAVAILABLE");for(const t of this.qo)t(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Pr=null;function Ai(){return Pr===null?Pr=(function(){return 268435456+Math.round(2147483648*Math.random())})():Pr++,"0x"+Pr.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ri="RestConnection",Ag={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};class Cg{get $o(){return!1}constructor(t){this.databaseInfo=t,this.databaseId=t.databaseId;const e=t.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),s=encodeURIComponent(this.databaseId.database);this.Uo=e+"://"+t.host,this.Ko=`projects/${r}/databases/${s}`,this.Wo=this.databaseId.database===Br?`project_id=${r}`:`project_id=${r}&database_id=${s}`}Go(t,e,r,s,o){const a=Ai(),l=this.zo(t,e.toUriEncodedString());O(ri,`Sending RPC '${t}' ${a}:`,l,r);const h={"google-cloud-resource-prefix":this.Ko,"x-goog-request-params":this.Wo};this.jo(h,s,o);const{host:d}=new URL(l),m=Oi(d);return this.Jo(t,l,h,r,m).then((_=>(O(ri,`Received RPC '${t}' ${a}: `,_),_)),(_=>{throw rn(ri,`RPC '${t}' ${a} failed with error: `,_,"url: ",l,"request:",r),_}))}Ho(t,e,r,s,o,a){return this.Go(t,e,r,s,o)}jo(t,e,r){t["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+dn})(),t["Content-Type"]="text/plain",this.databaseInfo.appId&&(t["X-Firebase-GMPID"]=this.databaseInfo.appId),e&&e.headers.forEach(((s,o)=>t[o]=s)),r&&r.headers.forEach(((s,o)=>t[o]=s))}zo(t,e){const r=Ag[t];return`${this.Uo}/v1/${e}:${r}`}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rg{constructor(t){this.Yo=t.Yo,this.Zo=t.Zo}Xo(t){this.e_=t}t_(t){this.n_=t}r_(t){this.i_=t}onMessage(t){this.s_=t}close(){this.Zo()}send(t){this.Yo(t)}o_(){this.e_()}__(){this.n_()}a_(t){this.i_(t)}u_(t){this.s_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const At="WebChannelConnection";class bg extends Cg{constructor(t){super(t),this.c_=[],this.forceLongPolling=t.forceLongPolling,this.autoDetectLongPolling=t.autoDetectLongPolling,this.useFetchStreams=t.useFetchStreams,this.longPollingOptions=t.longPollingOptions}Jo(t,e,r,s,o){const a=Ai();return new Promise(((l,h)=>{const d=new ul;d.setWithCredentials(!0),d.listenOnce(hl.COMPLETE,(()=>{try{switch(d.getLastErrorCode()){case Dr.NO_ERROR:const _=d.getResponseJson();O(At,`XHR for RPC '${t}' ${a} received:`,JSON.stringify(_)),l(_);break;case Dr.TIMEOUT:O(At,`RPC '${t}' ${a} timed out`),h(new x(b.DEADLINE_EXCEEDED,"Request time out"));break;case Dr.HTTP_ERROR:const v=d.getStatus();if(O(At,`RPC '${t}' ${a} failed with status:`,v,"response text:",d.getResponseText()),v>0){let C=d.getResponseJson();Array.isArray(C)&&(C=C[0]);const V=C?.error;if(V&&V.status&&V.message){const k=(function(M){const $=M.toLowerCase().replace(/_/g,"-");return Object.values(b).indexOf($)>=0?$:b.UNKNOWN})(V.status);h(new x(k,V.message))}else h(new x(b.UNKNOWN,"Server responded with status "+d.getStatus()))}else h(new x(b.UNAVAILABLE,"Connection failed."));break;default:F(9055,{l_:t,streamId:a,h_:d.getLastErrorCode(),P_:d.getLastError()})}}finally{O(At,`RPC '${t}' ${a} completed.`)}}));const m=JSON.stringify(s);O(At,`RPC '${t}' ${a} sending request:`,s),d.send(e,"POST",m,r,15)}))}T_(t,e,r){const s=Ai(),o=[this.Uo,"/","google.firestore.v1.Firestore","/",t,"/channel"],a=ml(),l=fl(),h={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},d=this.longPollingOptions.timeoutSeconds;d!==void 0&&(h.longPollingTimeout=Math.round(1e3*d)),this.useFetchStreams&&(h.useFetchStreams=!0),this.jo(h.initMessageHeaders,e,r),h.encodeInitMessageHeaders=!0;const m=o.join("");O(At,`Creating RPC '${t}' stream ${s}: ${m}`,h);const _=a.createWebChannel(m,h);this.I_(_);let v=!1,C=!1;const V=new Rg({Yo:P=>{C?O(At,`Not sending because RPC '${t}' stream ${s} is closed:`,P):(v||(O(At,`Opening RPC '${t}' stream ${s} transport.`),_.open(),v=!0),O(At,`RPC '${t}' stream ${s} sending:`,P),_.send(P))},Zo:()=>_.close()}),k=(P,M,$)=>{P.listen(M,(U=>{try{$(U)}catch(q){setTimeout((()=>{throw q}),0)}}))};return k(_,Nn.EventType.OPEN,(()=>{C||(O(At,`RPC '${t}' stream ${s} transport opened.`),V.o_())})),k(_,Nn.EventType.CLOSE,(()=>{C||(C=!0,O(At,`RPC '${t}' stream ${s} transport closed`),V.a_(),this.E_(_))})),k(_,Nn.EventType.ERROR,(P=>{C||(C=!0,rn(At,`RPC '${t}' stream ${s} transport errored. Name:`,P.name,"Message:",P.message),V.a_(new x(b.UNAVAILABLE,"The operation could not be completed")))})),k(_,Nn.EventType.MESSAGE,(P=>{if(!C){const M=P.data[0];Q(!!M,16349);const $=M,U=$?.error||$[0]?.error;if(U){O(At,`RPC '${t}' stream ${s} received error:`,U);const q=U.status;let Y=(function(p){const g=lt[p];if(g!==void 0)return Xl(g)})(q),z=U.message;Y===void 0&&(Y=b.INTERNAL,z="Unknown error status: "+q+" with message "+U.message),C=!0,V.a_(new x(Y,z)),_.close()}else O(At,`RPC '${t}' stream ${s} received:`,M),V.u_(M)}})),k(l,dl.STAT_EVENT,(P=>{P.stat===di.PROXY?O(At,`RPC '${t}' stream ${s} detected buffering proxy`):P.stat===di.NOPROXY&&O(At,`RPC '${t}' stream ${s} detected no buffering proxy`)})),setTimeout((()=>{V.__()}),0),V}terminate(){this.c_.forEach((t=>t.close())),this.c_=[]}I_(t){this.c_.push(t)}E_(t){this.c_=this.c_.filter((e=>e===t))}}function si(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ms(n){return new Dp(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ji{constructor(t,e,r=1e3,s=1.5,o=6e4){this.Mi=t,this.timerId=e,this.d_=r,this.A_=s,this.R_=o,this.V_=0,this.m_=null,this.f_=Date.now(),this.reset()}reset(){this.V_=0}g_(){this.V_=this.R_}p_(t){this.cancel();const e=Math.floor(this.V_+this.y_()),r=Math.max(0,Date.now()-this.f_),s=Math.max(0,e-r);s>0&&O("ExponentialBackoff",`Backing off for ${s} ms (base delay: ${this.V_} ms, delay with jitter: ${e} ms, last attempt: ${r} ms ago)`),this.m_=this.Mi.enqueueAfterDelay(this.timerId,s,(()=>(this.f_=Date.now(),t()))),this.V_*=this.A_,this.V_<this.d_&&(this.V_=this.d_),this.V_>this.R_&&(this.V_=this.R_)}w_(){this.m_!==null&&(this.m_.skipDelay(),this.m_=null)}cancel(){this.m_!==null&&(this.m_.cancel(),this.m_=null)}y_(){return(Math.random()-.5)*this.V_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Cc="PersistentStream";class hu{constructor(t,e,r,s,o,a,l,h){this.Mi=t,this.S_=r,this.b_=s,this.connection=o,this.authCredentialsProvider=a,this.appCheckCredentialsProvider=l,this.listener=h,this.state=0,this.D_=0,this.C_=null,this.v_=null,this.stream=null,this.F_=0,this.M_=new Ji(t,e)}x_(){return this.state===1||this.state===5||this.O_()}O_(){return this.state===2||this.state===3}start(){this.F_=0,this.state!==4?this.auth():this.N_()}async stop(){this.x_()&&await this.close(0)}B_(){this.state=0,this.M_.reset()}L_(){this.O_()&&this.C_===null&&(this.C_=this.Mi.enqueueAfterDelay(this.S_,6e4,(()=>this.k_())))}q_(t){this.Q_(),this.stream.send(t)}async k_(){if(this.O_())return this.close(0)}Q_(){this.C_&&(this.C_.cancel(),this.C_=null)}U_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(t,e){this.Q_(),this.U_(),this.M_.cancel(),this.D_++,t!==4?this.M_.reset():e&&e.code===b.RESOURCE_EXHAUSTED?(ne(e.toString()),ne("Using maximum backoff delay to prevent overloading the backend."),this.M_.g_()):e&&e.code===b.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.K_(),this.stream.close(),this.stream=null),this.state=t,await this.listener.r_(e)}K_(){}auth(){this.state=1;const t=this.W_(this.D_),e=this.D_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([r,s])=>{this.D_===e&&this.G_(r,s)}),(r=>{t((()=>{const s=new x(b.UNKNOWN,"Fetching auth token failed: "+r.message);return this.z_(s)}))}))}G_(t,e){const r=this.W_(this.D_);this.stream=this.j_(t,e),this.stream.Xo((()=>{r((()=>this.listener.Xo()))})),this.stream.t_((()=>{r((()=>(this.state=2,this.v_=this.Mi.enqueueAfterDelay(this.b_,1e4,(()=>(this.O_()&&(this.state=3),Promise.resolve()))),this.listener.t_())))})),this.stream.r_((s=>{r((()=>this.z_(s)))})),this.stream.onMessage((s=>{r((()=>++this.F_==1?this.J_(s):this.onNext(s)))}))}N_(){this.state=5,this.M_.p_((async()=>{this.state=0,this.start()}))}z_(t){return O(Cc,`close with error: ${t}`),this.stream=null,this.close(4,t)}W_(t){return e=>{this.Mi.enqueueAndForget((()=>this.D_===t?e():(O(Cc,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}}class Sg extends hu{constructor(t,e,r,s,o,a){super(t,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",e,r,s,a),this.serializer=o}j_(t,e){return this.connection.T_("Listen",t,e)}J_(t){return this.onNext(t)}onNext(t){this.M_.reset();const e=Op(this.serializer,t),r=(function(o){if(!("targetChange"in o))return j.min();const a=o.targetChange;return a.targetIds&&a.targetIds.length?j.min():a.readTime?Ft(a.readTime):j.min()})(t);return this.listener.H_(e,r)}Y_(t){const e={};e.database=wi(this.serializer),e.addTarget=(function(o,a){let l;const h=a.target;if(l=yi(h)?{documents:Lp(o,h)}:{query:Fp(o,h).ft},l.targetId=a.targetId,a.resumeToken.approximateByteSize()>0){l.resumeToken=Zl(o,a.resumeToken);const d=vi(o,a.expectedCount);d!==null&&(l.expectedCount=d)}else if(a.snapshotVersion.compareTo(j.min())>0){l.readTime=Wr(o,a.snapshotVersion.toTimestamp());const d=vi(o,a.expectedCount);d!==null&&(l.expectedCount=d)}return l})(this.serializer,t);const r=jp(this.serializer,t);r&&(e.labels=r),this.q_(e)}Z_(t){const e={};e.database=wi(this.serializer),e.removeTarget=t,this.q_(e)}}class Pg extends hu{constructor(t,e,r,s,o,a){super(t,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",e,r,s,a),this.serializer=o}get X_(){return this.F_>0}start(){this.lastStreamToken=void 0,super.start()}K_(){this.X_&&this.ea([])}j_(t,e){return this.connection.T_("Write",t,e)}J_(t){return Q(!!t.streamToken,31322),this.lastStreamToken=t.streamToken,Q(!t.writeResults||t.writeResults.length===0,55816),this.listener.ta()}onNext(t){Q(!!t.streamToken,12678),this.lastStreamToken=t.streamToken,this.M_.reset();const e=Mp(t.writeResults,t.commitTime),r=Ft(t.commitTime);return this.listener.na(r,e)}ra(){const t={};t.database=wi(this.serializer),this.q_(t)}ea(t){const e={streamToken:this.lastStreamToken,writes:t.map((r=>ru(this.serializer,r)))};this.q_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vg{}class Dg extends Vg{constructor(t,e,r,s){super(),this.authCredentials=t,this.appCheckCredentials=e,this.connection=r,this.serializer=s,this.ia=!1}sa(){if(this.ia)throw new x(b.FAILED_PRECONDITION,"The client has already been terminated.")}Go(t,e,r,s){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,a])=>this.connection.Go(t,Ti(e,r),s,o,a))).catch((o=>{throw o.name==="FirebaseError"?(o.code===b.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new x(b.UNKNOWN,o.toString())}))}Ho(t,e,r,s,o){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([a,l])=>this.connection.Ho(t,Ti(e,r),s,a,l,o))).catch((a=>{throw a.name==="FirebaseError"?(a.code===b.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),a):new x(b.UNKNOWN,a.toString())}))}terminate(){this.ia=!0,this.connection.terminate()}}class Ng{constructor(t,e){this.asyncQueue=t,this.onlineStateHandler=e,this.state="Unknown",this.oa=0,this._a=null,this.aa=!0}ua(){this.oa===0&&(this.ca("Unknown"),this._a=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this._a=null,this.la("Backend didn't respond within 10 seconds."),this.ca("Offline"),Promise.resolve()))))}ha(t){this.state==="Online"?this.ca("Unknown"):(this.oa++,this.oa>=1&&(this.Pa(),this.la(`Connection failed 1 times. Most recent error: ${t.toString()}`),this.ca("Offline")))}set(t){this.Pa(),this.oa=0,t==="Online"&&(this.aa=!1),this.ca(t)}ca(t){t!==this.state&&(this.state=t,this.onlineStateHandler(t))}la(t){const e=`Could not reach Cloud Firestore backend. ${t}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.aa?(ne(e),this.aa=!1):O("OnlineStateTracker",e)}Pa(){this._a!==null&&(this._a.cancel(),this._a=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Oe="RemoteStore";class xg{constructor(t,e,r,s,o){this.localStore=t,this.datastore=e,this.asyncQueue=r,this.remoteSyncer={},this.Ta=[],this.Ia=new Map,this.Ea=new Set,this.da=[],this.Aa=o,this.Aa.Oo((a=>{r.enqueueAndForget((async()=>{Fe(this)&&(O(Oe,"Restarting streams for network reachability change."),await(async function(h){const d=B(h);d.Ea.add(4),await rr(d),d.Ra.set("Unknown"),d.Ea.delete(4),await ps(d)})(this))}))})),this.Ra=new Ng(r,s)}}async function ps(n){if(Fe(n))for(const t of n.da)await t(!0)}async function rr(n){for(const t of n.da)await t(!1)}function du(n,t){const e=B(n);e.Ia.has(t.targetId)||(e.Ia.set(t.targetId,t),no(e)?eo(e):gn(e).O_()&&to(e,t))}function Zi(n,t){const e=B(n),r=gn(e);e.Ia.delete(t),r.O_()&&fu(e,t),e.Ia.size===0&&(r.O_()?r.L_():Fe(e)&&e.Ra.set("Unknown"))}function to(n,t){if(n.Va.Ue(t.targetId),t.resumeToken.approximateByteSize()>0||t.snapshotVersion.compareTo(j.min())>0){const e=n.remoteSyncer.getRemoteKeysForTarget(t.targetId).size;t=t.withExpectedCount(e)}gn(n).Y_(t)}function fu(n,t){n.Va.Ue(t),gn(n).Z_(t)}function eo(n){n.Va=new bp({getRemoteKeysForTarget:t=>n.remoteSyncer.getRemoteKeysForTarget(t),At:t=>n.Ia.get(t)||null,ht:()=>n.datastore.serializer.databaseId}),gn(n).start(),n.Ra.ua()}function no(n){return Fe(n)&&!gn(n).x_()&&n.Ia.size>0}function Fe(n){return B(n).Ea.size===0}function mu(n){n.Va=void 0}async function kg(n){n.Ra.set("Online")}async function Og(n){n.Ia.forEach(((t,e)=>{to(n,t)}))}async function Mg(n,t){mu(n),no(n)?(n.Ra.ha(t),eo(n)):n.Ra.set("Unknown")}async function Lg(n,t,e){if(n.Ra.set("Online"),t instanceof Jl&&t.state===2&&t.cause)try{await(async function(s,o){const a=o.cause;for(const l of o.targetIds)s.Ia.has(l)&&(await s.remoteSyncer.rejectListen(l,a),s.Ia.delete(l),s.Va.removeTarget(l))})(n,t)}catch(r){O(Oe,"Failed to remove targets %s: %s ",t.targetIds.join(","),r),await Xr(n,r)}else if(t instanceof Or?n.Va.Ze(t):t instanceof Yl?n.Va.st(t):n.Va.tt(t),!e.isEqual(j.min()))try{const r=await uu(n.localStore);e.compareTo(r)>=0&&await(function(o,a){const l=o.Va.Tt(a);return l.targetChanges.forEach(((h,d)=>{if(h.resumeToken.approximateByteSize()>0){const m=o.Ia.get(d);m&&o.Ia.set(d,m.withResumeToken(h.resumeToken,a))}})),l.targetMismatches.forEach(((h,d)=>{const m=o.Ia.get(h);if(!m)return;o.Ia.set(h,m.withResumeToken(vt.EMPTY_BYTE_STRING,m.snapshotVersion)),fu(o,h);const _=new he(m.target,h,d,m.sequenceNumber);to(o,_)})),o.remoteSyncer.applyRemoteEvent(l)})(n,e)}catch(r){O(Oe,"Failed to raise snapshot:",r),await Xr(n,r)}}async function Xr(n,t,e){if(!mn(t))throw t;n.Ea.add(1),await rr(n),n.Ra.set("Offline"),e||(e=()=>uu(n.localStore)),n.asyncQueue.enqueueRetryable((async()=>{O(Oe,"Retrying IndexedDB access"),await e(),n.Ea.delete(1),await ps(n)}))}function pu(n,t){return t().catch((e=>Xr(n,e,t)))}async function gs(n){const t=B(n),e=we(t);let r=t.Ta.length>0?t.Ta[t.Ta.length-1].batchId:$i;for(;Fg(t);)try{const s=await Eg(t.localStore,r);if(s===null){t.Ta.length===0&&e.L_();break}r=s.batchId,$g(t,s)}catch(s){await Xr(t,s)}gu(t)&&_u(t)}function Fg(n){return Fe(n)&&n.Ta.length<10}function $g(n,t){n.Ta.push(t);const e=we(n);e.O_()&&e.X_&&e.ea(t.mutations)}function gu(n){return Fe(n)&&!we(n).x_()&&n.Ta.length>0}function _u(n){we(n).start()}async function jg(n){we(n).ra()}async function Ug(n){const t=we(n);for(const e of n.Ta)t.ea(e.mutations)}async function Bg(n,t,e){const r=n.Ta.shift(),s=Hi.from(r,t,e);await pu(n,(()=>n.remoteSyncer.applySuccessfulWrite(s))),await gs(n)}async function qg(n,t){t&&we(n).X_&&await(async function(r,s){if((function(a){return Ql(a)&&a!==b.ABORTED})(s.code)){const o=r.Ta.shift();we(r).B_(),await pu(r,(()=>r.remoteSyncer.rejectFailedWrite(o.batchId,s))),await gs(r)}})(n,t),gu(n)&&_u(n)}async function Rc(n,t){const e=B(n);e.asyncQueue.verifyOperationInProgress(),O(Oe,"RemoteStore received new credentials");const r=Fe(e);e.Ea.add(3),await rr(e),r&&e.Ra.set("Unknown"),await e.remoteSyncer.handleCredentialChange(t),e.Ea.delete(3),await ps(e)}async function zg(n,t){const e=B(n);t?(e.Ea.delete(2),await ps(e)):t||(e.Ea.add(2),await rr(e),e.Ra.set("Unknown"))}function gn(n){return n.ma||(n.ma=(function(e,r,s){const o=B(e);return o.sa(),new Sg(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,s)})(n.datastore,n.asyncQueue,{Xo:kg.bind(null,n),t_:Og.bind(null,n),r_:Mg.bind(null,n),H_:Lg.bind(null,n)}),n.da.push((async t=>{t?(n.ma.B_(),no(n)?eo(n):n.Ra.set("Unknown")):(await n.ma.stop(),mu(n))}))),n.ma}function we(n){return n.fa||(n.fa=(function(e,r,s){const o=B(e);return o.sa(),new Pg(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,s)})(n.datastore,n.asyncQueue,{Xo:()=>Promise.resolve(),t_:jg.bind(null,n),r_:qg.bind(null,n),ta:Ug.bind(null,n),na:Bg.bind(null,n)}),n.da.push((async t=>{t?(n.fa.B_(),await gs(n)):(await n.fa.stop(),n.Ta.length>0&&(O(Oe,`Stopping write stream with ${n.Ta.length} pending writes`),n.Ta=[]))}))),n.fa}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ro{constructor(t,e,r,s,o){this.asyncQueue=t,this.timerId=e,this.targetTimeMs=r,this.op=s,this.removalCallback=o,this.deferred=new Wt,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((a=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(t,e,r,s,o){const a=Date.now()+r,l=new ro(t,e,a,s,o);return l.start(r),l}start(t){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),t)}skipDelay(){return this.handleDelayElapsed()}cancel(t){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new x(b.CANCELLED,"Operation cancelled"+(t?": "+t:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((t=>this.deferred.resolve(t)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function so(n,t){if(ne("AsyncQueue",`${t}: ${n}`),mn(n))return new x(b.UNAVAILABLE,`${t}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class en{static emptySet(t){return new en(t.comparator)}constructor(t){this.comparator=t?(e,r)=>t(e,r)||L.comparator(e.key,r.key):(e,r)=>L.comparator(e.key,r.key),this.keyedMap=xn(),this.sortedSet=new it(this.comparator)}has(t){return this.keyedMap.get(t)!=null}get(t){return this.keyedMap.get(t)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(t){const e=this.keyedMap.get(t);return e?this.sortedSet.indexOf(e):-1}get size(){return this.sortedSet.size}forEach(t){this.sortedSet.inorderTraversal(((e,r)=>(t(e),!1)))}add(t){const e=this.delete(t.key);return e.copy(e.keyedMap.insert(t.key,t),e.sortedSet.insert(t,null))}delete(t){const e=this.get(t);return e?this.copy(this.keyedMap.remove(t),this.sortedSet.remove(e)):this}isEqual(t){if(!(t instanceof en)||this.size!==t.size)return!1;const e=this.sortedSet.getIterator(),r=t.sortedSet.getIterator();for(;e.hasNext();){const s=e.getNext().key,o=r.getNext().key;if(!s.isEqual(o))return!1}return!0}toString(){const t=[];return this.forEach((e=>{t.push(e.toString())})),t.length===0?"DocumentSet ()":`DocumentSet (
  `+t.join(`  
`)+`
)`}copy(t,e){const r=new en;return r.comparator=this.comparator,r.keyedMap=t,r.sortedSet=e,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bc{constructor(){this.ga=new it(L.comparator)}track(t){const e=t.doc.key,r=this.ga.get(e);r?t.type!==0&&r.type===3?this.ga=this.ga.insert(e,t):t.type===3&&r.type!==1?this.ga=this.ga.insert(e,{type:r.type,doc:t.doc}):t.type===2&&r.type===2?this.ga=this.ga.insert(e,{type:2,doc:t.doc}):t.type===2&&r.type===0?this.ga=this.ga.insert(e,{type:0,doc:t.doc}):t.type===1&&r.type===0?this.ga=this.ga.remove(e):t.type===1&&r.type===2?this.ga=this.ga.insert(e,{type:1,doc:r.doc}):t.type===0&&r.type===1?this.ga=this.ga.insert(e,{type:2,doc:t.doc}):F(63341,{Rt:t,pa:r}):this.ga=this.ga.insert(e,t)}ya(){const t=[];return this.ga.inorderTraversal(((e,r)=>{t.push(r)})),t}}class ln{constructor(t,e,r,s,o,a,l,h,d){this.query=t,this.docs=e,this.oldDocs=r,this.docChanges=s,this.mutatedKeys=o,this.fromCache=a,this.syncStateChanged=l,this.excludesMetadataChanges=h,this.hasCachedResults=d}static fromInitialDocuments(t,e,r,s,o){const a=[];return e.forEach((l=>{a.push({type:0,doc:l})})),new ln(t,e,en.emptySet(e),a,r,s,!0,!1,o)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(t){if(!(this.fromCache===t.fromCache&&this.hasCachedResults===t.hasCachedResults&&this.syncStateChanged===t.syncStateChanged&&this.mutatedKeys.isEqual(t.mutatedKeys)&&ls(this.query,t.query)&&this.docs.isEqual(t.docs)&&this.oldDocs.isEqual(t.oldDocs)))return!1;const e=this.docChanges,r=t.docChanges;if(e.length!==r.length)return!1;for(let s=0;s<e.length;s++)if(e[s].type!==r[s].type||!e[s].doc.isEqual(r[s].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hg{constructor(){this.wa=void 0,this.Sa=[]}ba(){return this.Sa.some((t=>t.Da()))}}class Gg{constructor(){this.queries=Sc(),this.onlineState="Unknown",this.Ca=new Set}terminate(){(function(e,r){const s=B(e),o=s.queries;s.queries=Sc(),o.forEach(((a,l)=>{for(const h of l.Sa)h.onError(r)}))})(this,new x(b.ABORTED,"Firestore shutting down"))}}function Sc(){return new Le((n=>Ml(n)),ls)}async function io(n,t){const e=B(n);let r=3;const s=t.query;let o=e.queries.get(s);o?!o.ba()&&t.Da()&&(r=2):(o=new Hg,r=t.Da()?0:1);try{switch(r){case 0:o.wa=await e.onListen(s,!0);break;case 1:o.wa=await e.onListen(s,!1);break;case 2:await e.onFirstRemoteStoreListen(s)}}catch(a){const l=so(a,`Initialization of query '${Qe(t.query)}' failed`);return void t.onError(l)}e.queries.set(s,o),o.Sa.push(t),t.va(e.onlineState),o.wa&&t.Fa(o.wa)&&ao(e)}async function oo(n,t){const e=B(n),r=t.query;let s=3;const o=e.queries.get(r);if(o){const a=o.Sa.indexOf(t);a>=0&&(o.Sa.splice(a,1),o.Sa.length===0?s=t.Da()?0:1:!o.ba()&&t.Da()&&(s=2))}switch(s){case 0:return e.queries.delete(r),e.onUnlisten(r,!0);case 1:return e.queries.delete(r),e.onUnlisten(r,!1);case 2:return e.onLastRemoteStoreUnlisten(r);default:return}}function Wg(n,t){const e=B(n);let r=!1;for(const s of t){const o=s.query,a=e.queries.get(o);if(a){for(const l of a.Sa)l.Fa(s)&&(r=!0);a.wa=s}}r&&ao(e)}function Kg(n,t,e){const r=B(n),s=r.queries.get(t);if(s)for(const o of s.Sa)o.onError(e);r.queries.delete(t)}function ao(n){n.Ca.forEach((t=>{t.next()}))}var Ci,Pc;(Pc=Ci||(Ci={})).Ma="default",Pc.Cache="cache";class co{constructor(t,e,r){this.query=t,this.xa=e,this.Oa=!1,this.Na=null,this.onlineState="Unknown",this.options=r||{}}Fa(t){if(!this.options.includeMetadataChanges){const r=[];for(const s of t.docChanges)s.type!==3&&r.push(s);t=new ln(t.query,t.docs,t.oldDocs,r,t.mutatedKeys,t.fromCache,t.syncStateChanged,!0,t.hasCachedResults)}let e=!1;return this.Oa?this.Ba(t)&&(this.xa.next(t),e=!0):this.La(t,this.onlineState)&&(this.ka(t),e=!0),this.Na=t,e}onError(t){this.xa.error(t)}va(t){this.onlineState=t;let e=!1;return this.Na&&!this.Oa&&this.La(this.Na,t)&&(this.ka(this.Na),e=!0),e}La(t,e){if(!t.fromCache||!this.Da())return!0;const r=e!=="Offline";return(!this.options.qa||!r)&&(!t.docs.isEmpty()||t.hasCachedResults||e==="Offline")}Ba(t){if(t.docChanges.length>0)return!0;const e=this.Na&&this.Na.hasPendingWrites!==t.hasPendingWrites;return!(!t.syncStateChanged&&!e)&&this.options.includeMetadataChanges===!0}ka(t){t=ln.fromInitialDocuments(t.query,t.docs,t.mutatedKeys,t.fromCache,t.hasCachedResults),this.Oa=!0,this.xa.next(t)}Da(){return this.options.source!==Ci.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yu{constructor(t){this.key=t}}class Eu{constructor(t){this.key=t}}class Qg{constructor(t,e){this.query=t,this.Ya=e,this.Za=null,this.hasCachedResults=!1,this.current=!1,this.Xa=G(),this.mutatedKeys=G(),this.eu=Ll(t),this.tu=new en(this.eu)}get nu(){return this.Ya}ru(t,e){const r=e?e.iu:new bc,s=e?e.tu:this.tu;let o=e?e.mutatedKeys:this.mutatedKeys,a=s,l=!1;const h=this.query.limitType==="F"&&s.size===this.query.limit?s.last():null,d=this.query.limitType==="L"&&s.size===this.query.limit?s.first():null;if(t.inorderTraversal(((m,_)=>{const v=s.get(m),C=us(this.query,_)?_:null,V=!!v&&this.mutatedKeys.has(v.key),k=!!C&&(C.hasLocalMutations||this.mutatedKeys.has(C.key)&&C.hasCommittedMutations);let P=!1;v&&C?v.data.isEqual(C.data)?V!==k&&(r.track({type:3,doc:C}),P=!0):this.su(v,C)||(r.track({type:2,doc:C}),P=!0,(h&&this.eu(C,h)>0||d&&this.eu(C,d)<0)&&(l=!0)):!v&&C?(r.track({type:0,doc:C}),P=!0):v&&!C&&(r.track({type:1,doc:v}),P=!0,(h||d)&&(l=!0)),P&&(C?(a=a.add(C),o=k?o.add(m):o.delete(m)):(a=a.delete(m),o=o.delete(m)))})),this.query.limit!==null)for(;a.size>this.query.limit;){const m=this.query.limitType==="F"?a.last():a.first();a=a.delete(m.key),o=o.delete(m.key),r.track({type:1,doc:m})}return{tu:a,iu:r,Cs:l,mutatedKeys:o}}su(t,e){return t.hasLocalMutations&&e.hasCommittedMutations&&!e.hasLocalMutations}applyChanges(t,e,r,s){const o=this.tu;this.tu=t.tu,this.mutatedKeys=t.mutatedKeys;const a=t.iu.ya();a.sort(((m,_)=>(function(C,V){const k=P=>{switch(P){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return F(20277,{Rt:P})}};return k(C)-k(V)})(m.type,_.type)||this.eu(m.doc,_.doc))),this.ou(r),s=s??!1;const l=e&&!s?this._u():[],h=this.Xa.size===0&&this.current&&!s?1:0,d=h!==this.Za;return this.Za=h,a.length!==0||d?{snapshot:new ln(this.query,t.tu,o,a,t.mutatedKeys,h===0,d,!1,!!r&&r.resumeToken.approximateByteSize()>0),au:l}:{au:l}}va(t){return this.current&&t==="Offline"?(this.current=!1,this.applyChanges({tu:this.tu,iu:new bc,mutatedKeys:this.mutatedKeys,Cs:!1},!1)):{au:[]}}uu(t){return!this.Ya.has(t)&&!!this.tu.has(t)&&!this.tu.get(t).hasLocalMutations}ou(t){t&&(t.addedDocuments.forEach((e=>this.Ya=this.Ya.add(e))),t.modifiedDocuments.forEach((e=>{})),t.removedDocuments.forEach((e=>this.Ya=this.Ya.delete(e))),this.current=t.current)}_u(){if(!this.current)return[];const t=this.Xa;this.Xa=G(),this.tu.forEach((r=>{this.uu(r.key)&&(this.Xa=this.Xa.add(r.key))}));const e=[];return t.forEach((r=>{this.Xa.has(r)||e.push(new Eu(r))})),this.Xa.forEach((r=>{t.has(r)||e.push(new yu(r))})),e}cu(t){this.Ya=t.Qs,this.Xa=G();const e=this.ru(t.documents);return this.applyChanges(e,!0)}lu(){return ln.fromInitialDocuments(this.query,this.tu,this.mutatedKeys,this.Za===0,this.hasCachedResults)}}const lo="SyncEngine";class Xg{constructor(t,e,r){this.query=t,this.targetId=e,this.view=r}}class Yg{constructor(t){this.key=t,this.hu=!1}}class Jg{constructor(t,e,r,s,o,a){this.localStore=t,this.remoteStore=e,this.eventManager=r,this.sharedClientState=s,this.currentUser=o,this.maxConcurrentLimboResolutions=a,this.Pu={},this.Tu=new Le((l=>Ml(l)),ls),this.Iu=new Map,this.Eu=new Set,this.du=new it(L.comparator),this.Au=new Map,this.Ru=new Ki,this.Vu={},this.mu=new Map,this.fu=cn.cr(),this.onlineState="Unknown",this.gu=void 0}get isPrimaryClient(){return this.gu===!0}}async function Zg(n,t,e=!0){const r=Cu(n);let s;const o=r.Tu.get(t);return o?(r.sharedClientState.addLocalQueryTarget(o.targetId),s=o.view.lu()):s=await vu(r,t,e,!0),s}async function t_(n,t){const e=Cu(n);await vu(e,t,!0,!1)}async function vu(n,t,e,r){const s=await vg(n.localStore,Kt(t)),o=s.targetId,a=n.sharedClientState.addLocalQueryTarget(o,e);let l;return r&&(l=await e_(n,t,o,a==="current",s.resumeToken)),n.isPrimaryClient&&e&&du(n.remoteStore,s),l}async function e_(n,t,e,r,s){n.pu=(_,v,C)=>(async function(k,P,M,$){let U=P.view.ru(M);U.Cs&&(U=await Tc(k.localStore,P.query,!1).then((({documents:w})=>P.view.ru(w,U))));const q=$&&$.targetChanges.get(P.targetId),Y=$&&$.targetMismatches.get(P.targetId)!=null,z=P.view.applyChanges(U,k.isPrimaryClient,q,Y);return Dc(k,P.targetId,z.au),z.snapshot})(n,_,v,C);const o=await Tc(n.localStore,t,!0),a=new Qg(t,o.Qs),l=a.ru(o.documents),h=nr.createSynthesizedTargetChangeForCurrentChange(e,r&&n.onlineState!=="Offline",s),d=a.applyChanges(l,n.isPrimaryClient,h);Dc(n,e,d.au);const m=new Xg(t,e,a);return n.Tu.set(t,m),n.Iu.has(e)?n.Iu.get(e).push(t):n.Iu.set(e,[t]),d.snapshot}async function n_(n,t,e){const r=B(n),s=r.Tu.get(t),o=r.Iu.get(s.targetId);if(o.length>1)return r.Iu.set(s.targetId,o.filter((a=>!ls(a,t)))),void r.Tu.delete(t);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(s.targetId),r.sharedClientState.isActiveQueryTarget(s.targetId)||await Ii(r.localStore,s.targetId,!1).then((()=>{r.sharedClientState.clearQueryState(s.targetId),e&&Zi(r.remoteStore,s.targetId),Ri(r,s.targetId)})).catch(fn)):(Ri(r,s.targetId),await Ii(r.localStore,s.targetId,!0))}async function r_(n,t){const e=B(n),r=e.Tu.get(t),s=e.Iu.get(r.targetId);e.isPrimaryClient&&s.length===1&&(e.sharedClientState.removeLocalQueryTarget(r.targetId),Zi(e.remoteStore,r.targetId))}async function s_(n,t,e){const r=h_(n);try{const s=await(function(a,l){const h=B(a),d=et.now(),m=l.reduce(((C,V)=>C.add(V.key)),G());let _,v;return h.persistence.runTransaction("Locally write mutations","readwrite",(C=>{let V=re(),k=G();return h.Ns.getEntries(C,m).next((P=>{V=P,V.forEach(((M,$)=>{$.isValidDocument()||(k=k.add(M))}))})).next((()=>h.localDocuments.getOverlayedDocuments(C,V))).next((P=>{_=P;const M=[];for(const $ of l){const U=Tp($,_.get($.key).overlayedDocument);U!=null&&M.push(new Ce($.key,U,Sl(U.value.mapValue),ht.exists(!0)))}return h.mutationQueue.addMutationBatch(C,d,M,l)})).next((P=>{v=P;const M=P.applyToLocalDocumentSet(_,k);return h.documentOverlayCache.saveOverlays(C,P.batchId,M)}))})).then((()=>({batchId:v.batchId,changes:$l(_)})))})(r.localStore,t);r.sharedClientState.addPendingMutation(s.batchId),(function(a,l,h){let d=a.Vu[a.currentUser.toKey()];d||(d=new it(H)),d=d.insert(l,h),a.Vu[a.currentUser.toKey()]=d})(r,s.batchId,e),await sr(r,s.changes),await gs(r.remoteStore)}catch(s){const o=so(s,"Failed to persist write");e.reject(o)}}async function Tu(n,t){const e=B(n);try{const r=await _g(e.localStore,t);t.targetChanges.forEach(((s,o)=>{const a=e.Au.get(o);a&&(Q(s.addedDocuments.size+s.modifiedDocuments.size+s.removedDocuments.size<=1,22616),s.addedDocuments.size>0?a.hu=!0:s.modifiedDocuments.size>0?Q(a.hu,14607):s.removedDocuments.size>0&&(Q(a.hu,42227),a.hu=!1))})),await sr(e,r,t)}catch(r){await fn(r)}}function Vc(n,t,e){const r=B(n);if(r.isPrimaryClient&&e===0||!r.isPrimaryClient&&e===1){const s=[];r.Tu.forEach(((o,a)=>{const l=a.view.va(t);l.snapshot&&s.push(l.snapshot)})),(function(a,l){const h=B(a);h.onlineState=l;let d=!1;h.queries.forEach(((m,_)=>{for(const v of _.Sa)v.va(l)&&(d=!0)})),d&&ao(h)})(r.eventManager,t),s.length&&r.Pu.H_(s),r.onlineState=t,r.isPrimaryClient&&r.sharedClientState.setOnlineState(t)}}async function i_(n,t,e){const r=B(n);r.sharedClientState.updateQueryState(t,"rejected",e);const s=r.Au.get(t),o=s&&s.key;if(o){let a=new it(L.comparator);a=a.insert(o,gt.newNoDocument(o,j.min()));const l=G().add(o),h=new fs(j.min(),new Map,new it(H),a,l);await Tu(r,h),r.du=r.du.remove(o),r.Au.delete(t),uo(r)}else await Ii(r.localStore,t,!1).then((()=>Ri(r,t,e))).catch(fn)}async function o_(n,t){const e=B(n),r=t.batch.batchId;try{const s=await gg(e.localStore,t);Iu(e,r,null),wu(e,r),e.sharedClientState.updateMutationState(r,"acknowledged"),await sr(e,s)}catch(s){await fn(s)}}async function a_(n,t,e){const r=B(n);try{const s=await(function(a,l){const h=B(a);return h.persistence.runTransaction("Reject batch","readwrite-primary",(d=>{let m;return h.mutationQueue.lookupMutationBatch(d,l).next((_=>(Q(_!==null,37113),m=_.keys(),h.mutationQueue.removeMutationBatch(d,_)))).next((()=>h.mutationQueue.performConsistencyCheck(d))).next((()=>h.documentOverlayCache.removeOverlaysForBatchId(d,m,l))).next((()=>h.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(d,m))).next((()=>h.localDocuments.getDocuments(d,m)))}))})(r.localStore,t);Iu(r,t,e),wu(r,t),r.sharedClientState.updateMutationState(t,"rejected",e),await sr(r,s)}catch(s){await fn(s)}}function wu(n,t){(n.mu.get(t)||[]).forEach((e=>{e.resolve()})),n.mu.delete(t)}function Iu(n,t,e){const r=B(n);let s=r.Vu[r.currentUser.toKey()];if(s){const o=s.get(t);o&&(e?o.reject(e):o.resolve(),s=s.remove(t)),r.Vu[r.currentUser.toKey()]=s}}function Ri(n,t,e=null){n.sharedClientState.removeLocalQueryTarget(t);for(const r of n.Iu.get(t))n.Tu.delete(r),e&&n.Pu.yu(r,e);n.Iu.delete(t),n.isPrimaryClient&&n.Ru.jr(t).forEach((r=>{n.Ru.containsKey(r)||Au(n,r)}))}function Au(n,t){n.Eu.delete(t.path.canonicalString());const e=n.du.get(t);e!==null&&(Zi(n.remoteStore,e),n.du=n.du.remove(t),n.Au.delete(e),uo(n))}function Dc(n,t,e){for(const r of e)r instanceof yu?(n.Ru.addReference(r.key,t),c_(n,r)):r instanceof Eu?(O(lo,"Document no longer in limbo: "+r.key),n.Ru.removeReference(r.key,t),n.Ru.containsKey(r.key)||Au(n,r.key)):F(19791,{wu:r})}function c_(n,t){const e=t.key,r=e.path.canonicalString();n.du.get(e)||n.Eu.has(r)||(O(lo,"New document in limbo: "+e),n.Eu.add(r),uo(n))}function uo(n){for(;n.Eu.size>0&&n.du.size<n.maxConcurrentLimboResolutions;){const t=n.Eu.values().next().value;n.Eu.delete(t);const e=new L(J.fromString(t)),r=n.fu.next();n.Au.set(r,new Yg(e)),n.du=n.du.insert(e,r),du(n.remoteStore,new he(Kt(cs(e.path)),r,"TargetPurposeLimboResolution",os.ce))}}async function sr(n,t,e){const r=B(n),s=[],o=[],a=[];r.Tu.isEmpty()||(r.Tu.forEach(((l,h)=>{a.push(r.pu(h,t,e).then((d=>{if((d||e)&&r.isPrimaryClient){const m=d?!d.fromCache:e?.targetChanges.get(h.targetId)?.current;r.sharedClientState.updateQueryState(h.targetId,m?"current":"not-current")}if(d){s.push(d);const m=Xi.As(h.targetId,d);o.push(m)}})))})),await Promise.all(a),r.Pu.H_(s),await(async function(h,d){const m=B(h);try{await m.persistence.runTransaction("notifyLocalViewChanges","readwrite",(_=>S.forEach(d,(v=>S.forEach(v.Es,(C=>m.persistence.referenceDelegate.addReference(_,v.targetId,C))).next((()=>S.forEach(v.ds,(C=>m.persistence.referenceDelegate.removeReference(_,v.targetId,C)))))))))}catch(_){if(!mn(_))throw _;O(Yi,"Failed to update sequence numbers: "+_)}for(const _ of d){const v=_.targetId;if(!_.fromCache){const C=m.Ms.get(v),V=C.snapshotVersion,k=C.withLastLimboFreeSnapshotVersion(V);m.Ms=m.Ms.insert(v,k)}}})(r.localStore,o))}async function l_(n,t){const e=B(n);if(!e.currentUser.isEqual(t)){O(lo,"User change. New user:",t.toKey());const r=await lu(e.localStore,t);e.currentUser=t,(function(o,a){o.mu.forEach((l=>{l.forEach((h=>{h.reject(new x(b.CANCELLED,a))}))})),o.mu.clear()})(e,"'waitForPendingWrites' promise is rejected due to a user change."),e.sharedClientState.handleUserChange(t,r.removedBatchIds,r.addedBatchIds),await sr(e,r.Ls)}}function u_(n,t){const e=B(n),r=e.Au.get(t);if(r&&r.hu)return G().add(r.key);{let s=G();const o=e.Iu.get(t);if(!o)return s;for(const a of o){const l=e.Tu.get(a);s=s.unionWith(l.view.nu)}return s}}function Cu(n){const t=B(n);return t.remoteStore.remoteSyncer.applyRemoteEvent=Tu.bind(null,t),t.remoteStore.remoteSyncer.getRemoteKeysForTarget=u_.bind(null,t),t.remoteStore.remoteSyncer.rejectListen=i_.bind(null,t),t.Pu.H_=Wg.bind(null,t.eventManager),t.Pu.yu=Kg.bind(null,t.eventManager),t}function h_(n){const t=B(n);return t.remoteStore.remoteSyncer.applySuccessfulWrite=o_.bind(null,t),t.remoteStore.remoteSyncer.rejectFailedWrite=a_.bind(null,t),t}class Yr{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(t){this.serializer=ms(t.databaseInfo.databaseId),this.sharedClientState=this.Du(t),this.persistence=this.Cu(t),await this.persistence.start(),this.localStore=this.vu(t),this.gcScheduler=this.Fu(t,this.localStore),this.indexBackfillerScheduler=this.Mu(t,this.localStore)}Fu(t,e){return null}Mu(t,e){return null}vu(t){return pg(this.persistence,new dg,t.initialUser,this.serializer)}Cu(t){return new cu(Qi.mi,this.serializer)}Du(t){return new wg}async terminate(){this.gcScheduler?.stop(),this.indexBackfillerScheduler?.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}Yr.provider={build:()=>new Yr};class d_ extends Yr{constructor(t){super(),this.cacheSizeBytes=t}Fu(t,e){Q(this.persistence.referenceDelegate instanceof Qr,46915);const r=this.persistence.referenceDelegate.garbageCollector;return new Yp(r,t.asyncQueue,e)}Cu(t){const e=this.cacheSizeBytes!==void 0?xt.withCacheSize(this.cacheSizeBytes):xt.DEFAULT;return new cu((r=>Qr.mi(r,e)),this.serializer)}}class bi{async initialize(t,e){this.localStore||(this.localStore=t.localStore,this.sharedClientState=t.sharedClientState,this.datastore=this.createDatastore(e),this.remoteStore=this.createRemoteStore(e),this.eventManager=this.createEventManager(e),this.syncEngine=this.createSyncEngine(e,!t.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>Vc(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=l_.bind(null,this.syncEngine),await zg(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(t){return(function(){return new Gg})()}createDatastore(t){const e=ms(t.databaseInfo.databaseId),r=(function(o){return new bg(o)})(t.databaseInfo);return(function(o,a,l,h){return new Dg(o,a,l,h)})(t.authCredentials,t.appCheckCredentials,r,e)}createRemoteStore(t){return(function(r,s,o,a,l){return new xg(r,s,o,a,l)})(this.localStore,this.datastore,t.asyncQueue,(e=>Vc(this.syncEngine,e,0)),(function(){return Ac.v()?new Ac:new Ig})())}createSyncEngine(t,e){return(function(s,o,a,l,h,d,m){const _=new Jg(s,o,a,l,h,d);return m&&(_.gu=!0),_})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,t.initialUser,t.maxConcurrentLimboResolutions,e)}async terminate(){await(async function(e){const r=B(e);O(Oe,"RemoteStore shutting down."),r.Ea.add(5),await rr(r),r.Aa.shutdown(),r.Ra.set("Unknown")})(this.remoteStore),this.datastore?.terminate(),this.eventManager?.terminate()}}bi.provider={build:()=>new bi};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ho{constructor(t){this.observer=t,this.muted=!1}next(t){this.muted||this.observer.next&&this.Ou(this.observer.next,t)}error(t){this.muted||(this.observer.error?this.Ou(this.observer.error,t):ne("Uncaught Error in snapshot listener:",t.toString()))}Nu(){this.muted=!0}Ou(t,e){setTimeout((()=>{this.muted||t(e)}),0)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class f_{constructor(t){this.datastore=t,this.readVersions=new Map,this.mutations=[],this.committed=!1,this.lastTransactionError=null,this.writtenDocs=new Set}async lookup(t){if(this.ensureCommitNotCalled(),this.mutations.length>0)throw this.lastTransactionError=new x(b.INVALID_ARGUMENT,"Firestore transactions require all reads to be executed before all writes."),this.lastTransactionError;const e=await(async function(s,o){const a=B(s),l={documents:o.map((_=>Kr(a.serializer,_)))},h=await a.Ho("BatchGetDocuments",a.serializer.databaseId,J.emptyPath(),l,o.length),d=new Map;h.forEach((_=>{const v=kp(a.serializer,_);d.set(v.key.toString(),v)}));const m=[];return o.forEach((_=>{const v=d.get(_.toString());Q(!!v,55234,{key:_}),m.push(v)})),m})(this.datastore,t);return e.forEach((r=>this.recordVersion(r))),e}set(t,e){this.write(e.toMutation(t,this.precondition(t))),this.writtenDocs.add(t.toString())}update(t,e){try{this.write(e.toMutation(t,this.preconditionForUpdate(t)))}catch(r){this.lastTransactionError=r}this.writtenDocs.add(t.toString())}delete(t){this.write(new er(t,this.precondition(t))),this.writtenDocs.add(t.toString())}async commit(){if(this.ensureCommitNotCalled(),this.lastTransactionError)throw this.lastTransactionError;const t=this.readVersions;this.mutations.forEach((e=>{t.delete(e.key.toString())})),t.forEach(((e,r)=>{const s=L.fromPath(r);this.mutations.push(new Kl(s,this.precondition(s)))})),await(async function(r,s){const o=B(r),a={writes:s.map((l=>ru(o.serializer,l)))};await o.Go("Commit",o.serializer.databaseId,J.emptyPath(),a)})(this.datastore,this.mutations),this.committed=!0}recordVersion(t){let e;if(t.isFoundDocument())e=t.version;else{if(!t.isNoDocument())throw F(50498,{Gu:t.constructor.name});e=j.min()}const r=this.readVersions.get(t.key.toString());if(r){if(!e.isEqual(r))throw new x(b.ABORTED,"Document version changed between two reads.")}else this.readVersions.set(t.key.toString(),e)}precondition(t){const e=this.readVersions.get(t.toString());return!this.writtenDocs.has(t.toString())&&e?e.isEqual(j.min())?ht.exists(!1):ht.updateTime(e):ht.none()}preconditionForUpdate(t){const e=this.readVersions.get(t.toString());if(!this.writtenDocs.has(t.toString())&&e){if(e.isEqual(j.min()))throw new x(b.INVALID_ARGUMENT,"Can't update a document that doesn't exist.");return ht.updateTime(e)}return ht.exists(!0)}write(t){this.ensureCommitNotCalled(),this.mutations.push(t)}ensureCommitNotCalled(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class m_{constructor(t,e,r,s,o){this.asyncQueue=t,this.datastore=e,this.options=r,this.updateFunction=s,this.deferred=o,this.zu=r.maxAttempts,this.M_=new Ji(this.asyncQueue,"transaction_retry")}ju(){this.zu-=1,this.Ju()}Ju(){this.M_.p_((async()=>{const t=new f_(this.datastore),e=this.Hu(t);e&&e.then((r=>{this.asyncQueue.enqueueAndForget((()=>t.commit().then((()=>{this.deferred.resolve(r)})).catch((s=>{this.Yu(s)}))))})).catch((r=>{this.Yu(r)}))}))}Hu(t){try{const e=this.updateFunction(t);return!Zn(e)&&e.catch&&e.then?e:(this.deferred.reject(Error("Transaction callback must return a Promise")),null)}catch(e){return this.deferred.reject(e),null}}Yu(t){this.zu>0&&this.Zu(t)?(this.zu-=1,this.asyncQueue.enqueueAndForget((()=>(this.Ju(),Promise.resolve())))):this.deferred.reject(t)}Zu(t){if(t?.name==="FirebaseError"){const e=t.code;return e==="aborted"||e==="failed-precondition"||e==="already-exists"||!Ql(e)}return!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ie="FirestoreClient";class p_{constructor(t,e,r,s,o){this.authCredentials=t,this.appCheckCredentials=e,this.asyncQueue=r,this.databaseInfo=s,this.user=Ct.UNAUTHENTICATED,this.clientId=Fi.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=o,this.authCredentials.start(r,(async a=>{O(Ie,"Received user=",a.uid),await this.authCredentialListener(a),this.user=a})),this.appCheckCredentials.start(r,(a=>(O(Ie,"Received new app check token=",a),this.appCheckCredentialListener(a,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this.databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(t){this.authCredentialListener=t}setAppCheckTokenChangeListener(t){this.appCheckCredentialListener=t}terminate(){this.asyncQueue.enterRestrictedMode();const t=new Wt;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),t.resolve()}catch(e){const r=so(e,"Failed to shutdown persistence");t.reject(r)}})),t.promise}}async function ii(n,t){n.asyncQueue.verifyOperationInProgress(),O(Ie,"Initializing OfflineComponentProvider");const e=n.configuration;await t.initialize(e);let r=e.initialUser;n.setCredentialChangeListener((async s=>{r.isEqual(s)||(await lu(t.localStore,s),r=s)})),t.persistence.setDatabaseDeletedListener((()=>n.terminate())),n._offlineComponents=t}async function Nc(n,t){n.asyncQueue.verifyOperationInProgress();const e=await g_(n);O(Ie,"Initializing OnlineComponentProvider"),await t.initialize(e,n.configuration),n.setCredentialChangeListener((r=>Rc(t.remoteStore,r))),n.setAppCheckTokenChangeListener(((r,s)=>Rc(t.remoteStore,s))),n._onlineComponents=t}async function g_(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){O(Ie,"Using user provided OfflineComponentProvider");try{await ii(n,n._uninitializedComponentsProvider._offline)}catch(t){const e=t;if(!(function(s){return s.name==="FirebaseError"?s.code===b.FAILED_PRECONDITION||s.code===b.UNIMPLEMENTED:!(typeof DOMException<"u"&&s instanceof DOMException)||s.code===22||s.code===20||s.code===11})(e))throw e;rn("Error using user provided cache. Falling back to memory cache: "+e),await ii(n,new Yr)}}else O(Ie,"Using default OfflineComponentProvider"),await ii(n,new d_(void 0));return n._offlineComponents}async function fo(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(O(Ie,"Using user provided OnlineComponentProvider"),await Nc(n,n._uninitializedComponentsProvider._online)):(O(Ie,"Using default OnlineComponentProvider"),await Nc(n,new bi))),n._onlineComponents}function __(n){return fo(n).then((t=>t.syncEngine))}function y_(n){return fo(n).then((t=>t.datastore))}async function Jr(n){const t=await fo(n),e=t.eventManager;return e.onListen=Zg.bind(null,t.syncEngine),e.onUnlisten=n_.bind(null,t.syncEngine),e.onFirstRemoteStoreListen=t_.bind(null,t.syncEngine),e.onLastRemoteStoreUnlisten=r_.bind(null,t.syncEngine),e}function E_(n,t,e={}){const r=new Wt;return n.asyncQueue.enqueueAndForget((async()=>(function(o,a,l,h,d){const m=new ho({next:v=>{m.Nu(),a.enqueueAndForget((()=>oo(o,_)));const C=v.docs.has(l);!C&&v.fromCache?d.reject(new x(b.UNAVAILABLE,"Failed to get document because the client is offline.")):C&&v.fromCache&&h&&h.source==="server"?d.reject(new x(b.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):d.resolve(v)},error:v=>d.reject(v)}),_=new co(cs(l.path),m,{includeMetadataChanges:!0,qa:!0});return io(o,_)})(await Jr(n),n.asyncQueue,t,e,r))),r.promise}function v_(n,t,e={}){const r=new Wt;return n.asyncQueue.enqueueAndForget((async()=>(function(o,a,l,h,d){const m=new ho({next:v=>{m.Nu(),a.enqueueAndForget((()=>oo(o,_))),v.fromCache&&h.source==="server"?d.reject(new x(b.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):d.resolve(v)},error:v=>d.reject(v)}),_=new co(l,m,{includeMetadataChanges:!0,qa:!0});return io(o,_)})(await Jr(n),n.asyncQueue,t,e,r))),r.promise}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ru(n){const t={};return n.timeoutSeconds!==void 0&&(t.timeoutSeconds=n.timeoutSeconds),t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xc=new Map;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bu="firestore.googleapis.com",kc=!0;class Oc{constructor(t){if(t.host===void 0){if(t.ssl!==void 0)throw new x(b.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=bu,this.ssl=kc}else this.host=t.host,this.ssl=t.ssl??kc;if(this.isUsingEmulator=t.emulatorOptions!==void 0,this.credentials=t.credentials,this.ignoreUndefinedProperties=!!t.ignoreUndefinedProperties,this.localCache=t.localCache,t.cacheSizeBytes===void 0)this.cacheSizeBytes=au;else{if(t.cacheSizeBytes!==-1&&t.cacheSizeBytes<Qp)throw new x(b.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=t.cacheSizeBytes}xm("experimentalForceLongPolling",t.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",t.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!t.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:t.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!t.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Ru(t.experimentalLongPollingOptions??{}),(function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new x(b.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new x(b.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new x(b.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!t.useFetchStreams}isEqual(t){return this.host===t.host&&this.ssl===t.ssl&&this.credentials===t.credentials&&this.cacheSizeBytes===t.cacheSizeBytes&&this.experimentalForceLongPolling===t.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===t.experimentalAutoDetectLongPolling&&(function(r,s){return r.timeoutSeconds===s.timeoutSeconds})(this.experimentalLongPollingOptions,t.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===t.ignoreUndefinedProperties&&this.useFetchStreams===t.useFetchStreams}}class _s{constructor(t,e,r,s){this._authCredentials=t,this._appCheckCredentials=e,this._databaseId=r,this._app=s,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Oc({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new x(b.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(t){if(this._settingsFrozen)throw new x(b.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Oc(t),this._emulatorOptions=t.emulatorOptions||{},t.credentials!==void 0&&(this._authCredentials=(function(r){if(!r)return new Im;switch(r.type){case"firstParty":return new bm(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new x(b.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(t.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(e){const r=xc.get(e);r&&(O("ComponentProvider","Removing Datastore"),xc.delete(e),r.terminate())})(this),Promise.resolve()}}function T_(n,t,e,r={}){n=Rt(n,_s);const s=Oi(t),o=n._getSettings(),a={...o,emulatorOptions:n._getEmulatorOptions()},l=`${t}:${e}`;s&&(Yd(`https://${l}`),ef("Firestore",!0)),o.host!==bu&&o.host!==l&&rn("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const h={...o,host:l,ssl:s,emulatorOptions:r};if(!Fr(h,a)&&(n._setSettings(h),r.mockUserToken)){let d,m;if(typeof r.mockUserToken=="string")d=r.mockUserToken,m=Ct.MOCK_USER;else{d=Jd(r.mockUserToken,n._app?.options.projectId);const _=r.mockUserToken.sub||r.mockUserToken.user_id;if(!_)throw new x(b.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");m=new Ct(_)}n._authCredentials=new Am(new gl(d,m))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class se{constructor(t,e,r){this.converter=e,this._query=r,this.type="query",this.firestore=t}withConverter(t){return new se(this.firestore,t,this._query)}}class st{constructor(t,e,r){this.converter=e,this._key=r,this.type="document",this.firestore=t}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new ge(this.firestore,this.converter,this._key.path.popLast())}withConverter(t){return new st(this.firestore,t,this._key)}toJSON(){return{type:st._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(t,e,r){if(Jn(e,st._jsonSchema))return new st(t,r||null,new L(J.fromString(e.referencePath)))}}st._jsonSchemaVersion="firestore/documentReference/1.0",st._jsonSchema={type:dt("string",st._jsonSchemaVersion),referencePath:dt("string")};class ge extends se{constructor(t,e,r){super(t,e,cs(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const t=this._path.popLast();return t.isEmpty()?null:new st(this.firestore,null,new L(t))}withConverter(t){return new ge(this.firestore,t,this._path)}}function Y_(n,t,...e){if(n=$t(n),_l("collection","path",t),n instanceof _s){const r=J.fromString(t,...e);return Ka(r),new ge(n,null,r)}{if(!(n instanceof st||n instanceof ge))throw new x(b.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(J.fromString(t,...e));return Ka(r),new ge(n.firestore,null,r)}}function w_(n,t,...e){if(n=$t(n),arguments.length===1&&(t=Fi.newId()),_l("doc","path",t),n instanceof _s){const r=J.fromString(t,...e);return Wa(r),new st(n,null,new L(r))}{if(!(n instanceof st||n instanceof ge))throw new x(b.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(J.fromString(t,...e));return Wa(r),new st(n.firestore,n instanceof ge?n.converter:null,new L(r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Mc="AsyncQueue";class Lc{constructor(t=Promise.resolve()){this.Xu=[],this.ec=!1,this.tc=[],this.nc=null,this.rc=!1,this.sc=!1,this.oc=[],this.M_=new Ji(this,"async_queue_retry"),this._c=()=>{const r=si();r&&O(Mc,"Visibility state changed to "+r.visibilityState),this.M_.w_()},this.ac=t;const e=si();e&&typeof e.addEventListener=="function"&&e.addEventListener("visibilitychange",this._c)}get isShuttingDown(){return this.ec}enqueueAndForget(t){this.enqueue(t)}enqueueAndForgetEvenWhileRestricted(t){this.uc(),this.cc(t)}enterRestrictedMode(t){if(!this.ec){this.ec=!0,this.sc=t||!1;const e=si();e&&typeof e.removeEventListener=="function"&&e.removeEventListener("visibilitychange",this._c)}}enqueue(t){if(this.uc(),this.ec)return new Promise((()=>{}));const e=new Wt;return this.cc((()=>this.ec&&this.sc?Promise.resolve():(t().then(e.resolve,e.reject),e.promise))).then((()=>e.promise))}enqueueRetryable(t){this.enqueueAndForget((()=>(this.Xu.push(t),this.lc())))}async lc(){if(this.Xu.length!==0){try{await this.Xu[0](),this.Xu.shift(),this.M_.reset()}catch(t){if(!mn(t))throw t;O(Mc,"Operation failed with retryable error: "+t)}this.Xu.length>0&&this.M_.p_((()=>this.lc()))}}cc(t){const e=this.ac.then((()=>(this.rc=!0,t().catch((r=>{throw this.nc=r,this.rc=!1,ne("INTERNAL UNHANDLED ERROR: ",Fc(r)),r})).then((r=>(this.rc=!1,r))))));return this.ac=e,e}enqueueAfterDelay(t,e,r){this.uc(),this.oc.indexOf(t)>-1&&(e=0);const s=ro.createAndSchedule(this,t,e,r,(o=>this.hc(o)));return this.tc.push(s),s}uc(){this.nc&&F(47125,{Pc:Fc(this.nc)})}verifyOperationInProgress(){}async Tc(){let t;do t=this.ac,await t;while(t!==this.ac)}Ic(t){for(const e of this.tc)if(e.timerId===t)return!0;return!1}Ec(t){return this.Tc().then((()=>{this.tc.sort(((e,r)=>e.targetTimeMs-r.targetTimeMs));for(const e of this.tc)if(e.skipDelay(),t!=="all"&&e.timerId===t)break;return this.Tc()}))}dc(t){this.oc.push(t)}hc(t){const e=this.tc.indexOf(t);this.tc.splice(e,1)}}function Fc(n){let t=n.message||"";return n.stack&&(t=n.stack.includes(n.message)?n.stack:n.message+`
`+n.stack),t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $c(n){return(function(e,r){if(typeof e!="object"||e===null)return!1;const s=e;for(const o of r)if(o in s&&typeof s[o]=="function")return!0;return!1})(n,["next","error","complete"])}class qt extends _s{constructor(t,e,r,s){super(t,e,r,s),this.type="firestore",this._queue=new Lc,this._persistenceKey=s?.name||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const t=this._firestoreClient.terminate();this._queue=new Lc(t),this._firestoreClient=void 0,await t}}}function I_(n,t){const e=typeof n=="object"?n:dm(),r=typeof n=="string"?n:Br,s=am(e,"firestore").getImmediate({identifier:r});if(!s._initialized){const o=Qd("firestore");o&&T_(s,...o)}return s}function _n(n){if(n._terminated)throw new x(b.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||A_(n),n._firestoreClient}function A_(n){const t=n._freezeSettings(),e=(function(s,o,a,l){return new Hm(s,o,a,l.host,l.ssl,l.experimentalForceLongPolling,l.experimentalAutoDetectLongPolling,Ru(l.experimentalLongPollingOptions),l.useFetchStreams,l.isUsingEmulator)})(n._databaseId,n._app?.options.appId||"",n._persistenceKey,t);n._componentsProvider||t.localCache?._offlineComponentProvider&&t.localCache?._onlineComponentProvider&&(n._componentsProvider={_offline:t.localCache._offlineComponentProvider,_online:t.localCache._onlineComponentProvider}),n._firestoreClient=new p_(n._authCredentials,n._appCheckCredentials,n._queue,e,n._componentsProvider&&(function(s){const o=s?._online.build();return{_offline:s?._offline.build(o),_online:o}})(n._componentsProvider))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mt{constructor(t){this._byteString=t}static fromBase64String(t){try{return new Mt(vt.fromBase64String(t))}catch(e){throw new x(b.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+e)}}static fromUint8Array(t){return new Mt(vt.fromUint8Array(t))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(t){return this._byteString.isEqual(t._byteString)}toJSON(){return{type:Mt._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(t){if(Jn(t,Mt._jsonSchema))return Mt.fromBase64String(t.bytes)}}Mt._jsonSchemaVersion="firestore/bytes/1.0",Mt._jsonSchema={type:dt("string",Mt._jsonSchemaVersion),bytes:dt("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $e{constructor(...t){for(let e=0;e<t.length;++e)if(t[e].length===0)throw new x(b.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new Et(t)}isEqual(t){return this._internalPath.isEqual(t._internalPath)}}function J_(){return new $e(mi)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ys{constructor(t){this._methodName=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qt{constructor(t,e){if(!isFinite(t)||t<-90||t>90)throw new x(b.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+t);if(!isFinite(e)||e<-180||e>180)throw new x(b.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+e);this._lat=t,this._long=e}get latitude(){return this._lat}get longitude(){return this._long}isEqual(t){return this._lat===t._lat&&this._long===t._long}_compareTo(t){return H(this._lat,t._lat)||H(this._long,t._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:Qt._jsonSchemaVersion}}static fromJSON(t){if(Jn(t,Qt._jsonSchema))return new Qt(t.latitude,t.longitude)}}Qt._jsonSchemaVersion="firestore/geoPoint/1.0",Qt._jsonSchema={type:dt("string",Qt._jsonSchemaVersion),latitude:dt("number"),longitude:dt("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xt{constructor(t){this._values=(t||[]).map((e=>e))}toArray(){return this._values.map((t=>t))}isEqual(t){return(function(r,s){if(r.length!==s.length)return!1;for(let o=0;o<r.length;++o)if(r[o]!==s[o])return!1;return!0})(this._values,t._values)}toJSON(){return{type:Xt._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(t){if(Jn(t,Xt._jsonSchema)){if(Array.isArray(t.vectorValues)&&t.vectorValues.every((e=>typeof e=="number")))return new Xt(t.vectorValues);throw new x(b.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}Xt._jsonSchemaVersion="firestore/vectorValue/1.0",Xt._jsonSchema={type:dt("string",Xt._jsonSchemaVersion),vectorValues:dt("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const C_=/^__.*__$/;class R_{constructor(t,e,r){this.data=t,this.fieldMask=e,this.fieldTransforms=r}toMutation(t,e){return this.fieldMask!==null?new Ce(t,this.data,this.fieldMask,e,this.fieldTransforms):new tr(t,this.data,e,this.fieldTransforms)}}class Su{constructor(t,e,r){this.data=t,this.fieldMask=e,this.fieldTransforms=r}toMutation(t,e){return new Ce(t,this.data,this.fieldMask,e,this.fieldTransforms)}}function Pu(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw F(40011,{Ac:n})}}class mo{constructor(t,e,r,s,o,a){this.settings=t,this.databaseId=e,this.serializer=r,this.ignoreUndefinedProperties=s,o===void 0&&this.Rc(),this.fieldTransforms=o||[],this.fieldMask=a||[]}get path(){return this.settings.path}get Ac(){return this.settings.Ac}Vc(t){return new mo({...this.settings,...t},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}mc(t){const e=this.path?.child(t),r=this.Vc({path:e,fc:!1});return r.gc(t),r}yc(t){const e=this.path?.child(t),r=this.Vc({path:e,fc:!1});return r.Rc(),r}wc(t){return this.Vc({path:void 0,fc:!0})}Sc(t){return Zr(t,this.settings.methodName,this.settings.bc||!1,this.path,this.settings.Dc)}contains(t){return this.fieldMask.find((e=>t.isPrefixOf(e)))!==void 0||this.fieldTransforms.find((e=>t.isPrefixOf(e.field)))!==void 0}Rc(){if(this.path)for(let t=0;t<this.path.length;t++)this.gc(this.path.get(t))}gc(t){if(t.length===0)throw this.Sc("Document fields must not be empty");if(Pu(this.Ac)&&C_.test(t))throw this.Sc('Document fields cannot begin and end with "__"')}}class b_{constructor(t,e,r){this.databaseId=t,this.ignoreUndefinedProperties=e,this.serializer=r||ms(t)}Cc(t,e,r,s=!1){return new mo({Ac:t,methodName:e,Dc:r,path:Et.emptyPath(),fc:!1,bc:s},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function yn(n){const t=n._freezeSettings(),e=ms(n._databaseId);return new b_(n._databaseId,!!t.ignoreUndefinedProperties,e)}function Es(n,t,e,r,s,o={}){const a=n.Cc(o.merge||o.mergeFields?2:0,t,e,s);yo("Data must be an object, but it was:",a,r);const l=Vu(r,a);let h,d;if(o.merge)h=new Lt(a.fieldMask),d=a.fieldTransforms;else if(o.mergeFields){const m=[];for(const _ of o.mergeFields){const v=Si(t,_,e);if(!a.contains(v))throw new x(b.INVALID_ARGUMENT,`Field '${v}' is specified in your field mask but missing from your input data.`);Nu(m,v)||m.push(v)}h=new Lt(m),d=a.fieldTransforms.filter((_=>h.covers(_.field)))}else h=null,d=a.fieldTransforms;return new R_(new Vt(l),h,d)}class vs extends ys{_toFieldTransform(t){if(t.Ac!==2)throw t.Ac===1?t.Sc(`${this._methodName}() can only appear at the top level of your update data`):t.Sc(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return t.fieldMask.push(t.path),null}isEqual(t){return t instanceof vs}}class po extends ys{_toFieldTransform(t){return new _p(t.path,new Kn)}isEqual(t){return t instanceof po}}function go(n,t,e,r){const s=n.Cc(1,t,e);yo("Data must be an object, but it was:",s,r);const o=[],a=Vt.empty();Ae(r,((h,d)=>{const m=Eo(t,h,e);d=$t(d);const _=s.yc(m);if(d instanceof vs)o.push(m);else{const v=ir(d,_);v!=null&&(o.push(m),a.set(m,v))}}));const l=new Lt(o);return new Su(a,l,s.fieldTransforms)}function _o(n,t,e,r,s,o){const a=n.Cc(1,t,e),l=[Si(t,r,e)],h=[s];if(o.length%2!=0)throw new x(b.INVALID_ARGUMENT,`Function ${t}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let v=0;v<o.length;v+=2)l.push(Si(t,o[v])),h.push(o[v+1]);const d=[],m=Vt.empty();for(let v=l.length-1;v>=0;--v)if(!Nu(d,l[v])){const C=l[v];let V=h[v];V=$t(V);const k=a.yc(C);if(V instanceof vs)d.push(C);else{const P=ir(V,k);P!=null&&(d.push(C),m.set(C,P))}}const _=new Lt(d);return new Su(m,_,a.fieldTransforms)}function S_(n,t,e,r=!1){return ir(e,n.Cc(r?4:3,t))}function ir(n,t){if(Du(n=$t(n)))return yo("Unsupported field value:",t,n),Vu(n,t);if(n instanceof ys)return(function(r,s){if(!Pu(s.Ac))throw s.Sc(`${r._methodName}() can only be used with update() and set()`);if(!s.path)throw s.Sc(`${r._methodName}() is not currently supported inside arrays`);const o=r._toFieldTransform(s);o&&s.fieldTransforms.push(o)})(n,t),null;if(n===void 0&&t.ignoreUndefinedProperties)return null;if(t.path&&t.fieldMask.push(t.path),n instanceof Array){if(t.settings.fc&&t.Ac!==4)throw t.Sc("Nested arrays are not supported");return(function(r,s){const o=[];let a=0;for(const l of r){let h=ir(l,s.wc(a));h==null&&(h={nullValue:"NULL_VALUE"}),o.push(h),a++}return{arrayValue:{values:o}}})(n,t)}return(function(r,s){if((r=$t(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return mp(s.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const o=et.fromDate(r);return{timestampValue:Wr(s.serializer,o)}}if(r instanceof et){const o=new et(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:Wr(s.serializer,o)}}if(r instanceof Qt)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof Mt)return{bytesValue:Zl(s.serializer,r._byteString)};if(r instanceof st){const o=s.databaseId,a=r.firestore._databaseId;if(!a.isEqual(o))throw s.Sc(`Document reference is for database ${a.projectId}/${a.database} but should be for database ${o.projectId}/${o.database}`);return{referenceValue:Wi(r.firestore._databaseId||s.databaseId,r._key.path)}}if(r instanceof Xt)return(function(a,l){return{mapValue:{fields:{[Rl]:{stringValue:bl},[qr]:{arrayValue:{values:a.toArray().map((d=>{if(typeof d!="number")throw l.Sc("VectorValues must only contain numeric values.");return zi(l.serializer,d)}))}}}}}})(r,s);throw s.Sc(`Unsupported field value: ${is(r)}`)})(n,t)}function Vu(n,t){const e={};return vl(n)?t.path&&t.path.length>0&&t.fieldMask.push(t.path):Ae(n,((r,s)=>{const o=ir(s,t.mc(r));o!=null&&(e[r]=o)})),{mapValue:{fields:e}}}function Du(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof et||n instanceof Qt||n instanceof Mt||n instanceof st||n instanceof ys||n instanceof Xt)}function yo(n,t,e){if(!Du(e)||!yl(e)){const r=is(e);throw r==="an object"?t.Sc(n+" a custom object"):t.Sc(n+" "+r)}}function Si(n,t,e){if((t=$t(t))instanceof $e)return t._internalPath;if(typeof t=="string")return Eo(n,t);throw Zr("Field path arguments must be of type string or ",n,!1,void 0,e)}const P_=new RegExp("[~\\*/\\[\\]]");function Eo(n,t,e){if(t.search(P_)>=0)throw Zr(`Invalid field path (${t}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,e);try{return new $e(...t.split("."))._internalPath}catch{throw Zr(`Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,e)}}function Zr(n,t,e,r,s){const o=r&&!r.isEmpty(),a=s!==void 0;let l=`Function ${t}() called with invalid data`;e&&(l+=" (via `toFirestore()`)"),l+=". ";let h="";return(o||a)&&(h+=" (found",o&&(h+=` in field ${r}`),a&&(h+=` in document ${s}`),h+=")"),new x(b.INVALID_ARGUMENT,l+n+h)}function Nu(n,t){return n.some((e=>e.isEqual(t)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ts{constructor(t,e,r,s,o){this._firestore=t,this._userDataWriter=e,this._key=r,this._document=s,this._converter=o}get id(){return this._key.path.lastSegment()}get ref(){return new st(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const t=new V_(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(t)}return this._userDataWriter.convertValue(this._document.data.value)}}get(t){if(this._document){const e=this._document.data.field(Ts("DocumentSnapshot.get",t));if(e!==null)return this._userDataWriter.convertValue(e)}}}class V_ extends ts{data(){return super.data()}}function Ts(n,t){return typeof t=="string"?Eo(n,t):t instanceof $e?t._internalPath:t._delegate._internalPath}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xu(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new x(b.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class vo{}class To extends vo{}function Z_(n,t,...e){let r=[];t instanceof vo&&r.push(t),r=r.concat(e),(function(o){const a=o.filter((h=>h instanceof wo)).length,l=o.filter((h=>h instanceof ws)).length;if(a>1||a>0&&l>0)throw new x(b.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(r);for(const s of r)n=s._apply(n);return n}class ws extends To{constructor(t,e,r){super(),this._field=t,this._op=e,this._value=r,this.type="where"}static _create(t,e,r){return new ws(t,e,r)}_apply(t){const e=this._parse(t);return ku(t._query,e),new se(t.firestore,t.converter,Ei(t._query,e))}_parse(t){const e=yn(t.firestore);return(function(o,a,l,h,d,m,_){let v;if(d.isKeyField()){if(m==="array-contains"||m==="array-contains-any")throw new x(b.INVALID_ARGUMENT,`Invalid Query. You can't perform '${m}' queries on documentId().`);if(m==="in"||m==="not-in"){Uc(_,m);const V=[];for(const k of _)V.push(jc(h,o,k));v={arrayValue:{values:V}}}else v=jc(h,o,_)}else m!=="in"&&m!=="not-in"&&m!=="array-contains-any"||Uc(_,m),v=S_(l,a,_,m==="in"||m==="not-in");return ut.create(d,m,v)})(t._query,"where",e,t.firestore._databaseId,this._field,this._op,this._value)}}function ty(n,t,e){const r=t,s=Ts("where",n);return ws._create(s,r,e)}class wo extends vo{constructor(t,e){super(),this.type=t,this._queryConstraints=e}static _create(t,e){return new wo(t,e)}_parse(t){const e=this._queryConstraints.map((r=>r._parse(t))).filter((r=>r.getFilters().length>0));return e.length===1?e[0]:Bt.create(e,this._getOperator())}_apply(t){const e=this._parse(t);return e.getFilters().length===0?t:((function(s,o){let a=s;const l=o.getFlattenedFilters();for(const h of l)ku(a,h),a=Ei(a,h)})(t._query,e),new se(t.firestore,t.converter,Ei(t._query,e)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class Io extends To{constructor(t,e){super(),this._field=t,this._direction=e,this.type="orderBy"}static _create(t,e){return new Io(t,e)}_apply(t){const e=(function(s,o,a){if(s.startAt!==null)throw new x(b.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(s.endAt!==null)throw new x(b.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new Wn(o,a)})(t._query,this._field,this._direction);return new se(t.firestore,t.converter,(function(s,o){const a=s.explicitOrderBy.concat([o]);return new pn(s.path,s.collectionGroup,a,s.filters.slice(),s.limit,s.limitType,s.startAt,s.endAt)})(t._query,e))}}function ey(n,t="asc"){const e=t,r=Ts("orderBy",n);return Io._create(r,e)}class Ao extends To{constructor(t,e,r){super(),this.type=t,this._limit=e,this._limitType=r}static _create(t,e,r){return new Ao(t,e,r)}_apply(t){return new se(t.firestore,t.converter,Hr(t._query,this._limit,this._limitType))}}function ny(n){return km("limit",n),Ao._create("limit",n,"F")}function jc(n,t,e){if(typeof(e=$t(e))=="string"){if(e==="")throw new x(b.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!Ol(t)&&e.indexOf("/")!==-1)throw new x(b.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${e}' contains a '/' character.`);const r=t.path.child(J.fromString(e));if(!L.isDocumentKey(r))throw new x(b.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return nc(n,new L(r))}if(e instanceof st)return nc(n,e._key);throw new x(b.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${is(e)}.`)}function Uc(n,t){if(!Array.isArray(n)||n.length===0)throw new x(b.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${t.toString()}' filters.`)}function ku(n,t){const e=(function(s,o){for(const a of s)for(const l of a.getFlattenedFilters())if(o.indexOf(l.op)>=0)return l.op;return null})(n.filters,(function(s){switch(s){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(t.op));if(e!==null)throw e===t.op?new x(b.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${t.op.toString()}' filter.`):new x(b.INVALID_ARGUMENT,`Invalid query. You cannot use '${t.op.toString()}' filters with '${e.toString()}' filters.`)}class Ou{convertValue(t,e="none"){switch(Te(t)){case 0:return null;case 1:return t.booleanValue;case 2:return at(t.integerValue||t.doubleValue);case 3:return this.convertTimestamp(t.timestampValue);case 4:return this.convertServerTimestamp(t,e);case 5:return t.stringValue;case 6:return this.convertBytes(ve(t.bytesValue));case 7:return this.convertReference(t.referenceValue);case 8:return this.convertGeoPoint(t.geoPointValue);case 9:return this.convertArray(t.arrayValue,e);case 11:return this.convertObject(t.mapValue,e);case 10:return this.convertVectorValue(t.mapValue);default:throw F(62114,{value:t})}}convertObject(t,e){return this.convertObjectMap(t.fields,e)}convertObjectMap(t,e="none"){const r={};return Ae(t,((s,o)=>{r[s]=this.convertValue(o,e)})),r}convertVectorValue(t){const e=t.fields?.[qr].arrayValue?.values?.map((r=>at(r.doubleValue)));return new Xt(e)}convertGeoPoint(t){return new Qt(at(t.latitude),at(t.longitude))}convertArray(t,e){return(t.values||[]).map((r=>this.convertValue(r,e)))}convertServerTimestamp(t,e){switch(e){case"previous":const r=as(t);return r==null?null:this.convertValue(r,e);case"estimate":return this.convertTimestamp(zn(t));default:return null}}convertTimestamp(t){const e=Ee(t);return new et(e.seconds,e.nanos)}convertDocumentKey(t,e){const r=J.fromString(t);Q(ou(r),9688,{name:t});const s=new Hn(r.get(1),r.get(3)),o=new L(r.popFirst(5));return s.isEqual(e)||ne(`Document ${o} contains a document reference within a different database (${s.projectId}/${s.database}) which is not supported. It will be treated as a reference in the current database (${e.projectId}/${e.database}) instead.`),o}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Is(n,t,e){let r;return r=n?e&&(e.merge||e.mergeFields)?n.toFirestore(t,e):n.toFirestore(t):t,r}class D_ extends Ou{constructor(t){super(),this.firestore=t}convertBytes(t){return new Mt(t)}convertReference(t){const e=this.convertDocumentKey(t,this.firestore._databaseId);return new st(this.firestore,null,e)}}class Je{constructor(t,e){this.hasPendingWrites=t,this.fromCache=e}isEqual(t){return this.hasPendingWrites===t.hasPendingWrites&&this.fromCache===t.fromCache}}class _e extends ts{constructor(t,e,r,s,o,a){super(t,e,r,s,a),this._firestore=t,this._firestoreImpl=t,this.metadata=o}exists(){return super.exists()}data(t={}){if(this._document){if(this._converter){const e=new Mr(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(e,t)}return this._userDataWriter.convertValue(this._document.data.value,t.serverTimestamps)}}get(t,e={}){if(this._document){const r=this._document.data.field(Ts("DocumentSnapshot.get",t));if(r!==null)return this._userDataWriter.convertValue(r,e.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new x(b.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const t=this._document,e={};return e.type=_e._jsonSchemaVersion,e.bundle="",e.bundleSource="DocumentSnapshot",e.bundleName=this._key.toString(),!t||!t.isValidDocument()||!t.isFoundDocument()?e:(this._userDataWriter.convertObjectMap(t.data.value.mapValue.fields,"previous"),e.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),e)}}_e._jsonSchemaVersion="firestore/documentSnapshot/1.0",_e._jsonSchema={type:dt("string",_e._jsonSchemaVersion),bundleSource:dt("string","DocumentSnapshot"),bundleName:dt("string"),bundle:dt("string")};class Mr extends _e{data(t={}){return super.data(t)}}class xe{constructor(t,e,r,s){this._firestore=t,this._userDataWriter=e,this._snapshot=s,this.metadata=new Je(s.hasPendingWrites,s.fromCache),this.query=r}get docs(){const t=[];return this.forEach((e=>t.push(e))),t}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(t,e){this._snapshot.docs.forEach((r=>{t.call(e,new Mr(this._firestore,this._userDataWriter,r.key,r,new Je(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(t={}){const e=!!t.includeMetadataChanges;if(e&&this._snapshot.excludesMetadataChanges)throw new x(b.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===e||(this._cachedChanges=(function(s,o){if(s._snapshot.oldDocs.isEmpty()){let a=0;return s._snapshot.docChanges.map((l=>{const h=new Mr(s._firestore,s._userDataWriter,l.doc.key,l.doc,new Je(s._snapshot.mutatedKeys.has(l.doc.key),s._snapshot.fromCache),s.query.converter);return l.doc,{type:"added",doc:h,oldIndex:-1,newIndex:a++}}))}{let a=s._snapshot.oldDocs;return s._snapshot.docChanges.filter((l=>o||l.type!==3)).map((l=>{const h=new Mr(s._firestore,s._userDataWriter,l.doc.key,l.doc,new Je(s._snapshot.mutatedKeys.has(l.doc.key),s._snapshot.fromCache),s.query.converter);let d=-1,m=-1;return l.type!==0&&(d=a.indexOf(l.doc.key),a=a.delete(l.doc.key)),l.type!==1&&(a=a.add(l.doc),m=a.indexOf(l.doc.key)),{type:N_(l.type),doc:h,oldIndex:d,newIndex:m}}))}})(this,e),this._cachedChangesIncludeMetadataChanges=e),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new x(b.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const t={};t.type=xe._jsonSchemaVersion,t.bundleSource="QuerySnapshot",t.bundleName=Fi.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const e=[],r=[],s=[];return this.docs.forEach((o=>{o._document!==null&&(e.push(o._document),r.push(this._userDataWriter.convertObjectMap(o._document.data.value.mapValue.fields,"previous")),s.push(o.ref.path))})),t.bundle=(this._firestore,this.query._query,t.bundleName,"NOT SUPPORTED"),t}}function N_(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return F(61501,{type:n})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ry(n){n=Rt(n,st);const t=Rt(n.firestore,qt);return E_(_n(t),n._key).then((e=>Mu(t,n,e)))}xe._jsonSchemaVersion="firestore/querySnapshot/1.0",xe._jsonSchema={type:dt("string",xe._jsonSchemaVersion),bundleSource:dt("string","QuerySnapshot"),bundleName:dt("string"),bundle:dt("string")};class As extends Ou{constructor(t){super(),this.firestore=t}convertBytes(t){return new Mt(t)}convertReference(t){const e=this.convertDocumentKey(t,this.firestore._databaseId);return new st(this.firestore,null,e)}}function sy(n){n=Rt(n,se);const t=Rt(n.firestore,qt),e=_n(t),r=new As(t);return xu(n._query),v_(e,n._query).then((s=>new xe(t,r,n,s)))}function iy(n,t,e){n=Rt(n,st);const r=Rt(n.firestore,qt),s=Is(n.converter,t,e);return or(r,[Es(yn(r),"setDoc",n._key,s,n.converter!==null,e).toMutation(n._key,ht.none())])}function oy(n,t,e,...r){n=Rt(n,st);const s=Rt(n.firestore,qt),o=yn(s);let a;return a=typeof(t=$t(t))=="string"||t instanceof $e?_o(o,"updateDoc",n._key,t,e,r):go(o,"updateDoc",n._key,t),or(s,[a.toMutation(n._key,ht.exists(!0))])}function ay(n){return or(Rt(n.firestore,qt),[new er(n._key,ht.none())])}function cy(n,t){const e=Rt(n.firestore,qt),r=w_(n),s=Is(n.converter,t);return or(e,[Es(yn(n.firestore),"addDoc",r._key,s,n.converter!==null,{}).toMutation(r._key,ht.exists(!1))]).then((()=>r))}function ly(n,...t){n=$t(n);let e={includeMetadataChanges:!1,source:"default"},r=0;typeof t[r]!="object"||$c(t[r])||(e=t[r++]);const s={includeMetadataChanges:e.includeMetadataChanges,source:e.source};if($c(t[r])){const h=t[r];t[r]=h.next?.bind(h),t[r+1]=h.error?.bind(h),t[r+2]=h.complete?.bind(h)}let o,a,l;if(n instanceof st)a=Rt(n.firestore,qt),l=cs(n._key.path),o={next:h=>{t[r]&&t[r](Mu(a,n,h))},error:t[r+1],complete:t[r+2]};else{const h=Rt(n,se);a=Rt(h.firestore,qt),l=h._query;const d=new As(a);o={next:m=>{t[r]&&t[r](new xe(a,d,h,m))},error:t[r+1],complete:t[r+2]},xu(n._query)}return(function(d,m,_,v){const C=new ho(v),V=new co(m,C,_);return d.asyncQueue.enqueueAndForget((async()=>io(await Jr(d),V))),()=>{C.Nu(),d.asyncQueue.enqueueAndForget((async()=>oo(await Jr(d),V)))}})(_n(a),l,s,o)}function or(n,t){return(function(r,s){const o=new Wt;return r.asyncQueue.enqueueAndForget((async()=>s_(await __(r),s,o))),o.promise})(_n(n),t)}function Mu(n,t,e){const r=e.docs.get(t._key),s=new As(n);return new _e(n,s,t._key,r,new Je(e.hasPendingWrites,e.fromCache),t.converter)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const x_={maxAttempts:5};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class k_{constructor(t,e){this._firestore=t,this._commitHandler=e,this._mutations=[],this._committed=!1,this._dataReader=yn(t)}set(t,e,r){this._verifyNotCommitted();const s=de(t,this._firestore),o=Is(s.converter,e,r),a=Es(this._dataReader,"WriteBatch.set",s._key,o,s.converter!==null,r);return this._mutations.push(a.toMutation(s._key,ht.none())),this}update(t,e,r,...s){this._verifyNotCommitted();const o=de(t,this._firestore);let a;return a=typeof(e=$t(e))=="string"||e instanceof $e?_o(this._dataReader,"WriteBatch.update",o._key,e,r,s):go(this._dataReader,"WriteBatch.update",o._key,e),this._mutations.push(a.toMutation(o._key,ht.exists(!0))),this}delete(t){this._verifyNotCommitted();const e=de(t,this._firestore);return this._mutations=this._mutations.concat(new er(e._key,ht.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new x(b.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}}function de(n,t){if((n=$t(n)).firestore!==t)throw new x(b.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class O_{constructor(t,e){this._firestore=t,this._transaction=e,this._dataReader=yn(t)}get(t){const e=de(t,this._firestore),r=new D_(this._firestore);return this._transaction.lookup([e._key]).then((s=>{if(!s||s.length!==1)return F(24041);const o=s[0];if(o.isFoundDocument())return new ts(this._firestore,r,o.key,o,e.converter);if(o.isNoDocument())return new ts(this._firestore,r,e._key,null,e.converter);throw F(18433,{doc:o})}))}set(t,e,r){const s=de(t,this._firestore),o=Is(s.converter,e,r),a=Es(this._dataReader,"Transaction.set",s._key,o,s.converter!==null,r);return this._transaction.set(s._key,a),this}update(t,e,r,...s){const o=de(t,this._firestore);let a;return a=typeof(e=$t(e))=="string"||e instanceof $e?_o(this._dataReader,"Transaction.update",o._key,e,r,s):go(this._dataReader,"Transaction.update",o._key,e),this._transaction.update(o._key,a),this}delete(t){const e=de(t,this._firestore);return this._transaction.delete(e._key),this}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class M_ extends O_{constructor(t,e){super(t,e),this._firestore=t}get(t){const e=de(t,this._firestore),r=new As(this._firestore);return super.get(t).then((s=>new _e(this._firestore,r,e._key,s._document,new Je(!1,!1),e.converter)))}}function uy(n,t,e){n=Rt(n,qt);const r={...x_,...e};return(function(o){if(o.maxAttempts<1)throw new x(b.INVALID_ARGUMENT,"Max attempts must be at least 1")})(r),(function(o,a,l){const h=new Wt;return o.asyncQueue.enqueueAndForget((async()=>{const d=await y_(o);new m_(o.asyncQueue,d,l,a,h).ju()})),h.promise})(_n(n),(s=>t(new M_(n,s))),r)}function hy(){return new po("serverTimestamp")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dy(n){return _n(n=Rt(n,qt)),new k_(n,(t=>or(n,t)))}(function(t,e=!0){(function(s){dn=s})(hm),jr(new Un("firestore",((r,{instanceIdentifier:s,options:o})=>{const a=r.getProvider("app").getImmediate(),l=new qt(new Cm(r.getProvider("auth-internal")),new Sm(a,r.getProvider("app-check-internal")),(function(d,m){if(!Object.prototype.hasOwnProperty.apply(d.options,["projectId"]))throw new x(b.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new Hn(d.options.projectId,m)})(a,s),a);return o={useFetchStreams:e,...o},l._setSettings(o),l}),"PUBLIC").setMultipleInstances(!0)),tn(za,Ha,t),tn(za,Ha,"esm2020")})();var L_="firebase",F_="12.2.1";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */tn(L_,F_,"app");const $_={apiKey:"AIzaSyAGB6rmd80Y-8IARwdv-fGbT6Jtcxww5ik",authDomain:"ziyocraft-inventory-app.firebaseapp.com",projectId:"ziyocraft-inventory-app",storageBucket:"ziyocraft-inventory-app.appspot.com",messagingSenderId:"15690184314",appId:"1:15690184314:web:78a7c31941da5023a1adc3"},j_=ol($_),fy=I_(j_);export{ld as A,Ed as B,K_ as C,G_ as D,Xc as E,Ca as F,Q_ as R,Fd as S,et as T,W_ as a,w_ as b,Y_ as c,fy as d,cy as e,ay as f,sy as g,dy as h,ly as i,ry as j,J_ as k,ny as l,H_ as m,vd as n,ey as o,kh as p,Z_ as q,uy as r,hy as s,z_ as t,oy as u,q_ as v,ty as w,Yn as x,iy as y,B_ as z};
