const t=(n=[])=>Array.isArray(n)?n.reduce((e,r)=>{if(!r||r.value===void 0||r.value===null)return e;const u=String(r.value).trim();return u&&(e[u]=r.label??""),e},{}):{};export{t};
