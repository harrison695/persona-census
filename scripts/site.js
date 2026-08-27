
(function(){
 var lane="*", kind="*", read="*", q="";
 var ads=[].slice.call(document.querySelectorAll(".ad"));
 var brands=[].slice.call(document.querySelectorAll(".brand"));
 var lanes=[].slice.call(document.querySelectorAll(".lane"));
 var count=document.getElementById("count"), empty=document.getElementById("empty");
 function apply(){
  var shown=0;
  ads.forEach(function(a){
   var ok=(kind==="*"||a.dataset.kind===kind)&&(read==="*"||a.dataset.read===read)&&(q===""||a.dataset.s.indexOf(q)>-1);
   a.hidden=!ok; if(ok)shown++;
  });
  brands.forEach(function(b){
   b.hidden=!b.querySelector(".ad:not([hidden])");
  });
  lanes.forEach(function(l){
   var lok=(lane==="*"||l.dataset.lane===lane);
   l.hidden=!lok||!l.querySelector(".brand:not([hidden])");
  });
  if(lane!=="*"){shown=0;lanes.forEach(function(l){if(!l.hidden)shown+=l.querySelectorAll(".ad:not([hidden])").length;});}
  count.textContent=shown+" ad"+(shown===1?"":"s");
  empty.hidden=shown>0;
 }
 document.querySelectorAll(".chip").forEach(function(c){
  c.addEventListener("click",function(){
   lane=c.dataset.lane;
   document.querySelectorAll(".chip").forEach(function(o){o.setAttribute("aria-pressed",String(o===c));});
   apply();
  });
 });
 document.querySelectorAll(".seg").forEach(function(seg){
  seg.querySelectorAll("button").forEach(function(b){
   b.addEventListener("click",function(){
    if(b.dataset.kind!==undefined)kind=b.dataset.kind;
    if(b.dataset.read!==undefined)read=b.dataset.read;
    seg.querySelectorAll("button").forEach(function(o){o.setAttribute("aria-pressed",String(o===b));});
    apply();
   });
  });
 });
 var t;
 document.getElementById("q").addEventListener("input",function(ev){
  clearTimeout(t); var v=ev.target.value.toLowerCase().trim();
  t=setTimeout(function(){q=v;apply();},130);
 });
 apply();
})();
