import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../totem-backoffice/package.json',import.meta.url))('typescript');
const helper=await readFile(new URL('../totem-backoffice/src/lib/canvasDocument.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {createCanvasDocument}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
const client=await pool.connect();
try {
  await client.query('BEGIN');
  const result=await client.query(`SELECT v.id,v.owner_id,d.document_json,d.revision FROM visualisations v JOIN visualisation_drafts d ON d.visualisation_id=v.id WHERE v.is_deleted=false AND v.is_protected=false AND v.name='new' FOR UPDATE OF v,d`);
  const row=result.rows[0];
  if(!row)console.log('No visualisation named new was found; nothing changed.');
  else if(row.document_json.webTemplate?.contentMode==='canvas')console.log('new already uses the centre canvas; nothing changed.');
  else {
    if(!row.document_json.webTemplate)throw new Error('new is not based on a web template.');
    let backupName='new (antes del cambio)',suffix=2;
    while((await client.query('SELECT 1 FROM visualisations WHERE is_deleted=false AND upper(name)=upper($1)',[backupName])).rowCount)backupName=`new (antes del cambio ${suffix++})`;
    const backupId=randomUUID(),backup={...row.document_json,name:backupName};
    await client.query("INSERT INTO visualisations(id,name,kind,owner_id) VALUES($1,$2,'visualisation',$3)",[backupId,backupName,row.owner_id]);
    await client.query('INSERT INTO visualisation_drafts(visualisation_id,document_json,updated_by) VALUES($1,$2,$3)',[backupId,backup,row.owner_id]);
    await client.query('INSERT INTO draft_assets(visualisation_id,asset_id) SELECT $1,asset_id FROM draft_assets WHERE visualisation_id=$2',[backupId,row.id]);
    const document=createCanvasDocument(row.document_json,'new');
    await client.query('UPDATE visualisation_drafts SET document_json=$1,revision=revision+1,updated_at=now() WHERE visualisation_id=$2',[document,row.id]);
    await client.query('UPDATE visualisations SET updated_at=now() WHERE id=$1',[row.id]);
    await client.query('DELETE FROM draft_assets WHERE visualisation_id=$1',[row.id]);
    const assets=new Set(Object.values(document.webTemplate.media||{}).map(url=>/^\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(url)?.[1]).filter(Boolean));
    for(const id of assets)await client.query('INSERT INTO draft_assets(visualisation_id,asset_id) VALUES($1,$2)',[row.id,id]);
    await client.query("INSERT INTO audit_events(action,entity_type,entity_id,details_json) VALUES('migrate-centre-canvas','visualisation',$1,$2)",[row.id,{backupId,backupName,previousRevision:row.revision}]);
    console.log(JSON.stringify({converted:'new',backupName,backupId,revision:row.revision+1}));
  }
  await client.query('COMMIT');
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
