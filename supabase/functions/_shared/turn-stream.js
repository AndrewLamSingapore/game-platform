// Small SSE transport shared by browser, Vercel and the Edge function.
export async function consumeEvents(body, onEvent) {
  if (!body) throw new Error('stream_body_missing');
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '';
  const dispatch = async block => {
    let event = 'message'; const data = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length || data.join('\n') === '[DONE]') return;
    await onEvent(event, JSON.parse(data.join('\n')));
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 100000) throw new Error('stream_frame_too_large');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end); buffer = buffer.slice(end + 2); await dispatch(block);
      }
      if (done) { if (buffer.trim()) await dispatch(buffer); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export const encodeEvent = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
// Decode only a partial JSON narrative string. It is display-only until validated.
export function partialNarrative(json) {
  const match = /"narrative"\s*:\s*"/.exec(json);
  if (!match) return '';
  const rest = json.slice(match.index + match[0].length); let encoded = '';
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '"') break;
    if (rest[i] === '\\') {
      if (i + 1 >= rest.length) break;
      if (rest[i + 1] === 'u') { if (i + 5 >= rest.length) break; encoded += rest.slice(i, i + 6); i += 5; }
      else { encoded += rest.slice(i, i + 2); i++; }
    } else encoded += rest[i];
  }
  try { return JSON.parse('"' + encoded + '"').slice(0, 900); } catch { return ''; }
}
