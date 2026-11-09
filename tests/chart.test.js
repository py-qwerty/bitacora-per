import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CHART,toPixel,toGeo,bearing,distance,destination,toPlane,fromPlane,planeRadius,lineLine,lineCircle,circleCircle,formatLat,formatLon,formatBearing,fromDegMin,parseNumber} from '../dist/chart-geo.js';
const near=(a,b,eps,msg)=>assert(Math.abs(a-b)<=eps,`${msg??''} ${a} ≠ ${b}`);
const P=(latD,latM,lonD,lonM)=>({lat:latD+latM/60,lon:-(lonD+lonM/60)});
test('chart pixels and positions convert both ways inside the printed graticule',()=>{
  for(let lat=CHART.south;lat<=CHART.north+1e-9;lat+=1/12)for(let lon=CHART.west;lon<=CHART.east+1e-9;lon+=1/12){
    const px=toPixel({lat,lon}),back=toGeo(px);
    near(back.lat,lat,1e-6);near(back.lon,lon,1e-6);
    assert(px.x>300&&px.x<4720&&px.y>200&&px.y<3300);
  }
  // The scan correction stays small: never more than 12 px (0,15′) from the KAP calibration.
  const nw=toPixel({lat:CHART.north,lon:CHART.west});near(nw.x,CHART.x0,12);near(nw.y,CHART.y0,12);
});
test('rhumb bearings and distances follow chart practice',()=>{
  const a=P(36,0,5,30);
  near(bearing(a,P(36,10,5,30)),0,1e-9);near(distance(a,P(36,10,5,30)),10,1e-9);
  near(bearing(a,P(35,50,5,30)),180,1e-9);
  near(bearing(a,P(36,0,5,20)),90,1e-9);near(distance(a,P(36,0,5,20)),10*Math.cos(36*Math.PI/180),1e-9);
  near(bearing(a,P(36,0,5,40)),270,1e-9);
  // Dead reckoning from the bank: 6 knots for 2 h 30 min on a true course of 314° from 35°50′ N 005°50′ W.
  const dr=destination(P(35,50,5,50),314,15);
  near(dr.lat,36+0.4/60,0.05/60,'lat');near(dr.lon,-(6+3.2/60),0.2/60,'lon');
  for(const course of [0,37,90,154,203,270,331])for(const miles of [0.5,7,25]){
    const b=destination(a,course,miles);near(distance(a,b),miles,1e-9);near(Math.cos((bearing(a,b)-course)*Math.PI/180),1,1e-12);
  }
});
test('plane geometry finds fixes from bearings and distances',()=>{
  const A=P(36,0,5,40),B=P(36,0,5,20);
  const seg=(p,q,min=0,max=1)=>({a:toPlane(p),b:toPlane(q),min,max});
  // Two bearing lines cross where expected.
  const fix=fromPlane(lineLine(seg(A,destination(A,45,20)),seg(B,destination(B,315,20)))[0]);
  near(fix.lon,-5.5,1e-9);assert(fix.lat>36);near(bearing(A,fix),45,1e-9);
  assert.equal(lineLine(seg(A,destination(A,45,2)),seg(B,destination(B,315,2))).length,0,'short segments do not meet');
  assert.equal(lineLine(seg(A,destination(A,45,2),0,Infinity),seg(B,destination(B,315,2),0,Infinity)).length,1,'prolonged lines meet');
  assert.equal(lineLine(seg(A,B),seg(P(36,5,5,40),P(36,5,5,20))).length,0,'parallels never meet');
  // A distance circle cut by a bearing line and by another circle.
  const circle={c:toPlane(A),r:planeRadius(A,5)};
  const onLine=lineCircle(seg(A,destination(A,180,20)),circle);assert.equal(onLine.length,1);near(distance(A,fromPlane(onLine[0])),5,0.01);
  assert.equal(lineCircle(seg(destination(A,270,20),destination(A,90,20)),circle).length,2);
  const two=circleCircle(circle,{c:toPlane(B),r:planeRadius(B,14)});assert.equal(two.length,2);
  for(const q of two){near(distance(A,fromPlane(q)),5,0.02);near(distance(B,fromPlane(q)),14,0.03);}
  assert.equal(circleCircle(circle,{c:toPlane(B),r:planeRadius(B,5)}).length,0);
});
test('coordinates are written and read as in the exam statements',()=>{
  assert.equal(formatLat(36+5.14/60),'36°05,1′ N');assert.equal(formatLon(-(5+11/60)),'005°11,0′ W');
  assert.equal(formatLat(35+59.97/60),'36°00,0′ N');
  assert.equal(formatBearing(7.04),'007,0°');assert.equal(formatBearing(359.97),'000,0°');assert.equal(formatBearing(254.6,0),'255°');
  near(fromDegMin('36','05,1',false),36+5.1/60,1e-12);near(fromDegMin('5','11.0',true),-(5+11/60),1e-12);
  assert(Number.isNaN(fromDegMin('36','60',false)));assert(Number.isNaN(fromDegMin('x','1',false)));assert(Number.isNaN(parseNumber('1,2,3')));
});
test('every chart tile referenced by the viewer is published',()=>{
  assert(existsSync(new URL('../dist/assets/chart/0.webp',import.meta.url)));
  for(const [level,factor] of [[1,2],[2,1]])for(let c=0;c<Math.ceil(CHART.width/factor/CHART.tile);c++)for(let r=0;r<Math.ceil(CHART.height/factor/CHART.tile);r++)assert(existsSync(new URL(`../dist/assets/chart/${level}-${c}-${r}.webp`,import.meta.url)),`${level}-${c}-${r}`);
});
