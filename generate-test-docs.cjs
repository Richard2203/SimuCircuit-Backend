'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TabStopType, TabStopPosition, TableOfContents,
} = require('docx');

// CLI args
const args        = process.argv.slice(2);
const getArg      = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null; };
const hasFlag     = (f) => args.includes(f);
const TESTS_DIR    = getArg('--dir')     ?? path.join(__dirname, 'src/tests');
const OUTPUT_PATH  = getArg('--output')  ?? path.join(__dirname, 'test-documentation-backend.docx');
const RESULTS_FILE = getArg('--results');
const SKIP_RUN     = hasFlag('--skip-run');
const TMP_RESULTS  = path.join(__dirname, '.jest-tmp.json');

// Proyecto
const PROJECT = {
  nombre:      'SimuCircuit - Backend',
  descripcion: 'Aplicación Web simuladora de circuitos eléctricos esenciales para un aprendizaje básico de las Unidades de Aprendizaje de Circuitos Eléctricos y Electrónica Analógica',
  version:     '1.0.0',
  institucion: 'Escuela Superior de Cómputo — IPN',
  autores:     ['Lechuga Cervantes Cesar Alejandro (Lettu0309)', 'López García Ricardo (Richard2203)', ],
  asesor:      '',
  docVersion:  '1.0',
  estado:      'Pruebas aprobadas — Pendiente de revisión final',
};

const ENV = [
  ['Framework de pruebas',  'Jest 29.7.0'],
  ['Entorno de prueba',      'node (jsdom no necesario)'],
  ['Node.js requerido',      '>= 18.0.0'],
  ['Lenguaje',               'JavaScript CommonJS (require)'],
  ['Motor matematico',       'mathjs 12.4.3'],
  ['Comando de ejecucion',   'npm test  /  npx jest'],
];

// Fuente
const FONT      = 'Calibri';
const SZ_BODY   = 24;   // 12pt
const SZ_SMALL  = 20;   // 10pt
const SZ_TINY   = 18;   //  9pt
const SZ_H1     = 36;   // 18pt
const SZ_H2     = 28;   // 14pt
const SZ_COVER  = 64;   // 32pt

const C = {
  primary: '1E3A5F', accent: '048A81',
  pass: '166534', passBg: 'DCFCE7',
  fail: '991B1B', failBg: 'FEE2E2',
  white: 'FFFFFF', light: 'F1F5F9',
  muted: '6B7280', border: 'CBD5E1', headerBg: '1E3A5F',
};

const BD   = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const BNONE = { style: BorderStyle.NONE, size: 0, color: C.white };
const ALL  = { top: BD, bottom: BD, left: BD, right: BD };
const NONE = { top: BNONE, bottom: BNONE, left: BNONE, right: BNONE };

// Helpers
const run  = (t, o={}) => new TextRun({ text:t, font:FONT, size:o.size??SZ_BODY, bold:o.bold??false, italics:o.italic??false, color:o.color??'1F2937' });
const para = (ch, o={}) => new Paragraph({ alignment:o.align??AlignmentType.LEFT, spacing:{before:o.before??60,after:o.after??80}, heading:o.heading, numbering:o.numbering, border:o.border, tabStops:o.tabStops, children:Array.isArray(ch)?ch:[ch] });
const h1   = (t) => para([run(t,{size:SZ_H1,bold:true,color:C.primary})],{heading:HeadingLevel.HEADING_1,before:400,after:160,border:{bottom:{style:BorderStyle.SINGLE,size:8,color:C.accent,space:1}}});
const h2   = (t) => para([run(t,{size:SZ_H2,bold:true,color:C.accent})], {heading:HeadingLevel.HEADING_2,before:280,after:80});
const body = (t,o={})=>para([run(t,{size:SZ_BODY,...o})],{before:40,after:60,align:o.align});
const spc  = (n=120)=>para([],{before:0,after:n});
const bul  = (t)=>para([run(t,{size:SZ_BODY})],{numbering:{reference:'bullets',level:0},before:30,after:30});

function tc(ch, o={}) {
  return new TableCell({ borders:o.noBorder?NONE:ALL, width:o.w?{size:o.w,type:WidthType.DXA}:undefined, shading:o.fill?{fill:o.fill,type:ShadingType.CLEAR}:undefined, margins:{top:80,bottom:80,left:140,right:140}, verticalAlign:VerticalAlign.CENTER, rowSpan:o.rowSpan, children:Array.isArray(ch)?ch:[ch] });
}
const td = (t,w,o={})=>tc(para([run(String(t??'-'),{size:o.size??SZ_SMALL,bold:o.bold,italic:o.italic,color:o.color??'1F2937'})],{align:o.align??AlignmentType.LEFT}),{w,fill:o.fill});
const th = (t,w)=>tc(para([run(t,{size:SZ_SMALL,bold:true,color:C.white})],{align:AlignmentType.CENTER}),{w,fill:C.headerBg});
const row = (...c)=>new TableRow({children:c});
const tbl = (ws,rows)=>new Table({width:{size:ws.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:ws,rows});
const stC = (s,w)=>tc(para([run(s==='passed'?'Paso':'Fallo',{size:SZ_SMALL,bold:true,color:s==='passed'?C.pass:C.fail})],{align:AlignmentType.CENTER}),{w,fill:s==='passed'?C.passBg:C.failBg});

const fmtDate = (ts)=>{const d=ts?new Date(ts):new Date();return d.toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'});};
const fmtMs   = (ms)=>!ms?'-':ms<1?'<1ms':`${Math.round(ms)}ms`;

// Parseo de tests
function parseJSDoc(src) {
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return {title:'',why:'',what:[]};
  const lines = m[1].replace(/^\s*\*\s?/gm,'').trim().split('\n').map(l=>l.trim()).filter(Boolean);
  let why='',what=[],iW=false,iQ=false;
  for (const l of lines.slice(1)) {
    if (l.includes('Por que importa')||l.includes('Por qué importa')){iW=true;iQ=false;continue;}
    if (l.includes('Que se prueba')||l.includes('Qué se prueba')){iQ=true;iW=false;continue;}
    if(iW&&l)why+=(why?' ':'')+l;
    if(iQ&&l)what.push(l.replace(/^-\s*/,''));
  }
  return {title:lines[0]??'',why,what};
}
function parseSuites(src) {
  const suites=[],re=/describe\s*\(\s*['"`]([\s\S]*?)['"`]\s*,/g;let m;
  while((m=re.exec(src))!==null){
    let d=0,s=-1,e=-1;
    for(let i=m.index;i<src.length;i++){if(src[i]==='{'){if(!d)s=i;d++;}else if(src[i]==='}'){if(!--d){e=i;break;}}}
    const block=e>0?src.slice(s,e):'',tests=[],ir=/\bit\s*\(\s*['"`]([\s\S]*?)['"`]\s*,/g;let it;
    while((it=ir.exec(block))!==null)tests.push(it[1].trim());
    const n=m[1].toLowerCase();
    const type=(n.includes('integraci')||n.includes('integration'))?'integration':'unit';
    suites.push({suite:m[1].trim(),tests,type});
  }
  return suites;
}
function loadTestFiles(dir) {
  return fs.readdirSync(dir).filter(f=>/\.(test|spec)\.js$/.test(f)).sort()
    .map(filename=>{
      const src=fs.readFileSync(path.join(dir,filename),'utf-8');
      const jsdoc=parseJSDoc(src),suites=parseSuites(src);
      return {filename,jsdoc,suites,totalTests:suites.reduce((a,s)=>a+s.tests.length,0)};
    });
}
function buildResultMap(vj) {
  if(!vj)return new Map();
  const map=new Map();
  for(const suite of vj.testResults??[]){
    const filename=(suite.testFilePath??suite.name??'').split(/[/\\]/).pop();
    const bySpec=new Map();
    for(const spec of suite.assertionResults??[]){
      bySpec.set(`${(spec.ancestorTitles??[])[0]??''}|||${spec.title}`,{status:spec.status,duration:spec.duration??0,failureMessages:spec.failureMessages??[]});
    }
    map.set(filename,bySpec);
  }
  return map;
}

// Secciones
function buildCover(vj) {
  const total=vj?.numTotalTests??'-',passed=vj?.numPassedTests??'-',failed=vj?.numFailedTests??'-',allOk=failed===0;
  return [
    spc(900),
    para([run(PROJECT.nombre,{size:SZ_COVER,bold:true,color:C.primary})],{align:AlignmentType.CENTER,after:80}),
    para([run(PROJECT.descripcion,{size:SZ_H2,color:C.accent})],{align:AlignmentType.CENTER,after:500}),
    para([run('Reporte de Pruebas de Software',{size:SZ_H1,bold:true,color:C.primary})],{align:AlignmentType.CENTER,after:40}),
    para([run('Conforme al estandar IEEE 829',{size:SZ_BODY,italic:true,color:C.muted})],{align:AlignmentType.CENTER,after:500}),
    tbl([2340,2340,2340,2340],[
      row(th('Total',2340),th('Pasaron',2340),th('Fallaron',2340),th('Resultado',2340)),
      row(td(String(total),2340,{align:AlignmentType.CENTER,size:36,bold:true,color:C.accent}),td(String(passed),2340,{align:AlignmentType.CENTER,size:36,bold:true,color:C.pass}),td(String(failed),2340,{align:AlignmentType.CENTER,size:36,bold:true,color:failed>0?C.fail:C.pass}),td(allOk?'APROBADO':'CON FALLOS',2340,{align:AlignmentType.CENTER,size:SZ_BODY,bold:true,color:allOk?C.pass:C.fail,fill:allOk?C.passBg:C.failBg})),
    ]),
    spc(500),
    tbl([2800,6560],[
      row(td('Version',2800,{bold:true,fill:C.light}),td(PROJECT.docVersion,6560)),
      row(td('Estado',2800,{bold:true,fill:C.light}),td(PROJECT.estado,6560)),
      row(td('Autores',2800,{bold:true,fill:C.light}),td(PROJECT.autores.join(', '),6560)),
      ...(PROJECT.asesor?[row(td('Asesor',2800,{bold:true,fill:C.light}),td(PROJECT.asesor,6560))]:[] ),
      row(td('Institucion',2800,{bold:true,fill:C.light}),td(PROJECT.institucion,6560)),
      row(td('Fecha ejecucion',2800,{bold:true,fill:C.light}),td(fmtDate(vj?.startTime),6560)),
    ]),
    spc(60),
    new Paragraph({children:[new PageBreak()]}),
  ];
}

const buildTOC = ()=>[new TableOfContents('Indice de Contenido',{hyperlink:true,headingStyleRange:'1-3'}),new Paragraph({children:[new PageBreak()]})];

function buildIntro() {
  return [
    h1('1. Introduccion'),h2('1.1 Objetivo del Documento'),
    body('El presente reporte documenta el diseno, la especificacion y los resultados de ejecucion de las pruebas de software del backend de SimuCircuit, conforme al estandar IEEE 829.'),
    h2('1.2 Alcance'),
    bul('Utilidades: parsearValorElectrico, generarFrecuencias, mathUtils'),
    bul('Construccion de circuito: nodoIdOf, expandirPotenciometros, armarObjetoCircuito'),
    bul('Motor MNA: MotorCalculos + DCAnalysis (integracion con circuitos reales)'),
    h2('1.3 Referencias'),
    bul('IEEE 829-2008: Standard for Software and System Test Documentation'),
    bul('Jest 29.7.0: Framework de pruebas'),
    bul('mathjs 12.4.3: Motor matematico (lusolve, complex)'),
    new Paragraph({children:[new PageBreak()]}),
  ];
}

function buildEnv() {
  return [
    h1('2. Entorno de Pruebas'),h2('2.1 Configuracion del Sistema'),
    tbl([3120,6240],[row(th('Componente',3120),th('Version / Valor',6240)),...ENV.map(([k,v])=>row(td(k,3120,{bold:true,fill:C.light}),td(v,6240)))]),
    spc(80),h2('2.2 Criterios de Entrada'),
    bul('El codigo fuente no tiene errores de sintaxis'),bul('npm install ejecutado correctamente'),bul('Node.js >= 18.0.0'),
    spc(80),h2('2.3 Criterios de Salida'),
    bul('El 100% de los casos tienen resultado Paso'),bul('No existen casos en estado Fallo ni Pendiente'),
    new Paragraph({children:[new PageBreak()]}),
  ];
}

function buildSummary(files, vj) {
  const total=vj?.numTotalTests??'-',passed=vj?.numPassedTests??'-',failed=vj?.numFailedTests??'-';
  const suites=vj?.numTotalTestSuites??files.length;
  const durMs=vj?(vj.testResults??[]).reduce((a,s)=>a+(s.endTime??0)-(s.startTime??0),0):0;
  const dur=durMs>=1000?`${(durMs/1000).toFixed(2)}s`:`${Math.round(durMs)}ms`;
  const pct=typeof total==='number'&&total>0?`${((passed/total)*100).toFixed(1)}%`:'-';
  const rMap=buildResultMap(vj);
  return [
    h1('3. Resumen Ejecutivo de Resultados'),
    tbl([2340,2340,2340,2340],[row(th('Archivos',2340),th('Suites',2340),th('Casos',2340),th('Duracion',2340)),row(td(String(files.length),2340,{align:AlignmentType.CENTER,bold:true,size:SZ_H2}),td(String(suites),2340,{align:AlignmentType.CENTER,bold:true,size:SZ_H2}),td(String(total),2340,{align:AlignmentType.CENTER,bold:true,size:SZ_H2}),td(dur,2340,{align:AlignmentType.CENTER,bold:true,size:SZ_H2}))]),
    spc(80),
    tbl([2340,2340,2340,2340],[row(th('Pasaron',2340),th('Fallaron',2340),th('Pendientes',2340),th('% Exito',2340)),row(td(String(passed),2340,{align:AlignmentType.CENTER,size:SZ_H2,bold:true,color:C.pass,fill:C.passBg}),td(String(failed),2340,{align:AlignmentType.CENTER,size:SZ_H2,bold:true,color:failed>0?C.fail:C.pass,fill:failed>0?C.failBg:C.passBg}),td(String(vj?.numPendingTests??0),2340,{align:AlignmentType.CENTER,size:SZ_H2,bold:true}),td(pct,2340,{align:AlignmentType.CENTER,size:SZ_H2,bold:true,color:C.pass}))]),
    spc(120),h2('3.1 Resultados por Archivo'),
    tbl([3000,1440,900,900,1440,1680],[
      row(th('Archivo',3000),th('Tipo',1440),th('Suites',900),th('Casos',900),th('Resultado',1440),th('Duracion',1680)),
      ...files.map((f,i)=>{
        const fm=rMap.get(f.filename);
        const fp=fm?[...fm.values()].filter(v=>v.status==='passed').length:null;
        const ff=fm?[...fm.values()].filter(v=>v.status==='failed').length:null;
        const fd=fm?(()=>{let ms=0;fm.forEach(v=>ms+=v.duration??0);return ms>=1000?`${(ms/1000).toFixed(2)}s`:`${Math.round(ms)}ms`})():'-';
        const hi=f.suites.some(s=>s.type==='integration');
        const fill=i%2===0?C.white:C.light;
        const rl=fp===null?'-':ff>0?'Fallo':'Paso',rc=ff>0?C.fail:C.pass,rf=ff>0?C.failBg:C.passBg;
        return row(td(f.filename,3000,{fill,size:SZ_TINY}),td(hi?'Integracion':'Unitaria',1440,{fill,size:SZ_TINY,align:AlignmentType.CENTER}),td(String(f.suites.length),900,{fill,align:AlignmentType.CENTER,size:SZ_SMALL}),td(String(f.totalTests),900,{fill,align:AlignmentType.CENTER,size:SZ_SMALL}),td(rl,1440,{fill:fp===null?fill:rf,color:fp===null?C.muted:rc,align:AlignmentType.CENTER,bold:true,size:SZ_SMALL}),td(fd,1680,{fill,align:AlignmentType.CENTER,size:SZ_TINY,color:C.muted}));
      }),
    ]),
    new Paragraph({children:[new PageBreak()]}),
  ];
}

function buildDetail(files, vj) {
  const rMap=buildResultMap(vj),children=[h1('4. Especificacion y Resultados de Casos de Prueba')];
  let cp=1;
  files.forEach((f,fi)=>{
    children.push(h2(`4.${fi+1} ${f.filename}`));
    if(f.jsdoc.title)children.push(body(f.jsdoc.title,{italic:true,color:C.muted}));
    if(f.jsdoc.why){children.push(body('Justificacion:',{bold:true}));children.push(body(f.jsdoc.why));}
    if(f.jsdoc.what.length>0){children.push(body('Aspectos verificados:',{bold:true,before:80}));f.jsdoc.what.forEach(w=>children.push(bul(w)));}
    children.push(spc(80));
    const fm=rMap.get(f.filename);
    children.push(tbl([720,2760,2760,1020,900],[
      row(th('ID',720),th('Suite',2760),th('Caso de Prueba (it)',2760),th('Resultado',1020),th('Dur.',900)),
      ...f.suites.flatMap((suite,si)=>{
        const fill=si%2===0?C.white:C.light;
        return suite.tests.map((test,ti)=>{
          const cpId=`CP-${String(cp++).padStart(3,'0')}`;
          const res=fm?.get(`${suite.suite}|||${test}`);
          return row(td(cpId,720,{align:AlignmentType.CENTER,size:SZ_TINY,color:C.muted,fill}),ti===0?td(suite.suite,2760,{fill,bold:true,size:SZ_TINY}):tc(para([]),{w:2760,fill}),td(test,2760,{fill,size:SZ_TINY}),res?stC(res.status,1020):td('N/A',1020,{align:AlignmentType.CENTER,size:SZ_TINY,color:C.muted,fill}),td(fmtMs(res?.duration),900,{align:AlignmentType.CENTER,size:SZ_TINY,color:C.muted,fill}));
        });
      }),
    ]));
    if(fm){const failed=[...fm.entries()].filter(([,v])=>v.status==='failed');if(failed.length>0){children.push(spc(60));children.push(body('Detalle de fallos:',{bold:true,color:C.fail}));failed.forEach(([k,v])=>{children.push(body(`- ${k.split('|||')[1]}`,{color:C.fail}));if(v.failureMessages?.[0])children.push(body(`  ${v.failureMessages[0].split('\n')[0].trim().slice(0,200)}`,{italic:true,size:SZ_TINY,color:C.muted}));});}}
    if(fi<files.length-1)children.push(new Paragraph({children:[new PageBreak()]}));
  });
  return children;
}

function buildConclusions(vj) {
  const allOk=(vj?.numFailedTests??0)===0;
  return [
    new Paragraph({children:[new PageBreak()]}),
    h1('5. Conclusiones'),
    body(allOk?'La ejecucion de la suite de pruebas finalizo satisfactoriamente. El 100% de los casos obtuvieron resultado Paso.':'La suite de pruebas detecto fallos. Los modulos afectados requieren revision antes de la entrega final.'),
    spc(60),body('Los modulos verificados garantizan:',{bold:true}),
    bul('Conversion correcta de notacion de ingenieria a SI (parsearValorElectrico)'),
    bul('Generacion correcta de puntos de frecuencia para los cuatro tipos de barrido AC'),
    bul('Extraccion de nodos y expansion de potenciometros en la netlist'),
    bul('Construccion correcta del objeto circuito para el motor MNA'),
    bul('Resultados fisicamente correctos de Ley de Ohm y divisor de voltaje con el motor DC'),
    bul('Conversion cartesiano-polar sin perdida para representacion fasorial AC'),
    spc(200),h2('5.1 Aprobacion'),
    tbl([3120,3120,3120],[row(th('Rol',3120),th('Nombre',3120),th('Firma / Fecha',3120)),row(td('Autor de pruebas',3120),td('',3120),td('',3120)),row(td('Revisor tecnico',3120),td('',3120),td('',3120)),row(td('Asesor',3120),td('',3120),td('',3120))]),
  ];
}

function buildDoc(files, vj) {
  const date=fmtDate(vj?.startTime);
  const header=new Header({children:[para([run(`${PROJECT.nombre}  |  Reporte de Pruebas IEEE 829`,{size:SZ_TINY,color:C.muted})],{border:{bottom:{style:BorderStyle.SINGLE,size:4,color:C.accent,space:1}},after:0})]});
  const footer=new Footer({children:[para([run(date,{size:SZ_TINY,color:C.muted}),run('\t',{size:SZ_TINY}),run('Pagina ',{size:SZ_TINY,color:C.muted}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:SZ_TINY,color:C.muted})],{tabStops:[{type:TabStopType.RIGHT,position:TabStopPosition.MAX}],border:{top:{style:BorderStyle.SINGLE,size:4,color:C.accent,space:1}},before:0})]});
  return new Document({
    numbering:{config:[{reference:'bullets',levels:[{level:0,format:LevelFormat.BULLET,text:'\u2022',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:480,hanging:280}}}}]}]},
    styles:{default:{document:{run:{font:FONT,size:SZ_BODY}}},paragraphStyles:[
      {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:SZ_H1,bold:true,font:FONT,color:C.primary},paragraph:{spacing:{before:400,after:160},outlineLevel:0}},
      {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:SZ_H2,bold:true,font:FONT,color:C.accent},paragraph:{spacing:{before:280,after:80},outlineLevel:1}},
      {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:24,bold:true,font:FONT,color:C.primary},paragraph:{spacing:{before:200,after:60},outlineLevel:2}},
    ]},
    sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1080,right:1080,bottom:1080,left:1080}}},headers:{default:header},footers:{default:footer},children:[
      ...buildCover(vj),...buildTOC(),...buildIntro(),...buildEnv(),
      ...buildSummary(files,vj),...buildDetail(files,vj),...buildConclusions(vj),
    ]}],
  });
}

// Main
async function main() {
  console.log(`\n📂 Leyendo tests en: ${TESTS_DIR}`);
  const files=loadTestFiles(TESTS_DIR);
  console.log(`   ${files.length} archivos — ${files.reduce((a,f)=>a+f.totalTests,0)} casos`);

  let vj=null;
  if(RESULTS_FILE){
    vj=JSON.parse(fs.readFileSync(RESULTS_FILE,'utf-8'));
  } else if(!SKIP_RUN){
    console.log('   Ejecutando: npx jest --json ...');
    try { execSync(`npx jest --json --outputFile="${TMP_RESULTS}"`,{cwd:__dirname,stdio:'pipe'}); } catch{}
    if(fs.existsSync(TMP_RESULTS)){
      vj=JSON.parse(fs.readFileSync(TMP_RESULTS,'utf-8'));
      try{fs.unlinkSync(TMP_RESULTS);}catch{}
    }
  }

  if(vj){const p=vj.numPassedTests??0,f=vj.numFailedTests??0,t=vj.numTotalTests??0;console.log(`   Resultados: ${p}/${t} pasaron${f>0?`, ${f} fallaron`:''}`);}

  console.log('\n📝 Generando documento IEEE 829...');
  const buffer=await Packer.toBuffer(buildDoc(files,vj));
  fs.writeFileSync(OUTPUT_PATH,buffer);
  console.log(`✅ Listo: ${OUTPUT_PATH} (${Math.round(buffer.length/1024)} KB)\n`);
}

main().catch(err=>{console.error('[ERROR]',err.message);process.exit(1);});
