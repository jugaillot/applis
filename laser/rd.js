/* Encodeur de fichiers Ruida (.rd) — coordonnées en micromètres, vitesse mm/s, puissance %.
   Format vérifié par comparaison avec le lecteur libre MeerK40t. */
(function(g){
  function e32(v){v=Math.round(v);var n=v<0?v+0x800000000:v;
    return [Math.floor(n/268435456)&0x7f,Math.floor(n/2097152)&0x7f,Math.floor(n/16384)&0x7f,Math.floor(n/128)&0x7f,n&0x7f];}
  function e14(v){v=Math.floor(v);return [(v>>7)&0x7f,v&0x7f];}
  function pw(p){return e14(p*16383/100);}
  function zeros(n){return new Array(n).fill(0);}
  function swz(b,m){b^=(b>>7)&0xff;b^=(b<<7)&0xff;b^=(b>>7)&0xff;b^=m;return (b+1)&0xff;}
  /* layers: [{speed:mm/s, power:%, color:0xRRGGBB, paths:[[[x,y]...]...]}] (µm) */
  function build(layers,opts){
    opts=opts||{};var out=[];function P(){for(var i=0;i<arguments.length;i++){var a=arguments[i];if(Array.isArray(a))for(var j=0;j<a.length;j++)out.push(a[j]);else out.push(a);}}
    layers=layers.filter(function(l){return l.paths.some(function(p){return p.length>1;});});
    function bounds(ls){var a=[1e18,1e18,-1e18,-1e18];ls.forEach(function(l){l.paths.forEach(function(p){p.forEach(function(q){
      if(q[0]<a[0])a[0]=q[0];if(q[1]<a[1])a[1]=q[1];if(q[0]>a[2])a[2]=q[0];if(q[1]>a[3])a[3]=q[1];});});});return a;}
    var B=bounds(layers);
    P(0xd8,0x10,0xe6,0x01,0xf0,0xf1,0x02,0x00,0xd8,0x00);
    P(0xe7,0x06,zeros(10),0xe7,0x38,0x00);
    P(0xe7,0x03,e32(B[2]),e32(B[1]),0xe7,0x07,e32(B[0]),e32(B[3]));
    P(0xe7,0x50,e32(B[2]),e32(B[1]),0xe7,0x51,e32(B[0]),e32(B[3]));
    P(0xe7,0x04,0x00,0x01,0x00,0x01,zeros(10),0xe7,0x05,0x00);
    layers.forEach(function(l,i){var b=bounds([l]),pp=pw(l.power);
      P(0xc9,0x04,i,e32(l.speed*1000));
      P(0xc6,0x31,i,pp,0xc6,0x32,i,pp,0xc6,0x41,i,pp,0xc6,0x42,i,pp);
      P(0xca,0x06,i,e32(l.color),0xca,0x41,i,0x00);
      P(0xe7,0x52,i,e32(b[0]),e32(b[1]),0xe7,0x53,i,e32(b[2]),e32(b[3]));
      P(0xe7,0x61,i,e32(b[0]),e32(b[1]),0xe7,0x62,i,e32(b[2]),e32(b[3]));});
    P(0xca,0x22,layers.length-1);
    P(0xe7,0x54,0x00,zeros(5),0xe7,0x54,0x01,zeros(5),0xe7,0x55,0x00,zeros(5),0xe7,0x55,0x01,zeros(5));
    P(0xf1,0x03,zeros(10),0xe7,0x0a,zeros(5),0xea,0x00,0xe7,0x60,0x00,0xe7,0x0b,0x00);
    P(0xe7,0x13,e32(B[0]),e32(B[1]),0xe7,0x17,e32(B[2]),e32(B[3]),0xe7,0x23,zeros(10),0xe7,0x24,0x00);
    P(0xe7,0x08,0x00,0x01,0x00,0x01,0x00,0x00,0x08,0x63,0x66,0x00,0x00,0x04,0x1b,0x18);
    layers.forEach(function(l,i){var pp=pw(l.power);
      P(0xca,0x02,i,0xca,0x01,0x10,0xc9,0x02,e32(l.speed*1000));
      P(0xc6,0x12,zeros(5),0xc6,0x13,zeros(5));
      P(0xc6,0x01,pp,0xc6,0x02,pp,0xc6,0x21,pp,0xc6,0x22,pp,0xca,0x03,0x01);
      l.paths.forEach(function(p){if(p.length<2)return;
        P(0x88,e32(p[0][0]),e32(p[0][1]));
        for(var k=1;k<p.length;k++)P(0xa8,e32(p[k][0]),e32(p[k][1]));});
      P(0xe7,0x00,0xca,0x01,0x00,0xca,0x01,0x30);});
    var sum=0;for(var i=0;i<out.length;i++)sum+=out[i];sum+=0xd7;
    P(0xe5,0x05,e32(sum),0xd7);
    var u=new Uint8Array(out.length);for(var i=0;i<out.length;i++)u[i]=opts.raw?out[i]:swz(out[i],0x88);
    return u;
  }
  g.RD={build:build};
})(typeof window!=='undefined'?window:globalThis);
