import { CivicImportError } from './civic-import.js';
import { UFS } from '../../shared/civic-contract.js';
import { readDivulgaJson } from './civic-divulga-detail.js';
const decimal = value=>typeof value==='string'&&/^\d{1,32}$/.test(value);
const key = value => {if(decimal(value)&&value!=='0')return value;if(!Number.isSafeInteger(value)||value<1)throw new CivicImportError('Divulga numeric identifier');return String(value);};

// Only identifiers and institutional relationship fields leave this adapter.
// CPF, birth dates, email, voter ID, assets and photos are never projected.
export async function collectDivulgaPilot({year,pilotUf,apiElectionKey,fetchImpl=fetch}) {
  if(!Number.isSafeInteger(year)||year<2026||year>2100||!UFS.includes(pilotUf)||!decimal(apiElectionKey))throw new CivicImportError('Divulga pilot selector');
  const projections=[];
  for(const [jurisdiction,officeCode] of [['BR','1'],[pilotUf,'3'],[pilotUf,'5']]) {
    const url=`https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/${year}/${jurisdiction}/${apiElectionKey}/${officeCode}/candidatoscomvicessuplentes`;
    const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{'User-Agent':'PoliMatch-Staging/1.0 (public TSE data; no publication)'}});
    const {data,rawResponseSha256}=await readDivulgaJson(response);
    if(!data||!Array.isArray(data.candidatos)||data.candidatos.length>10000)throw new CivicImportError('Divulga response profile');
    const holders=data.candidatos.map(candidate=>{
      const sourceKey=key(candidate.id);
      if(String(candidate.cargo?.codigo)!==officeCode||key(candidate.eleicao?.id)!==apiElectionKey||!Array.isArray(candidate.vices)||candidate.vices.length>100)throw new CivicImportError('Divulga holder scope/profile');
      const members=candidate.vices.map(member=>{
        // The live API leaves sq_CANDIDATO_SUPERIOR null; parent.vices is the
        // explicit nesting evidence. A conflicting nonnull parent is rejected.
        if((member.sq_CANDIDATO_SUPERIOR!==null&&member.sq_CANDIDATO_SUPERIOR!==undefined&&key(member.sq_CANDIDATO_SUPERIOR)!==sourceKey)||String(member.sq_ELEICAO)!==apiElectionKey||member.sg_UE!==jurisdiction)throw new CivicImportError('Divulga explicit parent scope');
        return {sourceKey:key(member.sq_CANDIDATO)};
      });
      if(new Set(members.map(m=>m.sourceKey)).size!==members.length)throw new CivicImportError('Divulga duplicate member');
      return {sourceKey,members};
    });
    if(new Set(holders.map(h=>h.sourceKey)).size!==holders.length)throw new CivicImportError('Divulga duplicate holder');
    projections.push({jurisdiction,officeCode,url,rawResponseSha256,fetchedAt:new Date().toISOString(),sourceAt:null,holders});
  }
  return {version:1,year,pilotUf,apiElectionKey,publication:'observation_only',projections};
}

export function divulgaRelationships(collection, candidateRows, electionKeys) {
  if(collection.version!==1||collection.publication!=='observation_only')throw new CivicImportError('Divulga collection version');
  const rows=new Map();
  for(const row of candidateRows){const id=`${row.CD_ELEICAO}:${row.SQ_CANDIDATO}`;if(rows.has(id))rows.set(id,null);else rows.set(id,row);}
  const position={ '2':1,'4':1,'9':1,'10':2 };
  return collection.projections.flatMap(projection=>projection.holders.map(holder=>{
    const electionKey=electionKeys[projection.jurisdiction];
    const members=[...holder.members].sort((a,b)=>(position[rows.get(`${electionKey}:${a.sourceKey}`)?.CD_CARGO]??99)-(position[rows.get(`${electionKey}:${b.sourceKey}`)?.CD_CARGO]??99));
    return {electionKey,holderKey:holder.sourceKey,members,validFrom:null,validTo:null,evidence:{url:projection.url,locator:`parent.id=${holder.sourceKey}; parent.vices[].sq_CANDIDATO; response sha256=${projection.rawResponseSha256}`,sourceAt:null,fetchedAt:projection.fetchedAt,license:null}};
  }));
}
