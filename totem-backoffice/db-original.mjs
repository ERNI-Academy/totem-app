import {readFile} from 'node:fs/promises';
const id='00000000-0000-4000-8000-000000000001';
export async function applyOriginalPublication(client) {
  const doc=JSON.parse(await readFile(new URL('../packages/totem-original/document.json',import.meta.url),'utf8'));
  const current=await client.query('SELECT d.document_json FROM visualisation_drafts d JOIN visualisations v ON v.id=d.visualisation_id WHERE v.id=$1 FOR UPDATE OF v,d',[id]);
  if(!current.rowCount) throw new Error('Initialize the PostgreSQL schema before publishing Totem original.');
  const currentDoc=current.rows[0].document_json;
  const changed=currentDoc.experience?.packSha256!==doc.experience.packSha256||currentDoc.webTemplate?.sourceFiles?.length!==doc.webTemplate?.sourceFiles?.length;
  if(changed) await client.query('UPDATE visualisation_drafts SET document_json=$1,revision=revision+1,updated_at=now() WHERE visualisation_id=$2',[doc,id]);
  await client.query("UPDATE visualisations SET is_deleted=false,is_protected=true,kind='system',updated_at=CASE WHEN $2 THEN now() ELSE updated_at END WHERE id=$1",[id,changed]);
  let published=await client.query("SELECT id,version_number FROM visualisation_versions WHERE visualisation_id=$1 AND document_json->'experience'->>'packSha256'=$2 AND coalesce(jsonb_array_length(document_json->'webTemplate'->'sourceFiles'),0)=$3 ORDER BY version_number DESC LIMIT 1",[id,doc.experience.packSha256,doc.webTemplate.sourceFiles.length]);
  if(!published.rowCount){
    published=await client.query('INSERT INTO visualisation_versions(visualisation_id,version_number,document_json) SELECT $1,coalesce(max(version_number),0)+1,$2 FROM visualisation_versions WHERE visualisation_id=$1 RETURNING id,version_number',[id,doc]);
    await client.query("INSERT INTO audit_events(action,entity_type,entity_id,details_json) VALUES('publish-system','visualisation',$1,$2)",[id,{version:published.rows[0].version_number,sourceSha256:doc.experience.sourceSha256,packSha256:doc.experience.packSha256,defaultPublished:true}]);
  }
  const prefix=`totem-original/${doc.experience.packSha256}/%`;
  await client.query('DELETE FROM draft_assets WHERE visualisation_id=$1',[id]);
  await client.query('INSERT INTO draft_assets(visualisation_id,asset_id) SELECT $1,id FROM assets WHERE storage_key LIKE $2 ON CONFLICT DO NOTHING',[id,prefix]);
  await client.query('INSERT INTO version_assets(version_id,asset_id) SELECT $1,id FROM assets WHERE storage_key LIKE $2 ON CONFLICT DO NOTHING',[published.rows[0].id,prefix]);
  console.log(`Totem original: default publication v${published.rows[0].version_number} ready.`);
}
