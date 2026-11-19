import {test,expect} from '@playwright/test';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {BlobServiceClient} from '@azure/storage-blob';
import pg from 'pg';
import sharp from 'sharp';

test('published snapshots stay immutable while the editor saves a newer draft', async ({request}) => {
  const db = new pg.Pool({connectionString:process.env.DATABASE_URL});
  const user = randomUUID(), token = randomBytes(32).toString('hex');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const name = 'Catalogue test '+randomUUID();
  const headers = {cookie:'totem_session='+token};
  const document = {schemaVersion:1,width:1080,height:1920,name,screens:[{id:'home',name:'Inicio',mode:'fullscreen',elements:[
    {id:'heading',type:'text',text:'Primera',x:0,y:0,width:1080,height:900,background:'#00bef4'}
  ]}]};
  let id;
  try {
    await db.query("INSERT INTO users(id,email,display_name,role,password_hash) VALUES($1,$2,'Catalogue test','user','test')",[user,user+'@example.invalid']);
    await db.query("INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[user,hash(token)]);
    const created = await request.post('/api/visualisations',{headers,data:{name,document}});
    expect(created.status()).toBe(201); id=(await created.json()).id;
    const entry = async () => {
      const result = await request.get('/api/totem/catalog');
      expect(result.headers()['cache-control']).toMatch(/no-store/);
      return (await result.json()).visualisations.find(item => item.id===id);
    };
    expect(await entry()).toBeUndefined();
    const url = '/api/visualisations/'+id;
    expect((await request.post(url+'/publish',{headers})).status()).toBe(201);
    const first = await entry();
    expect(first.version).toBe(1);
    const cover = Buffer.from(await (await fetch(first.thumbnailUrl)).arrayBuffer());
    expect(await sharp(cover).metadata()).toMatchObject({width:270,height:480,format:'webp'});
    document.name=name+' edited'; document.screens[0].elements[0].background='#033778';
    expect((await request.put(url,{headers,data:{name:document.name,revision:1,document}})).ok()).toBe(true);
    const draft = await entry();
    expect(draft.name).toBe(name); expect(draft.sha256).toBe(first.sha256);
    expect(new URL(draft.thumbnailUrl).pathname).toBe(new URL(first.thumbnailUrl).pathname);
    expect((await request.post(url+'/publish',{headers})).status()).toBe(201);
    const second = await entry(); expect(second.version).toBe(2); expect(second.name).toBe(document.name);
    expect(second.sha256).not.toBe(first.sha256);
    const exported = await request.get(url+'/export?version=1',{headers,maxRedirects:0});
    expect(exported.status()).toBe(307);
    expect(hash(Buffer.from(await (await fetch(exported.headers().location)).arrayBuffer()))).toBe(first.sha256);
    expect((await request.delete(url,{headers})).ok()).toBe(true); expect(await entry()).toBeUndefined();
  } finally {
    if (id) {
      const versions = await db.query('SELECT id,catalog_artifact AS artifact FROM visualisation_versions WHERE visualisation_id=$1',[id]);
      const container = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getContainerClient(process.env.AZURE_STORAGE_CONTAINER);
      for (const row of versions.rows) for (const key of [row.artifact.zipKey,row.artifact.thumbKey]) {
        if (key.startsWith('catalog/'+row.id+'/')) await container.getBlobClient(key).deleteIfExists();
      }
      await db.query('DELETE FROM visualisation_versions WHERE visualisation_id=$1',[id]);
      await db.query('DELETE FROM visualisations WHERE id=$1',[id]);
      await db.query('DELETE FROM audit_events WHERE entity_id=$1',[id]);
    }
    await db.query('DELETE FROM users WHERE id=$1',[user]); await db.end();
  }
});
