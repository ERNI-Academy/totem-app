// Only the trusted Android main frame may invoke this channel.
const pending = new Map();
if (window.TotemNative) window.TotemNative.onmessage = ({data}) => {
  const message = JSON.parse(data), task = pending.get(message.request);
  if (!task) return;
  if (message.progress !== undefined) {task.progress(message.progress); return;}
  pending.delete(message.request);
  if (message.error) task.reject(Error(message.error)); else task.resolve(message.result);
};

export async function call(action, args = {}, progress = () => {}) {
  if (window.TotemNative) {
    const request = crypto.randomUUID();
    return new Promise((resolve,reject) => {
      pending.set(request,{resolve,reject,progress});
      window.TotemNative.postMessage(JSON.stringify({request,action,args}));
    });
  }
  const response = await fetch('../repository/' + action, {
    method:'POST', headers:{'Content-Type':'application/json','X-Totem-Simulator':'1'},
    body:JSON.stringify(args), cache:'no-store'
  });
  if (!response.ok || !response.body) throw Error('Servicio no disponible');
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = '';
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) throw Error('Respuesta incompleta');
      buffered += value;
      let end;
      while ((end=buffered.indexOf('\n')) >= 0) {
        const event = JSON.parse(buffered.slice(0,end)); buffered = buffered.slice(end+1);
        if (event.error) throw Error(event.error);
        if (event.progress !== undefined) progress(event.progress);
        else return event.result;
      }
    }
  } finally {reader.releaseLock();}
}
