/* ═══════════════════════════════════════════════════════════
   TRAZABILIDAD DE ENFERMERÍA — data.js v2
═══════════════════════════════════════════════════════════ */

const KEYS = { PATIENTS:'enf_v2_patients', HISTORY:'enf_v2_history', CONFIG:'enf_v2_config' };

/* ─── ZONAS DEL HOSPITAL ─── */
const HOSPITAL_ZONES = [
  { id:'all',        name:'Todas las zonas',              camas:[] },
  { id:'med-int-3',  name:'Medicina Interna — Piso 3',    camas:['101','102','103','104','105','106','107','108'] },
  { id:'cirugia-4',  name:'Cirugía General — Piso 4',     camas:['201','202','203','204','205','206'] },
  { id:'traumato-2', name:'Traumatología — Piso 2',       camas:['301','302','303','304','305'] },
  { id:'uci-5',      name:'UCI — Piso 5',                 camas:['501','502','503','504','505','506'] },
  { id:'pediatria-1',name:'Pediatría — Piso 1',           camas:['101P','102P','103P','104P','105P'] },
];

/* ─── ROLES ─── */
const ROLES = ['EU Jefe de Turno','Enfermero/a Universitario','TENS','Médico Tratante','Residente'];

/* ─── TURNOS: 08:00–20:00 y 20:00–08:00 ─── */
function detectShift() {
  const h = new Date().getHours();
  return (h >= 8 && h < 20) ? 'DIA' : 'NOCHE';
}
function shiftLabel(type) {
  return type === 'DIA' ? '☀ Turno Día  08:00 – 20:00' : '🌙 Turno Noche  20:00 – 08:00';
}

/* ─── STORAGE ─── */
function sGet(key, fb=null){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function sSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); return true; }catch{ return false; } }

/* ─── UID ─── */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

/* ─── DATE HELPERS ─── */
function fmtDate(d){
  if(!d)return'--';
  const dt=d instanceof Date?d:new Date(d);
  if(isNaN(dt))return'--';
  return dt.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtTime(d){
  if(!d)return'--';
  const dt=d instanceof Date?d:new Date(d);
  if(isNaN(dt))return'--';
  return dt.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
}
function fmtDT(d){ if(!d)return'--'; return fmtDate(d)+' '+fmtTime(d); }
function isToday(iso){ try{ return new Date(iso).toDateString()===new Date().toDateString(); }catch{ return false; } }
function daysAgo(d,h=8){ const dt=new Date(); dt.setDate(dt.getDate()-d); dt.setHours(h,0,0,0); return dt.toISOString(); }
function calcElapsed(iso){
  if(!iso)return null;
  const ms=Date.now()-new Date(iso).getTime();
  if(ms<0)return'0m';
  const m=Math.floor(ms/60000)%60, h=Math.floor(ms/3600000)%24, d=Math.floor(ms/86400000);
  if(d>0)return`${d}d ${h}h ${m}m`;
  if(h>0)return`${h}h ${m}m`;
  return`${m}m`;
}
function calcDays(iso){ if(!iso)return null; return Math.floor((Date.now()-new Date(iso).getTime())/86400000); }

/* ─── CONFIG ─── */
const DEFAULT_CFG = { currentShift:'DIA', shiftStart:'08:00', zoneId:'all' };
function getCfg(){ return{ ...DEFAULT_CFG, ...sGet(KEYS.CONFIG,{}) }; }
function saveCfg(c){ sSet(KEYS.CONFIG,c); }

/* ─── SESSION USER (sessionStorage para login por turno) ─── */
function getUser(){ try{ const u=sessionStorage.getItem('enf_user'); return u?JSON.parse(u):null; }catch{ return null; } }
function setUser(u){ try{ sessionStorage.setItem('enf_user',JSON.stringify(u)); }catch{} }
function clearUser(){ try{ sessionStorage.removeItem('enf_user'); }catch{} }

/* ─── PATIENTS ─── */
function getPatients(){ return sGet(KEYS.PATIENTS, SAMPLE_PATIENTS); }
function savePatients(p){ sSet(KEYS.PATIENTS,p); }
function getPatientByCama(cama){ return getPatients().find(p=>p.cama===cama)||null; }
function updatePatient(updated){
  const pts=getPatients();
  const i=pts.findIndex(p=>p.cama===updated.cama);
  if(i!==-1) pts[i]=updated; else pts.push(updated);
  savePatients(pts);
}
function emptyPatient(cama){
  return { cama, nombre:'', rut:'', edad:null, fechaNac:'', dx:'', servicio:'',
    medico:'', prevision:'FONASA', estado:'libre', ingreso_datetime:null,
    motivo:'', antecedentes:'', alergias:'', medicacion_previa:'',
    evoluciones:[], examenes:[], procedimientos:[], pendientes:[] };
}

/* ─── HISTORY ─── */
function getHistory(){ return sGet(KEYS.HISTORY,[]); }
function saveHistory(h){ const MAX=90; sSet(KEYS.HISTORY,h.slice(0,MAX)); }
function addHistory(entry){ const h=getHistory(); h.unshift(entry); saveHistory(h); }

/* ─── SNAPSHOT de cierre de turno ─── */
function buildSnapshot(user, shiftType, shiftStart, obsGen, incidente){
  const pts=getPatients().filter(p=>p.estado!=='libre');
  const now=new Date();
  return {
    id: uid(),
    tipo: shiftType,
    fecha: fmtDate(now),
    timestamp: now.toISOString(),
    hora_inicio: shiftStart||'--:--',
    hora_cierre: fmtTime(now),
    profesional: user.name,
    rol: user.role,
    zona: user.zone||'all',
    obs_generales: obsGen||'',
    incidente: incidente||'',
    pacientes: pts.map(p=>({
      cama: p.cama,
      nombre: p.nombre,
      dx: p.dx,
      estado: p.estado,
      dias: calcDays(p.ingreso_datetime),
      ingreso: fmtDT(p.ingreso_datetime),
      alergias: p.alergias||'',
      evoluciones_turno: (p.evoluciones||[]).filter(e=>e.turno===shiftType&&isToday(e.fechaRaw)),
      procs_realizados: (p.procedimientos||[]).filter(x=>x.done),
      procs_pendientes: (p.procedimientos||[]).filter(x=>!x.done),
      examenes_criticos: (p.examenes||[]).filter(e=>e.estado==='critico'),
      otros_pendientes: p.pendientes||[],
    }))
  };
}

/* ─── SNAPSHOT del estado actual (para historial) ─── */
function buildCurrentSnapshot(){
  const user=getUser()||{name:'Sistema',role:'Auto'};
  const cfg=getCfg();
  const pts=getPatients().filter(p=>p.estado!=='libre');
  const now=new Date();
  return {
    id: uid(),
    tipo: cfg.currentShift,
    fecha: fmtDate(now),
    timestamp: now.toISOString(),
    hora_inicio: cfg.shiftStart||'--:--',
    hora_cierre: fmtTime(now),
    profesional: user.name,
    rol: user.role,
    zona: cfg.zoneId||'all',
    obs_generales: 'Registro automático del estado actual (turno en curso)',
    incidente: '',
    esActual: true,
    pacientes: pts.map(p=>({
      cama: p.cama, nombre:p.nombre, dx:p.dx, estado:p.estado,
      dias:calcDays(p.ingreso_datetime), ingreso:fmtDT(p.ingreso_datetime),
      alergias:p.alergias||'',
      evoluciones_turno:(p.evoluciones||[]).filter(e=>isToday(e.fechaRaw)),
      procs_realizados:(p.procedimientos||[]).filter(x=>x.done),
      procs_pendientes:(p.procedimientos||[]).filter(x=>!x.done),
      examenes_criticos:(p.examenes||[]).filter(e=>e.estado==='critico'),
      otros_pendientes:p.pendientes||[],
    }))
  };
}

/* ════════════════════════════════════════════════ DATOS DE EJEMPLO */
const SAMPLE_PATIENTS = [
  {
    cama:'101', nombre:'María González Pérez', rut:'12.345.678-9', edad:67,
    fechaNac:'15/03/1957', dx:'Neumonía adquirida en comunidad', servicio:'Medicina Interna',
    medico:'Dr. Rodrigo Saavedra', prevision:'FONASA', estado:'alerta',
    ingreso_datetime:daysAgo(6,20),
    motivo:'Fiebre alta 39.5°C, disnea progresiva, desaturación SpO₂ 85% basal.',
    antecedentes:'DM2, HTA, EPOC leve. No fuma hace 5 años.',
    alergias:'Penicilina (rash cutáneo)', medicacion_previa:'Metformina 850mg c/12h, Losartán 50mg',
    evoluciones:[
      { id:uid(), fechaRaw:daysAgo(0,9), turno:'DIA', fecha:fmtDT(new Date(daysAgo(0,9))), formato:'SOAP',
        texto:'S: Refiere mejoría parcial. Persiste disnea de esfuerzo.\nO: PA 138/82, FC 88, FR 22, SpO₂ 93% c/O₂ 2L. Afebril T° 36.8°C. Estertores bibasales.\nA: NAC en evolución, SpO₂ en límite.\nP: Mantener O₂, control SV c/4h, continuar antibiótico.', autor:'EU Carmen Soto' },
      { id:uid(), fechaRaw:daysAgo(1,21), turno:'NOCHE', fecha:fmtDT(new Date(daysAgo(1,21))), formato:'narrativo',
        texto:'Paciente hemodinámicamente estable. Se administra ceftriaxona 2g EV. Duerme en períodos. Solicita analgesia por dolor costal, paracetamol 1g EV con buena respuesta.', autor:'EU Pedro Vargas' },
    ],
    examenes:[
      { id:uid(), tipo:'Hemograma', fecha:fmtDate(new Date(daysAgo(1))), resultado:'Leucocitos 14.200/mm³, PCR 8.2 mg/dL', estado:'resultado' },
      { id:uid(), tipo:'Rx Tórax', fecha:fmtDate(new Date(daysAgo(1))), resultado:'Consolidación basal derecha', estado:'resultado' },
      { id:uid(), tipo:'Gases arteriales', fecha:fmtDate(new Date()), resultado:'pH 7.38 PaO₂ 68 mmHg — hipoxemia', estado:'critico' },
    ],
    procedimientos:[
      { id:uid(), nombre:'Control SV c/4h', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:true, hora:fmtTime(new Date(daysAgo(0,8))) },
      { id:uid(), nombre:'Nebulización salbutamol', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:true, hora:fmtTime(new Date(daysAgo(0,9))) },
      { id:uid(), nombre:'Hemocultivos de control', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:false, hora:'' },
      { id:uid(), nombre:'Ceftriaxona 2g EV c/24h', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:false, hora:'' },
    ],
    pendientes:[
      { id:uid(), texto:'Interconsulta kinesiología respiratoria — coordinar hora' },
      { id:uid(), texto:'Control PCR y hemograma mañana AM' },
      { id:uid(), texto:'Glicemia capilar próxima a las 12:00h' },
    ]
  },
  {
    cama:'102', nombre:'Carlos Muñoz Reyes', rut:'8.901.234-5', edad:72,
    fechaNac:'22/07/1952', dx:'Insuficiencia cardíaca descompensada', servicio:'Medicina Interna',
    medico:'Dra. Patricia Leiva', prevision:'FONASA', estado:'obs',
    ingreso_datetime:daysAgo(3,14),
    motivo:'Disnea progresiva 5 días, edema MMII bilateral, aumento de peso 4kg.',
    antecedentes:'ICC crónica FE 30%. HTA. FA permanente. Marcapasos bicameral 2019. DM2.',
    alergias:'', medicacion_previa:'Carvedilol, Enalapril, Warfarina, Furosemida 40mg',
    evoluciones:[
      { id:uid(), fechaRaw:daysAgo(0,9), turno:'DIA', fecha:fmtDT(new Date(daysAgo(0,9))), formato:'SOAP',
        texto:'S: Refiere menor disnea. Aún ortopneico a 2 almohadas.\nO: PA 148/88, FC 72 lpm (ritmo MP), SpO₂ 96% AA. Peso 84.0kg (ayer 84.8kg). Balance -600mL.\nA: ICC en descompensación, evolución favorable lenta.\nP: Furosemida EV, balance estricto, restricción hídrica 1L/día.', autor:'EU Carmen Soto' },
    ],
    examenes:[
      { id:uid(), tipo:'NT-proBNP', fecha:fmtDate(new Date(daysAgo(3))), resultado:'1.240 pg/mL (elevado)', estado:'critico' },
      { id:uid(), tipo:'Ecocardiograma', fecha:fmtDate(new Date(daysAgo(2))), resultado:'FE 30%, disfunción sistólica severa', estado:'resultado' },
      { id:uid(), tipo:'ELP', fecha:fmtDate(new Date()), resultado:'K⁺ 4.1 mEq/L, Na⁺ 138, Cr 1.4 mg/dL', estado:'resultado' },
    ],
    procedimientos:[
      { id:uid(), nombre:'Balance hídrico estricto', indicadoPor:'Dra. Leiva', fecha:fmtDate(new Date()), done:true, hora:'07:00' },
      { id:uid(), nombre:'Peso diario', indicadoPor:'Dra. Leiva', fecha:fmtDate(new Date()), done:true, hora:'07:15' },
      { id:uid(), nombre:'Furosemida 40mg EV c/12h', indicadoPor:'Dra. Leiva', fecha:fmtDate(new Date()), done:false, hora:'' },
    ],
    pendientes:[
      { id:uid(), texto:'Control ecocardiograma en 72h' },
      { id:uid(), texto:'INR de control mañana (warfarina)' },
    ]
  },
  {
    cama:'103', nombre:'Ana Torres Vidal', rut:'15.678.901-2', edad:54,
    fechaNac:'08/11/1970', dx:'IAM SDST anteroseptal — post angioplastía día 2',
    servicio:'Medicina Interna', medico:'Dr. Felipe Castillo', prevision:'ISAPRE', estado:'ok',
    ingreso_datetime:daysAgo(2,3),
    motivo:'Dolor precordial opresivo 2h con elevación ST anteroseptal en ECG.',
    antecedentes:'Tabaquismo activo. Dislipidemia. Sin antecedentes cardíacos previos.',
    alergias:'', medicacion_previa:'Atorvastatina 40mg',
    evoluciones:[
      { id:uid(), fechaRaw:daysAgo(0,9), turno:'DIA', fecha:fmtDT(new Date(daysAgo(0,9))), formato:'narrativo',
        texto:'Paciente evoluciona favorablemente día 2 post-angioplastía. Sin dolor precordial. PA 118/72, FC 68 lpm sinusal. Inicia rehabilitación cardíaca precoz: sedente 15 min sin síntomas. Educación tabaquismo reforzada.', autor:'EU Carmen Soto' },
    ],
    examenes:[
      { id:uid(), tipo:'Troponina T peak', fecha:fmtDate(new Date(daysAgo(2))), resultado:'2.8 ng/mL', estado:'resultado' },
      { id:uid(), tipo:'ECG hoy', fecha:fmtDate(new Date()), resultado:'Ritmo sinusal, sin nuevos cambios ST', estado:'resultado' },
    ],
    procedimientos:[
      { id:uid(), nombre:'Monitorización ECG continua', indicadoPor:'Dr. Castillo', fecha:fmtDate(new Date()), done:true, hora:'07:00' },
      { id:uid(), nombre:'AAS 100mg + Clopidogrel 75mg VO', indicadoPor:'Dr. Castillo', fecha:fmtDate(new Date()), done:true, hora:'08:00' },
      { id:uid(), nombre:'Movilización progresiva', indicadoPor:'Dr. Castillo', fecha:fmtDate(new Date()), done:false, hora:'' },
    ],
    pendientes:[
      { id:uid(), texto:'Coronariografía de control en 48h' },
    ]
  },
  {
    cama:'104', nombre:'Roberto Fuentes Díaz', rut:'9.012.345-6', edad:61,
    fechaNac:'14/05/1963', dx:'ERC estadio 4 descompensada', servicio:'Medicina Interna',
    medico:'Dr. Andrés Mora', prevision:'FONASA', estado:'alerta',
    ingreso_datetime:daysAgo(4,10),
    motivo:'Edema generalizado, creatinina 6.8 mg/dL, potasio 6.1 mEq/L.',
    antecedentes:'DM2, HTA, ERC estadio 3b en control nefrológico.',
    alergias:'AINEs (deterioro función renal)', medicacion_previa:'Insulina NPH, Amlodipino, Furosemida 80mg',
    evoluciones:[
      { id:uid(), fechaRaw:daysAgo(0,8), turno:'DIA', fecha:fmtDT(new Date(daysAgo(0,8))), formato:'SOAP',
        texto:'S: Refiere menor edema en piernas. Sin disnea en reposo.\nO: PA 148/90, FC 74, SpO₂ 97% AA. K⁺ 5.4, Cr 5.9 mg/dL. Balance -300mL/24h.\nA: ERC descompensada en mejoría progresiva. Hiperkalemia en descenso.\nP: Mantener dieta hiposódica e hipopotasémica.', autor:'EU Carmen Soto' },
    ],
    examenes:[
      { id:uid(), tipo:'Creatinina', fecha:fmtDate(new Date()), resultado:'5.9 mg/dL (↓ desde 6.8)', estado:'critico' },
      { id:uid(), tipo:'Potasio', fecha:fmtDate(new Date()), resultado:'5.4 mEq/L', estado:'resultado' },
    ],
    procedimientos:[
      { id:uid(), nombre:'Control diuresis horaria', indicadoPor:'Dr. Mora', fecha:fmtDate(new Date()), done:true, hora:'08:00' },
      { id:uid(), nombre:'Quelantes de fósforo con comidas', indicadoPor:'Dr. Mora', fecha:fmtDate(new Date()), done:true, hora:'08:30' },
      { id:uid(), nombre:'Peso diario', indicadoPor:'Dr. Mora', fecha:fmtDate(new Date()), done:false, hora:'' },
    ],
    pendientes:[
      { id:uid(), texto:'Evaluación nefrología tarde de hoy: inicio diálisis' },
      { id:uid(), texto:'Control K⁺ y creatinina 14:00h' },
    ]
  },
  { cama:'105', nombre:'', rut:'', edad:null, fechaNac:'', dx:'', servicio:'', medico:'',
    prevision:'FONASA', estado:'libre', ingreso_datetime:null, motivo:'', antecedentes:'',
    alergias:'', medicacion_previa:'', evoluciones:[], examenes:[], procedimientos:[], pendientes:[] },
  {
    cama:'106', nombre:'Lucía Herrera Castro', rut:'18.234.567-8', edad:43,
    fechaNac:'30/09/1981', dx:'Celulitis severa miembro inferior derecho',
    servicio:'Medicina Interna', medico:'Dr. Rodrigo Saavedra', prevision:'FONASA', estado:'obs',
    ingreso_datetime:daysAgo(1,18),
    motivo:'Eritema, calor, aumento de volumen y dolor en pierna derecha. Fiebre 38.9°C.',
    antecedentes:'Sin antecedentes mórbidos relevantes.', alergias:'', medicacion_previa:'Ninguno',
    evoluciones:[
      { id:uid(), fechaRaw:daysAgo(0,9), turno:'DIA', fecha:fmtDT(new Date(daysAgo(0,9))), formato:'narrativo',
        texto:'Zona afectada demarcada. Sin progresión respecto al turno nocturno. T° 37.4°C, afebril. Eritema y calor local disminuido. Dolor 5/10 (ayer 8/10). Antibiótico EV tolerado sin reacciones.', autor:'EU Carmen Soto' },
    ],
    examenes:[
      { id:uid(), tipo:'Hemograma', fecha:fmtDate(new Date(daysAgo(1))), resultado:'Leucocitos 18.000/mm³, PCR 12.4 mg/dL', estado:'resultado' },
      { id:uid(), tipo:'Cultivo herida', fecha:fmtDate(new Date(daysAgo(1))), resultado:'Pendiente (48-72h)', estado:'pendiente' },
    ],
    procedimientos:[
      { id:uid(), nombre:'Cloxacilina 2g EV c/6h', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:true, hora:'08:00' },
      { id:uid(), nombre:'Curación y demarcación con tinta', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:true, hora:'09:00' },
      { id:uid(), nombre:'Cloxacilina dosis 12:00h', indicadoPor:'Dr. Saavedra', fecha:fmtDate(new Date()), done:false, hora:'' },
    ],
    pendientes:[
      { id:uid(), texto:'Control hemograma y PCR mañana AM' },
      { id:uid(), texto:'Evaluar paso a antibiótico oral si mejoría sostenida' },
    ]
  },
];

/* ─── INIT ─── */
function initData(){
  if(!localStorage.getItem(KEYS.PATIENTS)) sSet(KEYS.PATIENTS, SAMPLE_PATIENTS);
  if(!localStorage.getItem(KEYS.CONFIG)){
    sSet(KEYS.CONFIG,{ ...DEFAULT_CFG, currentShift:detectShift(), shiftStart:fmtTime(new Date()) });
  }
}
