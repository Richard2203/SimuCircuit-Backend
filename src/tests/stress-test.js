import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://simucircuit.dev';

const errorRate   = new Rate('errores');
const cacheHits   = new Rate('cache_hits');
const simDuration = new Trend('duracion_simulacion_ms', true);
const totalReqs   = new Counter('total_requests');

export const options = {
    stages: [
        { duration: '1m',  target: 20  },
        { duration: '3m',  target: 20  },
        { duration: '1m',  target: 60  },
        { duration: '2m',  target: 60  },
        { duration: '1m',  target: 100 },
        { duration: '1m',  target: 0   },
    ],
    thresholds: {
        'errores':                ['rate<0.05'],
        'http_req_duration':      ['p(95)<2000'],
        'duracion_simulacion_ms': ['p(95)<3000'],
    },
};

const DC_DOBLE_FUENTE = JSON.stringify({
    id: "1",
    nombre_circuito: "stress_dc_doble_fuente",
    netlist: [
        {"id":"V1","type":"fuente_voltaje","value":"22","nodes":{"neg":"0","pos":"1"},"params":{"activo":1,"corriente_max":"5.00","dcOrAc":"dc","phase":"0.00","frequency":"0.00"},"position":{"x":-30,"y":210},"rotation":0},
        {"id":"V2","type":"fuente_voltaje","value":"18","nodes":{"pos":"3","neg":"4"},"params":{"activo":1,"corriente_max":"5.00","dcOrAc":"dc","phase":"0.00","frequency":"0.00"},"position":{"x":90,"y":210},"rotation":0},
        {"id":"R7","type":"resistencia","value":"3.9k","nodes":{"n1":"1","n2":"2"},"params":{"banda_uno":"Naranja","banda_dos":"Blanco","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":120,"y":60},"rotation":0},
        {"id":"R8","type":"resistencia","value":"3.3k","nodes":{"n1":"2","n2":"5"},"params":{"banda_uno":"Naranja","banda_dos":"Naranja","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":280,"y":60},"rotation":0},
        {"id":"R1","type":"resistencia","value":"1k","nodes":{"n1":"2","n2":"3"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.13","isResistenciaVariable":0},"position":{"x":220,"y":110},"rotation":90},
        {"id":"R6","type":"resistencia","value":"10k","nodes":{"n1":"1","n2":"3"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Naranja","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":140,"y":160},"rotation":0},
        {"id":"R9","type":"resistencia","value":"200","nodes":{"n1":"3","n2":"6"},"params":{"banda_uno":"Rojo","banda_dos":"Negro","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":280,"y":160},"rotation":0},
        {"id":"R4","type":"resistencia","value":"240","nodes":{"n1":"0","n2":"4"},"params":{"banda_uno":"Rojo","banda_dos":"Amarillo","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":140,"y":260},"rotation":0},
        {"id":"R5","type":"resistencia","value":"24","nodes":{"n1":"4","n2":"0"},"params":{"banda_uno":"Rojo","banda_dos":"Amarillo","banda_tres":"Negro","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":280,"y":260},"rotation":0},
        {"id":"R2","type":"resistencia","value":"1k","nodes":{"n1":"5","n2":"6"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.13","isResistenciaVariable":0},"position":{"x":340,"y":110},"rotation":90},
        {"id":"R3","type":"resistencia","value":"2.2k","nodes":{"n1":"6","n2":"0"},"params":{"banda_uno":"Rojo","banda_dos":"Rojo","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":340,"y":210},"rotation":90}
    ]
});

const DC_FUENTE_CORRIENTE = JSON.stringify({
    id: "2",
    nombre_circuito: "stress_dc_fuente_corriente",
    netlist: [
        {"id":"V1","type":"fuente_voltaje","value":"22","nodes":{"neg":"0","pos":"1"},"params":{"activo":1,"corriente_max":"5.00","dcOrAc":"dc","phase":"0.00","frequency":"0.00"},"position":{"x":-30,"y":210},"rotation":0},
        {"id":"R8","type":"resistencia","value":"3.3k","nodes":{"n1":"3","n2":"4"},"params":{"banda_uno":"Naranja","banda_dos":"Naranja","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":220,"y":210},"rotation":90},
        {"id":"R7","type":"resistencia","value":"3.9k","nodes":{"n1":"1","n2":"2"},"params":{"banda_uno":"Naranja","banda_dos":"Blanco","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":160,"y":60},"rotation":0},
        {"id":"I1","type":"fuente_corriente","value":"5m","nodes":{"neg":"2","pos":"5"},"params":{"activo":1,"voltaje_max":"30.00","dcOrAc":"dc","phase":"0.00","frequency":"0.00"},"position":{"x":280,"y":60},"rotation":90},
        {"id":"R1","type":"resistencia","value":"1k","nodes":{"n1":"2","n2":"3"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.13","isResistenciaVariable":0},"position":{"x":220,"y":110},"rotation":90},
        {"id":"R6","type":"resistencia","value":"10k","nodes":{"n1":"1","n2":"3"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Naranja","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":160,"y":160},"rotation":0},
        {"id":"R9","type":"resistencia","value":"200","nodes":{"n1":"3","n2":"6"},"params":{"banda_uno":"Rojo","banda_dos":"Negro","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":280,"y":160},"rotation":0},
        {"id":"R4","type":"resistencia","value":"240","nodes":{"n1":"0","n2":"4"},"params":{"banda_uno":"Rojo","banda_dos":"Amarillo","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":160,"y":260},"rotation":0},
        {"id":"R5","type":"resistencia","value":"680","nodes":{"n1":"4","n2":"0"},"params":{"banda_uno":"Azul","banda_dos":"Gris","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":280,"y":260},"rotation":0},
        {"id":"R2","type":"resistencia","value":"1k","nodes":{"n1":"5","n2":"6"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.13","isResistenciaVariable":0},"position":{"x":340,"y":110},"rotation":90},
        {"id":"R3","type":"resistencia","value":"2.2k","nodes":{"n1":"6","n2":"0"},"params":{"banda_uno":"Rojo","banda_dos":"Rojo","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":340,"y":210},"rotation":90}
    ]
});

const TRANS_LED_BJT = JSON.stringify({
    id: "3",
    configuracion_transitorio: { t_stop: 0.05, delta_t: 0.0001 },
    netlist: [
        {"id":"V_DC","type":"fuente_voltaje","value":"5","nodes":{"neg":"0","pos":"1"},"params":{"activo":1,"corriente_max":"3.00","dcOrAc":"dc","phase":"0.00","frequency":"0.00"},"position":{"x":0,"y":80},"rotation":0},
        {"id":"RC","type":"resistencia","value":"220","nodes":{"n1":"1","n2":"2"},"params":{"banda_uno":"Rojo","banda_dos":"Rojo","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":100,"y":20},"rotation":0},
        {"id":"V_AC","type":"fuente_voltaje","value":"5","nodes":{"neg":"0","pos":"4"},"params":{"activo":1,"corriente_max":"10.00","dcOrAc":"ac","phase":"0.00","frequency":"60.00"},"position":{"x":150,"y":130},"rotation":0},
        {"id":"LED","type":"diodo","value":"ROJO","nodes":{"n1":"2","n2":"3"},"params":{"tipo":"LED","corriente_max":"0.020","voltaje_inv_max":"5.000","caida_tension":"1.700","rz":"0.00","is_saturacion":"1e-14"},"position":{"x":290,"y":0},"rotation":0},
        {"id":"RB","type":"resistencia","value":"1k","nodes":{"n1":"4","n2":"5"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.13","isResistenciaVariable":0},"position":{"x":225,"y":145},"rotation":270},
        {"id":"Q1","type":"transistor_bjt","value":"2N2222A","nodes":{"nE":"0","nC":"3","nB":"5"},"params":{"tipo":"NPN","configuracion":"Uso General","beta":"220.00","vbe_saturacion":"0.700","vce_saturacion":"0.200","corriente_colector_max":"0.800","potencia_maxima":"0.500","frecuencia_transicion":"300.00","modo_operacion":"Amplificador/Interruptor"},"position":{"x":225,"y":50},"rotation":0}
    ]
});

const TRANS_FET = JSON.stringify({
    id: "4",
    configuracion_transitorio: { t_stop: 0.05, delta_t: 0.0001 },
    netlist: [
        {"id":"V_DC","type":"fuente_voltaje","value":"12","nodes":{"neg":"0","pos":"1"},"params":{"activo":1,"corriente_max":"5.00","dcOrAc":"dc","phase":"0.00","frequency":"0.00"},"position":{"x":0,"y":65},"rotation":0},
        {"id":"RD","type":"resistencia","value":"1k","nodes":{"n1":"1","n2":"4"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Rojo","banda_tolerancia":"Dorado","potencia_nominal":"0.13","isResistenciaVariable":0},"position":{"x":130,"y":13},"rotation":0},
        {"id":"V_AC","type":"fuente_voltaje","value":"5","nodes":{"neg":"0","pos":"2"},"params":{"activo":1,"corriente_max":"10.00","dcOrAc":"ac","phase":"0.00","frequency":"60.00"},"position":{"x":130,"y":100},"rotation":0},
        {"id":"RG","type":"resistencia","value":"100","nodes":{"n1":"2","n2":"3"},"params":{"banda_uno":"Marrón","banda_dos":"Negro","banda_tres":"Marrón","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":190,"y":79},"rotation":270},
        {"id":"Q1","type":"transistor_fet","value":"IRFZ44N","nodes":{"nS":"0","nG":"3","nD":"4"},"params":{"tipo":"MOSFET_N","idss":"49.000","vp":"3.000","gm":"15.000","rd":"0.017","configuracion":"Potencia","modo_operacion":"Control de Motores"},"position":{"x":270,"y":0},"rotation":90}
    ]
});

// AC: bobina + capacitor (RLC)
const AC_RLC = JSON.stringify({
    id: "12",
    nombre_circuito: "stress_ac_rlc",
    netlist: [
        {"id":"V1","type":"fuente_voltaje","value":"5","nodes":{"neg":"0","pos":"1"},"params":{"activo":1,"corriente_max":"10.00","dcOrAc":"ac","phase":"0.00","frequency":"60.00"},"position":{"x":60,"y":81},"rotation":0},
        {"id":"L1","type":"bobina","value":"10m","nodes":{"n1":"1","n2":"2"},"params":{"corriente_max":"0.500","resistencia_dc":"5.000"},"position":{"x":220,"y":61},"rotation":0},
        {"id":"R1","type":"resistencia","value":"51","nodes":{"n1":"2","n2":"3"},"params":{"banda_uno":"Verde","banda_dos":"Marron","banda_tres":"Negro","banda_tolerancia":"Dorado","potencia_nominal":"0.25","isResistenciaVariable":0},"position":{"x":340,"y":83},"rotation":0},
        {"id":"C1","type":"capacitor","value":"1u","nodes":{"n1":"3","n2":"0"},"params":{"tipo_dioelectrico":"Ceramico","voltaje":"50.00","polaridad":0},"position":{"x":460,"y":100},"rotation":0}
    ]
});

const HEADERS = { 'Content-Type': 'application/json' };

function elegir(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function registrar(res, tag) {
    totalReqs.add(1);
    if (tag === 'sim') simDuration.add(res.timings.duration);
    const ok = check(res, {
        [`${tag} 200`]: (r) => r.status === 200,
        [`${tag} exito`]: (r) => { try { return JSON.parse(r.body).exito !== false; } catch { return false; } },
    });
    const xCache = (res.headers['X-Cache'] || res.headers['x-cache'] || '').toUpperCase();
    if (tag === 'sim') cacheHits.add(xCache === 'HIT' ? 1 : 0);
    errorRate.add(!ok);
    return ok;
}

export default function () {
    const r = Math.random();

    if (r < 0.25) {
        const res = http.post(`${BASE_URL}/api/simular/dc`, DC_DOBLE_FUENTE, { headers: HEADERS, tags: { tipo: 'dc_doble' } });
        registrar(res, 'sim');
    } else if (r < 0.50) {
        const res = http.post(`${BASE_URL}/api/simular/dc`, DC_FUENTE_CORRIENTE, { headers: HEADERS, tags: { tipo: 'dc_corriente' } });
        registrar(res, 'sim');
    } else if (r < 0.65) {
        const res = http.post(`${BASE_URL}/api/simular/ac`, AC_RLC, { headers: HEADERS, tags: { tipo: 'ac_rlc' } });
        registrar(res, 'sim');
    } else if (r < 0.78) {
        const res = http.post(`${BASE_URL}/api/analisis/transitorio`, TRANS_LED_BJT, { headers: HEADERS, tags: { tipo: 'trans_bjt' }, timeout: '15s' });
        registrar(res, 'sim');
    } else if (r < 0.90) {
        const res = http.post(`${BASE_URL}/api/analisis/transitorio`, TRANS_FET, { headers: HEADERS, tags: { tipo: 'trans_fet' }, timeout: '15s' });
        registrar(res, 'sim');
    } else if (r < 0.95) {
        const res = http.get(`${BASE_URL}/health`, { tags: { tipo: 'health' } });
        registrar(res, 'health');
    } else {
        const res1 = http.get(`${BASE_URL}/api/circuitos`, { tags: { tipo: 'circuitos' } });
        registrar(res1, 'db');
        const res2 = http.get(`${BASE_URL}/api/circuitos/filtros`, { tags: { tipo: 'filtros' } });
        registrar(res2, 'db');
    }

    sleep(0.5 + Math.random() * 1.5);
}

export function handleSummary(data) {
    const m = data.metrics;
    const p50    = m.http_req_duration?.values?.['p(50)']?.toFixed(0)      ?? 'N/A';
    const p95    = m.http_req_duration?.values?.['p(95)']?.toFixed(0)      ?? 'N/A';
    const p99    = m.http_req_duration?.values?.['p(99)']?.toFixed(0)      ?? 'N/A';
    const rps    = m.http_reqs?.values?.rate?.toFixed(2)                   ?? 'N/A';
    const errs   = ((m.errores?.values?.rate ?? 0) * 100).toFixed(2);
    const hits   = ((m.cache_hits?.values?.rate ?? 0) * 100).toFixed(1);
    const reqs   = m.total_requests?.values?.count                         ?? 'N/A';
    const simP95 = m.duracion_simulacion_ms?.values?.['p(95)']?.toFixed(0) ?? 'N/A';
    const simMax = m.duracion_simulacion_ms?.values?.max?.toFixed(0)        ?? 'N/A';

    const resumen = `
╔══════════════════════════════════════════════════════════════╗
║           RESULTADOS — PRUEBA DE ESTRÉS SIMUCIRCUIT         ║
╠══════════════════════════════════════════════════════════════╣
║  Requests totales     : ${String(reqs).padEnd(35)}║
║  Requests / segundo   : ${String(rps).padEnd(35)}║
╠══════════════════════════════════════════════════════════════╣
║  Latencia  p50        : ${String(p50  + ' ms').padEnd(35)}║
║  Latencia  p95        : ${String(p95  + ' ms').padEnd(35)}║
║  Latencia  p99        : ${String(p99  + ' ms').padEnd(35)}║
╠══════════════════════════════════════════════════════════════╣
║  Simulaciones  p95    : ${String(simP95 + ' ms').padEnd(35)}║
║  Simulaciones  max    : ${String(simMax + ' ms').padEnd(35)}║
╠══════════════════════════════════════════════════════════════╣
║  Tasa de error        : ${String(errs + ' %').padEnd(35)}║
║  Cache hits (Redis)   : ${String(hits + ' %').padEnd(35)}║
╚══════════════════════════════════════════════════════════════╝
`;
    console.log(resumen);
    return { 'stdout': resumen, 'resumen.json': JSON.stringify(data, null, 2) };
}