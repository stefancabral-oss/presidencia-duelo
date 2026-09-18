import { sha256 } from '../src/civic-import.js';

export const candidateHeader = ['DT_GERACAO','HH_GERACAO','ANO_ELEICAO','CD_ELEICAO','NR_TURNO','SG_UE','CD_CARGO','SQ_CANDIDATO','NM_CANDIDATO','NM_URNA_CANDIDATO','NR_CANDIDATO','SG_PARTIDO','DS_SITUACAO_CANDIDATURA','DS_DETALHE_SITUACAO_CAND','NR_CPF_CANDIDATO'];
export const vacancyHeader = ['DT_GERACAO','HH_GERACAO','ANO_ELEICAO','CD_ELEICAO','SG_UE','CD_CARGO','QT_VAGA'];
export function encodeCsv(header, rows, utf8 = false) {
  const text = [header, ...rows.map(row => header.map(key => row[key] ?? '#NULO#'))].map(row => row.map(cell => '"' + String(cell).replaceAll('"','""') + '"').join(';')).join('\r\n') + '\r\n';
  return utf8 ? Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(text,'utf8')]) : Buffer.from(text,'latin1');
}
export function civicImportFixture() {
  const sourceAt = '2032-08-01T15:00:00.000Z';
  const base = { DT_GERACAO:'01/08/2032',HH_GERACAO:'12:00:00',ANO_ELEICAO:'2032',CD_ELEICAO:'999',NR_TURNO:'1' };
  const candidateRows = [['BR','1','11'],['BR','2','12'],['BR','1','13'],['BR','2','14'],['SP','3','21'],['SP','4','22'],['SP','5','31'],['SP','9','32'],['SP','10','33']].map(([ue,cargo,key]) => ({ ...base, SG_UE:ue,CD_CARGO:cargo,SQ_CANDIDATO:key,NM_CANDIDATO:'Pessoa sintética Homônima',NM_URNA_CANDIDATO:'Teste; "sintético"',NR_CANDIDATO:key,SG_PARTIDO:'TESTE',DS_SITUACAO_CANDIDATURA:'APTO',DS_DETALHE_SITUACAO_CAND:'DEFERIDO COM RECURSO',NR_CPF_CANDIDATO:'DO-NOT-RETAIN-SYNTHETIC' }));
  const vacancyRows = [['BR','1','1'],['SP','3','1'],['SP','5','2']].map(([ue,cargo,v]) => ({ ...base,SG_UE:ue,CD_CARGO:cargo,QT_VAGA:v }));
  const candidates = encodeCsv(candidateHeader,candidateRows), vacancies = encodeCsv(vacancyHeader,vacancyRows);
  const metadata = (kind, bytes) => ({ url:'https://example.test/' + kind, locator:kind + '.csv', encoding:'latin1', sourceAt, fetchedAt:'2032-08-01T16:00:00.000Z',sha256:sha256(bytes),license:'Synthetic fixtures only, CC0' });
  const manifest = { version:1,synthetic:true,year:2032,electionKeys:{BR:'999',SP:'999'},pilotUf:'SP',candidates:metadata('candidates',candidates),vacancies:metadata('vacancies',vacancies),officialCounts:{url:'https://example.test/denominators',locator:'Synthetic census',sourceAt,totals:{'BR:president':2,'SP:governor':1,'SP:senator':1}} };
  const relations = [['11',['12']],['13',['14']],['21',['22']],['31',['32','33']]].map(([holderKey,keys]) => ({ electionKey:'999',holderKey,validFrom:'2032-07-01T12:00:00.000Z',validTo:null,members:keys.map(sourceKey => ({sourceKey})),evidence:{url:'https://example.test/explicit-relationship',locator:'Synthetic legal relationship '+holderKey,sourceAt,fetchedAt:'2032-08-01T16:00:00.000Z',license:'Synthetic fixtures only, CC0'} }));
  return { candidates,vacancies,manifest,relations,candidateRows,vacancyRows };
}
